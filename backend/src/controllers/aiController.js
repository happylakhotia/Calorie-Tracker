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
const { addFileJob } = require('../queues/fileQueue');
const { calculateFileHash } = require('../utils/hash');
const { todayString } = require('../utils/helpers');
const { createError } = require('../middleware/errorHandler');

/**
 * POST /api/ai/analyze-image
 *
 * Non-Blocking BullMQ Flow:
 * 1. Calculate SHA-256 hash of image file contents
 * 2. Check Redis cache for (userId + fileHash)
 *    -> HIT: return instant cached nutrition JSON
 * 3. Check Supabase FileUpload table for (userId, fileHash)
 *    -> Completed HIT: return stored Gemini result without calling Gemini API
 *    -> Pending/Processing HIT: return status 'pending' / 'processing' with fileUploadId
 * 4. NEW FILE (MISS):
 *    -> Upload buffer to Cloudinary CDN (in-memory stream)
 *    -> Create FileUpload record with status 'pending'
 *    -> Enqueue BullMQ background job for Gemini analysis
 *    -> Return HTTP 202 immediately with { status: 'pending', fileUploadId }
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
        status: 'completed',
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

    if (existingUpload) {
      if (existingUpload.processingStatus === 'completed' && existingUpload.geminiResult) {
        console.log(`💾 [DB HIT - Duplicate Detected] Reusing existing Gemini result for user ${userId} without calling Gemini API`);
        // Populate Redis cache for future requests
        await setCache(cacheKey, existingUpload.geminiResult, TTL.FILE_ANALYSIS);

        return res.json({
          success: true,
          status: 'completed',
          data: existingUpload.geminiResult,
          source: 'database_dedup',
          duplicate: true,
          fileHash,
          fileUploadId: existingUpload.id,
          cloudinaryUrl: existingUpload.cloudinaryUrl,
        });
      }

      if (existingUpload.processingStatus === 'pending' || existingUpload.processingStatus === 'processing') {
        console.log(`⏳ [In-Flight Duplicate] File ${fileHash.slice(0, 10)}... is already being processed.`);
        return res.status(202).json({
          success: true,
          status: existingUpload.processingStatus,
          message: 'This file is currently being processed in the background.',
          fileUploadId: existingUpload.id,
          fileHash,
          duplicate: true,
          cloudinaryUrl: existingUpload.cloudinaryUrl,
        });
      }
    }

    // 4. NEW FILE: Upload to Cloudinary CDN
    console.log(`☁️ [New File] Uploading image to Cloudinary for user ${userId}...`);
    const cloudinaryResult = await uploadToCloudinary(fileBuffer, {
      folder: `calorie-tracker/${userId}/images`,
      resource_type: 'image',
    });

    // 5. Create database record with status 'pending'
    const fileUpload = await prisma.fileUpload.upsert({
      where: { userId_fileHash: { userId, fileHash } },
      create: {
        userId,
        fileHash,
        fileType: 'image',
        originalName,
        cloudinaryUrl: cloudinaryResult.secure_url,
        processingStatus: 'pending',
      },
      update: {
        cloudinaryUrl: cloudinaryResult.secure_url,
        processingStatus: 'pending',
        errorMessage: null,
      },
    });

    // 6. Enqueue BullMQ background job (non-blocking)
    const job = await addFileJob({
      fileUploadId: fileUpload.id,
      userId,
      fileHash,
      fileType: 'image',
      cloudinaryUrl: cloudinaryResult.secure_url,
      originalName,
      mimeType: mimetype,
    });

    console.log(`🚀 [Non-Blocking API] Enqueued image job ${job.id} for user ${userId}`);

    return res.status(202).json({
      success: true,
      status: 'pending',
      message: 'Image uploaded. Background AI analysis in progress.',
      fileUploadId: fileUpload.id,
      jobId: job.id,
      fileHash,
      cloudinaryUrl: cloudinaryResult.secure_url,
      duplicate: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/import-pdf
 *
 * Non-Blocking BullMQ Flow:
 * 1. Calculate SHA-256 hash of PDF file contents
 * 2. Check (userId, fileHash) in Redis and Supabase
 *    -> Completed duplicate: reuse entries immediately without calling Gemini API
 *    -> In-flight duplicate: return current status
 * 3. NEW FILE:
 *    -> Upload PDF to Cloudinary
 *    -> Create FileUpload record with status 'pending'
 *    -> Enqueue BullMQ background job (worker extracts text, calls Gemini, bulk-inserts entries)
 *    -> Return HTTP 202 immediately with { status: 'pending', fileUploadId }
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

    // 2. Check Redis cache
    const cachedData = await getCache(cacheKey);
    if (cachedData && Array.isArray(cachedData)) {
      console.log(`⚡ [Redis Cache HIT] Reusing parsed PDF entries for user ${userId}`);
      
      const entriesToInsert = cachedData.map((e) => ({
        ...e,
        userId,
        source: 'pdf',
        date: e.date || todayString(),
      }));

      const result = await prisma.foodEntry.createMany({
        data: entriesToInsert,
        skipDuplicates: true,
      });

      await invalidateUserCache(userId);

      return res.status(200).json({
        success: true,
        status: 'completed',
        message: `Reused previous analysis: imported ${result.count} food entries without calling Gemini API.`,
        imported: result.count,
        duplicate: true,
        fileHash,
        data: cachedData,
      });
    }

    // 3. Check Supabase if not in Redis
    const existingUpload = await prisma.fileUpload.findUnique({
      where: {
        userId_fileHash: {
          userId,
          fileHash,
        },
      },
    });

    if (existingUpload) {
      if (existingUpload.processingStatus === 'completed' && Array.isArray(existingUpload.geminiResult)) {
        console.log(`💾 [DB HIT - Duplicate PDF] Reusing stored Gemini result for user ${userId}`);
        
        await setCache(cacheKey, existingUpload.geminiResult, TTL.FILE_ANALYSIS);

        const entriesToInsert = existingUpload.geminiResult.map((e) => ({
          ...e,
          userId,
          source: 'pdf',
          date: e.date || todayString(),
        }));

        const result = await prisma.foodEntry.createMany({
          data: entriesToInsert,
          skipDuplicates: true,
        });

        await invalidateUserCache(userId);

        return res.status(200).json({
          success: true,
          status: 'completed',
          message: `Reused previous analysis: imported ${result.count} food entries without calling Gemini API.`,
          imported: result.count,
          duplicate: true,
          fileHash,
          cloudinaryUrl: existingUpload.cloudinaryUrl,
          data: existingUpload.geminiResult,
        });
      }

      if (existingUpload.processingStatus === 'pending' || existingUpload.processingStatus === 'processing') {
        return res.status(202).json({
          success: true,
          status: existingUpload.processingStatus,
          message: 'This PDF is currently being processed in the background.',
          fileUploadId: existingUpload.id,
          duplicate: true,
        });
      }
    }

    // 4. NEW PDF: Upload to Cloudinary & queue BullMQ job
    console.log(`☁️ [New PDF] Uploading PDF to Cloudinary for user ${userId}...`);
    const cloudinaryResult = await uploadToCloudinary(fileBuffer, {
      folder: `calorie-tracker/${userId}/documents`,
      resource_type: 'auto',
    });

    // Create FileUpload record in DB
    const fileUpload = await prisma.fileUpload.upsert({
      where: { userId_fileHash: { userId, fileHash } },
      create: {
        userId,
        fileHash,
        fileType: 'pdf',
        originalName,
        cloudinaryUrl: cloudinaryResult.secure_url,
        processingStatus: 'pending',
      },
      update: {
        cloudinaryUrl: cloudinaryResult.secure_url,
        processingStatus: 'pending',
        errorMessage: null,
      },
    });

    // Enqueue BullMQ background job
    const job = await addFileJob({
      fileUploadId: fileUpload.id,
      userId,
      fileHash,
      fileType: 'pdf',
      cloudinaryUrl: cloudinaryResult.secure_url,
      originalName,
      mimeType: 'application/pdf',
    });

    console.log(`🚀 [Non-Blocking API] Enqueued PDF job ${job.id} for user ${userId}`);

    return res.status(202).json({
      success: true,
      status: 'pending',
      message: 'PDF uploaded. Background parsing and nutrition extraction in progress.',
      fileUploadId: fileUpload.id,
      jobId: job.id,
      fileHash,
      cloudinaryUrl: cloudinaryResult.secure_url,
      duplicate: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ai/status/:id
 * Retrieve current background processing status and result of an uploaded file.
 */
const getUploadStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const fileUpload = await prisma.fileUpload.findFirst({
      where: { id, userId },
    });

    if (!fileUpload) {
      return next(createError('Upload record not found.', 404));
    }

    res.json({
      success: true,
      status: fileUpload.processingStatus, // 'pending' | 'processing' | 'completed' | 'failed'
      data: fileUpload.geminiResult,
      error: fileUpload.errorMessage,
      fileUploadId: fileUpload.id,
      fileType: fileUpload.fileType,
      cloudinaryUrl: fileUpload.cloudinaryUrl,
      updatedAt: fileUpload.updatedAt,
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

module.exports = {
  analyzeFood,
  importPdf,
  getUploadStatus,
  chat,
  getChatHistory,
  clearChatHistory,
};
