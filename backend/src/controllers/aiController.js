const pdfParse = require('pdf-parse');
const prisma = require('../lib/prisma');
const { analyzeImage, parsePdfEntries, chatWithAI, sendToolResults } = require('../services/geminiService');
const { dispatchTool } = require('../tools/mealTools');

const { uploadToCloudinary } = require('../services/cloudinaryService');
const {
  getCache,
  setCache,
  invalidateUserCache,
  TTL,
} = require('../services/redisService');
const { addFileJob } = require('../queues/fileQueue'); // kept for future use

const { calculateFileHash } = require('../utils/hash');
const { todayString } = require('../utils/helpers');
const { createError } = require('../middleware/errorHandler');

/**
 * POST /api/ai/analyze-image
 *
 * Direct In-Memory Flow (no BullMQ queue):
 * 1. Calculate SHA-256 hash of image file contents
 * 2. Check Redis cache for (userId + fileHash) → instant return on HIT
 * 3. Check Supabase FileUpload table for completed duplicate → instant return
 * 4. NEW FILE:
 *    → Upload buffer to Cloudinary (non-blocking, fire-and-forget)
 *    → Call Gemini directly in-memory (synchronous, no polling needed)
 *    → Store result in DB + Redis for future deduplication
 *    → Return HTTP 200 with completed nutrition data
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

    // Calculate SHA-256 hash of the actual file contents
    const fileHash = calculateFileHash(fileBuffer);
    const cacheKey = `gemini:file:${userId}:${fileHash}`;

    // Check Redis cache (Cache-Aside pattern)
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      console.log(`[Cache HIT] Returning cached Gemini analysis for user ${userId} (hash: ${fileHash.slice(0, 10)}...)`);
      return res.json({
        success: true,
        status: 'completed',
        data: cachedResult,
        source: 'redis_cache',
        duplicate: true,
        fileHash,
      });
    }

    // Check Supabase database for duplicate (userId, fileHash)
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
        console.log(`[DB HIT - Duplicate Detected] Reusing existing Gemini result for user ${userId} without calling Gemini API`);
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
    }

    //  Upload to Cloudinary in background (non-blocking, fire-and-forget for speed)
    let cloudinaryUrl = null;
    uploadToCloudinary(fileBuffer, {
      folder: `calorie-tracker/${userId}/images`,
      resource_type: 'image',
    })
      .then((r) => { cloudinaryUrl = r.secure_url; })
      .catch((err) => { console.warn('Cloudinary upload warning (non-fatal):', err.message); });

    console.log(`[analyzeFood] Calling Gemini for user ${userId} (${mimetype})...`);
    const nutritionData = await analyzeImage(fileBuffer, mimetype);

    console.log(`[analyzeFood] Analysis complete: ${nutritionData.foodName || 'Food Item'}`);

    // Store result in DB for future deduplication (non-blocking, non-fatal)
    prisma.fileUpload.upsert({
      where: { userId_fileHash: { userId, fileHash } },
      create: {
        userId,
        fileHash,
        fileType: 'image',
        originalName,
        cloudinaryUrl,
        processingStatus: 'completed',
        geminiResult: nutritionData,
      },
      update: {
        cloudinaryUrl,
        processingStatus: 'completed',
        geminiResult: nutritionData,
        errorMessage: null,
      },
    }).catch((err) => console.warn('[analyzeFood] DB upsert warning (non-fatal):', err.message));

    //  Cache in Redis for instant reuse on repeated uploads
    await setCache(cacheKey, nutritionData, TTL.FILE_ANALYSIS);

    return res.status(200).json({
      success: true,
      status: 'completed',
      message: 'AI image analysis complete.',
      data: nutritionData,
      fileHash,
      duplicate: false,
    });
  } catch (error) {
    console.error('[analyzeFood Error]:', error);
    next(error);
  }
};

// Normalization helpers for PDF & Action meal entries
const normalizeMealType = (raw) => {
  if (!raw) return 'breakfast';
  const m = String(raw).toLowerCase().trim();
  if (m.includes('snack')) return 'snacks';
  if (m.includes('break')) return 'breakfast';
  if (m.includes('lunch')) return 'lunch';
  if (m.includes('din')) return 'dinner';
  return 'breakfast';
};

const sanitizePdfEntry = (e, userId) => {
  if (!e || typeof e !== 'object') return null;
  const foodName = String(e.foodName || e.name || e.item || '').trim();
  if (!foodName) return null;

  return {
    userId,
    source: 'pdf',
    date: e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : todayString(),
    mealType: normalizeMealType(e.mealType),
    foodName,
    quantity: Math.max(0.1, parseFloat(e.quantity) || 1),
    unit: String(e.unit || 'serving').trim().slice(0, 30),
    calories: Math.max(0, parseFloat(e.calories) || 0),
    protein: Math.max(0, parseFloat(e.protein) || 0),
    carbs: Math.max(0, parseFloat(e.carbs) || 0),
    fat: Math.max(0, parseFloat(e.fat) || 0),
    fiber: Math.max(0, parseFloat(e.fiber) || 0),
    sugar: Math.max(0, parseFloat(e.sugar) || 0),
    sodium: Math.max(0, parseFloat(e.sodium) || 0),
    potassium: Math.max(0, parseFloat(e.potassium) || 0),
    vitaminC: Math.max(0, parseFloat(e.vitaminC) || 0),
    vitaminD: Math.max(0, parseFloat(e.vitaminD) || 0),
    calcium: Math.max(0, parseFloat(e.calcium) || 0),
    iron: Math.max(0, parseFloat(e.iron) || 0),
    notes: e.notes ? String(e.notes).trim().slice(0, 200) : null,
  };
};

/**
 * POST /api/ai/import-pdf
 *
 * Robust PDF Import Flow:
 * 1. Calculate SHA-256 hash of PDF file contents
 * 2. Check Redis / DB cache for instant duplicate reuse
 * 3. Extract text in-memory via pdf-parse
 * 4. Use Gemini AI with fallback models to parse structured food entries
 * 5. Sanitize and insert entries into database and invalidate user cache
 * 6. Return completed result immediately to client
 */
