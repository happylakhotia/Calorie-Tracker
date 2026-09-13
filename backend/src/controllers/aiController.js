const pdfParse = require('pdf-parse');
const prisma = require('../lib/prisma');
const { analyzeImage, parsePdfEntries, chatWithAI } = require('../services/geminiService');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const {
  getCache,
  setCache,
  invalidateUserCache,
  TTL,
} = require('../services/redisService');
const { calculateFileHash } = require('../utils/hash');
const { todayString } = require('../utils/helpers');
const { createError } = require('../middleware/errorHandler');

/**
 * POST /api/ai/analyze-image
 *
 * Flow:
 * 1. Calculate SHA-256 hash of image file contents
 * 2. Check Redis cache for (userId + fileHash)
 * 3. Check Supabase FileUpload table for (userId, fileHash)
 *    -> HIT: reuse stored Gemini result (NO Gemini API call, NO Cloudinary re-upload)
 * 4. MISS:
 *    -> Upload to Cloudinary (store secure_url)
 *    -> Call Gemini analyzeImage
 *    -> Save result in Supabase FileUpload table
 *    -> Cache result in Redis Cloud
 *    -> Return nutrition data
 */
const analyzeFood = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return next(createError('No image file uploaded.', 400));
    }

    const userId = req.user.id;
    const fileBuffer = req.file.buffer;
    const mimetype = req.file.mimetype;
    const originalName = req.file.originalname || 'uploaded-food.jpg';

    // 1. Calculate SHA-256 hash of the actual file contents
    const fileHash = calculateFileHash(fileBuffer);
    const cacheKey = `gemini:file:${userId}:${fileHash}`;

    // 2. Check Redis cache (Cache-Aside pattern)
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      console.log(`⚡ [Cache HIT] Returning cached Gemini analysis for user ${userId} (hash: ${fileHash.slice(0, 10)}...)`);
      return res.json({
        success: true,
        data: cachedResult,
        source: 'redis_cache',
        duplicate: true,
        fileHash,
      });
    }

    // 3. Check Supabase database for duplicate (userId, fileHash)
    const existingUpload = await prisma.fileUpload.findUnique({
      where: {
        userId_fileHash: {
          userId,
          fileHash,
        },
      },
    });

    if (existingUpload && existingUpload.processingStatus === 'completed' && existingUpload.geminiResult) {
      console.log(`💾 [DB HIT - Duplicate Detected] Reusing existing Gemini result for user ${userId} without calling Gemini API`);
      
      // Populate Redis cache for future requests
      await setCache(cacheKey, existingUpload.geminiResult, TTL.FILE_ANALYSIS);

      return res.json({
        success: true,
        data: existingUpload.geminiResult,
        source: 'database_dedup',
        duplicate: true,
        fileHash,
        cloudinaryUrl: existingUpload.cloudinaryUrl,
      });
    }

    // 4. NEW FILE: Upload to Cloudinary
    console.log(`☁️ [New File] Uploading image to Cloudinary for user ${userId}...`);
    const cloudinaryResult = await uploadToCloudinary(fileBuffer, {
      folder: `calorie-tracker/${userId}/images`,
      resource_type: 'image',
    });

    // 5. Call Gemini to analyze the image
    console.log(`🤖 [New File] Calling Gemini API for image analysis...`);
    let nutritionData;
    try {
      nutritionData = await analyzeImage(fileBuffer, mimetype);
    } catch (geminiErr) {
      // Record failed upload attempt in Supabase if needed
      await prisma.fileUpload.upsert({
        where: { userId_fileHash: { userId, fileHash } },
        create: {
          userId,
          fileHash,
          fileType: 'image',
          originalName,
          cloudinaryUrl: cloudinaryResult.secure_url,
          processingStatus: 'failed',
          errorMessage: geminiErr.message,
        },
        update: {
          processingStatus: 'failed',
          errorMessage: geminiErr.message,
        },
      }).catch(() => {});
      throw geminiErr;
    }

    // Attach Cloudinary URL to nutrition data response
    nutritionData.imageUrl = cloudinaryResult.secure_url;

    // 6. Save result to Supabase FileUpload table
    await prisma.fileUpload.upsert({
      where: { userId_fileHash: { userId, fileHash } },
      create: {
        userId,
        fileHash,
        fileType: 'image',
        originalName,
        cloudinaryUrl: cloudinaryResult.secure_url,
        processingStatus: 'completed',
        geminiResult: nutritionData,
      },
      update: {
        cloudinaryUrl: cloudinaryResult.secure_url,
        processingStatus: 'completed',
        geminiResult: nutritionData,
        errorMessage: null,
      },
    });

    // 7. Cache result in Redis Cloud
    await setCache(cacheKey, nutritionData, TTL.FILE_ANALYSIS);

    console.log(`✅ [Success] Processed and saved new image for user ${userId}`);
    res.json({
      success: true,
      data: nutritionData,
      source: 'gemini_api',
      duplicate: false,
      fileHash,
      cloudinaryUrl: cloudinaryResult.secure_url,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/chat
 * Conversational AI endpoint. Stores chat history in the database.
 */
const chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    // Load recent chat history (last 20 messages for context)
    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Get today's entries and active goal for grounding the AI
    const [todayEntries, activeGoal] = await Promise.all([
      prisma.foodEntry.findMany({ where: { userId, date: todayString() } }),
      prisma.goal.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    // Get AI response (service returns clean text + pre-parsed actions)
    const { response: aiResponse, actions } = await chatWithAI(
      history.map((m) => ({ role: m.role, content: m.content })),
      message,
      { todayEntries, activeGoal }
    );

    // Auto-execute LOG_ENTRY actions
    const executedEntries = [];
    let entriesLogged = false;

    for (const action of actions) {
      if (action.type === 'LOG_ENTRY') {
        try {
          const entry = await prisma.foodEntry.create({
            data: { ...action.payload, userId, source: 'ai' },
          });
          executedEntries.push(entry);
          entriesLogged = true;
        } catch (_) { /* non-blocking */ }
      }
    }

    // If entries were logged via chat, invalidate user cache
    if (entriesLogged) {
      await invalidateUserCache(userId);
    }

    // Persist user message and AI response
    await prisma.chatMessage.createMany({
      data: [
        { userId, role: 'user', content: message },
        { userId, role: 'assistant', content: aiResponse, actions },
      ],
    });

    res.json({
      success: true,
      data: { response: aiResponse, actions, executedEntries },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ai/chat/history
 * Returns paginated chat history.
 */
const getChatHistory = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const messages = await prisma.chatMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    // Return in chronological order (oldest to newest)
    messages.reverse();
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/ai/chat/history
 * Clear all chat messages for the user.
 */
const clearChatHistory = async (req, res, next) => {
  try {
    await prisma.chatMessage.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true, message: 'Chat history cleared.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/import-pdf
 * Accepts a PDF upload and bulk-imports food entries with SHA-256 deduplication.
 *
 * Flow:
 * 1. Calculate SHA-256 hash of PDF file contents
 * 2. Check (userId, fileHash) in Redis and Supabase
 *    -> Duplicate: reuse existing Gemini parsed entries, NO Gemini call
 *    -> New: upload PDF to Cloudinary, parse text, call Gemini, save to Supabase & Redis
 * 3. Insert food entries into database & invalidate user caches
 */
const importPdf = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return next(createError('No PDF file uploaded.', 400));
    }

    const userId = req.user.id;
    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname || 'food-diary.pdf';

    // 1. Calculate SHA-256 hash of the actual PDF file contents
    const fileHash = calculateFileHash(fileBuffer);
    const cacheKey = `gemini:file:${userId}:${fileHash}`;

    let parsedEntries = null;
    let isDuplicate = false;
    let cloudinaryUrl = null;

    // 2. Check Redis cache
    const cachedData = await getCache(cacheKey);
    if (cachedData && Array.isArray(cachedData)) {
      console.log(`⚡ [Redis Cache HIT] Reusing parsed PDF entries for user ${userId}`);
      parsedEntries = cachedData;
      isDuplicate = true;
    }

    // 3. Check Supabase if not in Redis
    if (!parsedEntries) {
      const existingUpload = await prisma.fileUpload.findUnique({
        where: {
          userId_fileHash: {
            userId,
            fileHash,
          },
        },
      });

      if (existingUpload && existingUpload.processingStatus === 'completed' && Array.isArray(existingUpload.geminiResult)) {
        console.log(`💾 [DB HIT - Duplicate PDF] Reusing stored Gemini result for user ${userId} without calling Gemini API`);
        parsedEntries = existingUpload.geminiResult;
        isDuplicate = true;
        cloudinaryUrl = existingUpload.cloudinaryUrl;

        // Repopulate Redis cache
        await setCache(cacheKey, parsedEntries, TTL.FILE_ANALYSIS);
      }
    }

    // 4. NEW PDF: Upload to Cloudinary & call Gemini
    if (!isDuplicate) {
      console.log(`☁️ [New PDF] Uploading PDF to Cloudinary for user ${userId}...`);
      const cloudinaryResult = await uploadToCloudinary(fileBuffer, {
        folder: `calorie-tracker/${userId}/documents`,
        resource_type: 'auto',
      });
      cloudinaryUrl = cloudinaryResult.secure_url;

      // Extract text from PDF buffer
      const pdfData = await pdfParse(fileBuffer);
      if (!pdfData.text || pdfData.text.trim().length < 10) {
        return next(createError('Could not extract text from the PDF. Please ensure it contains readable text.', 400));
      }

      console.log(`🤖 [New PDF] Calling Gemini API to parse PDF food entries...`);
      try {
        parsedEntries = await parsePdfEntries(pdfData.text);
      } catch (geminiErr) {
        // Record failed upload attempt in Supabase
        await prisma.fileUpload.upsert({
          where: { userId_fileHash: { userId, fileHash } },
          create: {
            userId,
            fileHash,
            fileType: 'pdf',
            originalName,
            cloudinaryUrl,
            processingStatus: 'failed',
            errorMessage: geminiErr.message,
          },
          update: {
            processingStatus: 'failed',
            errorMessage: geminiErr.message,
          },
        }).catch(() => {});
        throw geminiErr;
      }

      // Save result in Supabase
      await prisma.fileUpload.upsert({
        where: { userId_fileHash: { userId, fileHash } },
        create: {
          userId,
          fileHash,
          fileType: 'pdf',
          originalName,
          cloudinaryUrl,
          processingStatus: 'completed',
          geminiResult: parsedEntries,
        },
        update: {
          cloudinaryUrl,
          processingStatus: 'completed',
          geminiResult: parsedEntries,
          errorMessage: null,
        },
      });

      // Cache result in Redis
      await setCache(cacheKey, parsedEntries, TTL.FILE_ANALYSIS);
    }

    if (!parsedEntries || !parsedEntries.length) {
      return res.json({
        success: true,
        message: 'No food entries found in the PDF.',
        data: [],
        imported: 0,
        duplicate: isDuplicate,
      });
    }

    // 5. Bulk insert entries into Supabase foodEntry table
    const entriesToInsert = parsedEntries.map((e) => ({
      ...e,
      userId,
      source: 'pdf',
      date: e.date || todayString(),
    }));

    const result = await prisma.foodEntry.createMany({
      data: entriesToInsert,
      skipDuplicates: true,
    });

    // Invalidate user cached reports & entries
    await invalidateUserCache(userId);

    res.status(201).json({
      success: true,
      message: isDuplicate
        ? `Reused previous analysis: imported ${result.count} food entries without calling Gemini API.`
        : `Successfully imported ${result.count} food entries from PDF.`,
      imported: result.count,
      duplicate: isDuplicate,
      fileHash,
      cloudinaryUrl,
      data: parsedEntries,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeFood,
  chat,
  getChatHistory,
  clearChatHistory,
  importPdf,
};