const importPdf = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return next(createError('No PDF file uploaded.', 400));
    }

    const userId = req.user.id;
    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname || 'food-diary.pdf';

    // Calculate SHA-256 hash of the actual PDF file contents
    const fileHash = calculateFileHash(fileBuffer);
    const cacheKey = `gemini:file:${userId}:${fileHash}`;

    //  Check Redis cache
    const cachedData = await getCache(cacheKey);
    if (cachedData && Array.isArray(cachedData)) {
      console.log(`[Redis Cache HIT] Reusing parsed PDF entries for user ${userId}`);

      const entriesToInsert = cachedData
        .map((e) => sanitizePdfEntry(e, userId))
        .filter(Boolean);

      let importedCount = 0;
      if (entriesToInsert.length > 0) {
        const result = await prisma.foodEntry.createMany({
          data: entriesToInsert,
          skipDuplicates: true,
        });
        importedCount = result.count;
        await invalidateUserCache(userId);
      }

      return res.status(200).json({
        success: true,
        status: 'completed',
        message: `Reused previous analysis: imported ${importedCount} food entries without calling Gemini API.`,
        imported: importedCount,
        duplicate: true,
        fileHash,
        data: entriesToInsert,
      });
    }

    // Check Supabase DB for duplicate
    const existingUpload = await prisma.fileUpload.findUnique({
      where: {
        userId_fileHash: { userId, fileHash },
      },
    });

    if (existingUpload && existingUpload.processingStatus === 'completed' && Array.isArray(existingUpload.geminiResult)) {
      console.log(`[DB HIT - Duplicate PDF] Reusing stored Gemini result for user ${userId}`);

      await setCache(cacheKey, existingUpload.geminiResult, TTL.FILE_ANALYSIS);

      const entriesToInsert = existingUpload.geminiResult
        .map((e) => sanitizePdfEntry(e, userId))
        .filter(Boolean);

      let importedCount = 0;
      if (entriesToInsert.length > 0) {
        const result = await prisma.foodEntry.createMany({
          data: entriesToInsert,
          skipDuplicates: true,
        });
        importedCount = result.count;
        await invalidateUserCache(userId);
      }

      return res.status(200).json({
        success: true,
        status: 'completed',
        message: `Reused previous analysis: imported ${importedCount} food entries without calling Gemini API.`,
        imported: importedCount,
        duplicate: true,
        fileHash,
        cloudinaryUrl: existingUpload.cloudinaryUrl,
        data: entriesToInsert,
      });
    }

    // Parse PDF in-memory immediately using pdf-parse
    console.log(`[PDF Parser] Extracting text from PDF buffer for user ${userId}...`);
    let pdfText = '';
    try {
      const pdfData = await pdfParse(fileBuffer);
      pdfText = pdfData.text || '';
    } catch (parseErr) {
      console.warn(' [pdf-parse] Error extracting text:', parseErr.message);
    }

    if (!pdfText || pdfText.trim().length < 10) {
      return next(createError('Could not extract readable text from the uploaded PDF. Please make sure the PDF contains readable text or food logs.', 400));
    }

    //  Upload to Cloudinary in background (non-blocking for performance)
    let cloudinaryUrl = null;
    uploadToCloudinary(fileBuffer, {
      folder: `calorie-tracker/${userId}/documents`,
      resource_type: 'auto',
    })
      .then((res) => { cloudinaryUrl = res.secure_url; })
      .catch((err) => { console.warn(' Cloudinary upload warning (non-fatal):', err.message); });

    // Call Gemini to parse nutrition entries
    console.log(` [PDF Parser] Calling Gemini to parse entries from text (${pdfText.length} chars)...`);
    const rawEntries = await parsePdfEntries(pdfText);

    const cleanEntries = (Array.isArray(rawEntries) ? rawEntries : [])
      .map((e) => sanitizePdfEntry(e, userId))
      .filter(Boolean);

    let importedCount = 0;
    if (cleanEntries.length > 0) {
      const insertResult = await prisma.foodEntry.createMany({
        data: cleanEntries,
        skipDuplicates: true,
      });
      importedCount = insertResult.count;
      console.log(`[PDF Parser] Inserted ${importedCount} entries into database for user ${userId}`);

      // Invalidate user cache so dashboard & reports update immediately
      await invalidateUserCache(userId);
    }

    // Store result in DB and Redis cache
    await prisma.fileUpload.upsert({
      where: { userId_fileHash: { userId, fileHash } },
      create: {
        userId,
        fileHash,
        fileType: 'pdf',
        originalName,
        cloudinaryUrl,
        processingStatus: 'completed',
        geminiResult: cleanEntries,
      },
      update: {
        cloudinaryUrl,
        processingStatus: 'completed',
        geminiResult: cleanEntries,
        errorMessage: null,
      },
    });

    await setCache(cacheKey, cleanEntries, TTL.FILE_ANALYSIS);

    return res.status(200).json({
      success: true,
      status: 'completed',
      message: `Successfully imported ${importedCount} food entries from PDF!`,
      imported: importedCount,
      data: cleanEntries,
      fileHash,
      duplicate: false,
    });
  } catch (error) {
    console.error('[PDF Import Error]:', error);
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
 * Conversational AI endpoint using Gemini Function Calling.
 *
 * Flow: user → Gemini (tool call) → mealTools (validate + DB) → Gemini (final reply) → user
 * Gemini NEVER sees raw database records. It only receives tool result summaries.
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

    // Provide ONLY a minimal goal summary to Gemini — never raw DB entries
    const activeGoal = await prisma.goal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { dailyCalories: true, proteinG: true, carbsG: true, fatG: true },
    });

    const goalSummary = activeGoal
      ? `${activeGoal.dailyCalories} kcal/day | ${activeGoal.proteinG}g protein | ${activeGoal.carbsG}g carbs | ${activeGoal.fatG}g fat`
      : 'Not set';

    // Step 1: Send user message to Gemini — it will either reply directly or emit tool calls
    const { response: initialResponse, toolCalls } = await chatWithAI(
      history.map((m) => ({ role: m.role, content: m.content })),
      message,
      { goalSummary }
    );

    let finalResponse = initialResponse;
    const executedResults = [];
    let stateChanged = false;

    // Step 2: If Gemini emitted tool calls, dispatch them through mealTools (the secure middleware)
    if (toolCalls && toolCalls.length > 0) {
      const toolResults = [];

      for (const call of toolCalls) {
        console.log(`[Chat] Dispatching tool: ${call.name}`, JSON.stringify(call.args));
        try {
          const result = await dispatchTool(call.name, call.args, userId);
          toolResults.push({ name: call.name, result });
          executedResults.push({ tool: call.name, ...result });

          // Any write tool marks state as changed (for cache invalidation)
          if (['logMeal', 'setGoal', 'deleteMeal'].includes(call.name) && result.success) {
            stateChanged = true;
          }
        } catch (err) {
          console.error(`[Chat] Tool ${call.name} threw:`, err.message);
          toolResults.push({ name: call.name, result: { success: false, error: err.message } });
        }
      }

      // Step 3: Send tool results back to Gemini for the final human-readable reply
      try {
        finalResponse = await sendToolResults(
          history.map((m) => ({ role: m.role, content: m.content })),
          message,
          toolResults,
          { goalSummary }
        );
      } catch (err) {
        // If sendToolResults fails, fall back to the initial response or a generic message
        console.warn('[Chat] sendToolResults failed, using fallback response:', err.message);
        finalResponse = initialResponse ||
          executedResults.map((r) => r.message || '').filter(Boolean).join(' ') ||
          'Done! Your request has been processed.';
      }
    }

    // Invalidate Redis user cache so Dashboard and Entries reflect immediately
    if (stateChanged) {
      await invalidateUserCache(userId);
    }

    // Persist user message and AI response with staggered timestamps
    const userCreatedAt = new Date();
    const assistantCreatedAt = new Date(userCreatedAt.getTime() + 100);

    await prisma.chatMessage.createMany({
      data: [
        { userId, role: 'user', content: message, createdAt: userCreatedAt },
        {
          userId,
          role: 'assistant',
          content: finalResponse,
          actions: toolCalls?.length ? toolCalls : null,
          createdAt: assistantCreatedAt,
        },
      ],
    });

    res.json({
      success: true,
      data: { response: finalResponse, executedResults },
    });
  } catch (error) {
    console.error('[chat Error]:', error);
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
    // For legacy messages created with identical timestamps, ensure 'user' precedes 'assistant'
    messages.sort((a, b) => {
      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.role === 'user' && b.role === 'assistant') return -1;
      if (a.role === 'assistant' && b.role === 'user') return 1;
      return 0;
    });

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
