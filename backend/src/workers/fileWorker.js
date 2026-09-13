const { Worker } = require('bullmq');
const pdfParse = require('pdf-parse');
const prisma = require('../lib/prisma');
const { createQueueConnection } = require('../config/queue');
const { analyzeImage, parsePdfEntries } = require('../services/geminiService');
const { setCache, invalidateUserCache, TTL } = require('../services/redisService');
const { todayString } = require('../utils/helpers');

/**
 * Downloads a file buffer from Cloudinary CDN URL using native fetch.
 *
 * @param {string} url - Cloudinary secure URL
 * @returns {Promise<Buffer>}
 */
const downloadFileBuffer = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download asset from Cloudinary: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const connection = createQueueConnection();

let fileWorker = null;

if (connection) {
  fileWorker = new Worker(
    'file-processing',
    async (job) => {
      const startTime = Date.now();
      const { fileUploadId, userId, fileHash, fileType, cloudinaryUrl, mimeType, originalName } = job.data;
      const hashPrefix = fileHash ? fileHash.slice(0, 10) : 'unknown';

      console.log(`\n⚙️ [Worker] Starting job ${job.id} | Type: ${fileType} | Hash: ${hashPrefix}... | User: ${userId}`);

      // 1. Verify corresponding upload record in database
      const uploadRecord = await prisma.fileUpload.findUnique({
        where: { id: fileUploadId },
      });

      if (!uploadRecord) {
        console.warn(`⚠️ [Worker] Upload record ${fileUploadId} not found. Skipping.`);
        return { skipped: true, reason: 'Record not found' };
      }

      if (uploadRecord.processingStatus === 'completed' && uploadRecord.geminiResult) {
        console.log(`ℹ️ [Worker] Job ${job.id} already completed in database. Skipping.`);
        return { skipped: true, reason: 'Already completed' };
      }

      // 2. Mark status as processing in DB
      await prisma.fileUpload.update({
        where: { id: fileUploadId },
        data: { processingStatus: 'processing', errorMessage: null },
      });

      // 3. Download file buffer from Cloudinary
      console.log(`⬇️ [Worker] Downloading file buffer from Cloudinary (${originalName || fileType})...`);
      const buffer = await downloadFileBuffer(cloudinaryUrl);

      const cacheKey = `gemini:file:${userId}:${fileHash}`;

      // 4. Process file based on type
      if (fileType === 'image') {
        console.log(`🤖 [Worker] Calling Gemini Vision API for image analysis...`);
        const nutritionData = await analyzeImage(buffer, mimeType || 'image/jpeg');

        // Attach Cloudinary URL to nutrition result
        nutritionData.imageUrl = cloudinaryUrl;

        // 5. Save structured result & update status to completed
        await prisma.fileUpload.update({
          where: { id: fileUploadId },
          data: {
            processingStatus: 'completed',
            geminiResult: nutritionData,
            errorMessage: null,
          },
        });

        // 6. Populate Redis cache (30-day TTL)
        await setCache(cacheKey, nutritionData, TTL.FILE_ANALYSIS);

        const duration = Date.now() - startTime;
        console.log(`✅ [Worker] Image analysis completed for job ${job.id} in ${duration}ms (Food: ${nutritionData.foodName || 'Item'})`);

        return { success: true, type: 'image', foodName: nutritionData.foodName, durationMs: duration };
      } else if (fileType === 'pdf') {
        console.log(`📄 [Worker] Extracting text from PDF buffer...`);
        const pdfData = await pdfParse(buffer);

        if (!pdfData.text || pdfData.text.trim().length < 10) {
          throw new Error('Could not extract readable text from the uploaded PDF.');
        }

        console.log(`🤖 [Worker] Calling Gemini API to parse tabular food entries from PDF text...`);
        const parsedEntries = await parsePdfEntries(pdfData.text);

        let importedCount = 0;
        if (parsedEntries && parsedEntries.length > 0) {
          // Bulk insert entries into Supabase foodEntry table
          const entriesToInsert = parsedEntries.map((e) => ({
            ...e,
            userId,
            source: 'pdf',
            date: e.date || todayString(),
          }));

          const insertResult = await prisma.foodEntry.createMany({
            data: entriesToInsert,
            skipDuplicates: true,
          });

          importedCount = insertResult.count;

          // Invalidate user cached reports & today's entries
          await invalidateUserCache(userId);
        }

        // Save structured result & update status to completed
        await prisma.fileUpload.update({
          where: { id: fileUploadId },
          data: {
            processingStatus: 'completed',
            geminiResult: parsedEntries,
            errorMessage: null,
          },
        });

        // Cache parsed result in Redis
        await setCache(cacheKey, parsedEntries, TTL.FILE_ANALYSIS);

        const duration = Date.now() - startTime;
        console.log(`✅ [Worker] PDF processing completed for job ${job.id} in ${duration}ms (${importedCount} entries inserted)`);

        return { success: true, type: 'pdf', imported: importedCount, durationMs: duration };
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    },
    {
      connection,
      concurrency: 3, // Process up to 3 jobs concurrently
    }
  );

  // ── Worker Lifecycle Event Handlers ──
  fileWorker.on('completed', (job, result) => {
    console.log(`🎉 [Worker Event] Job ${job.id} marked completed.`);
  });

  fileWorker.on('failed', async (job, err) => {
    console.error(`❌ [Worker Event] Job ${job?.id} failed on attempt ${job?.attemptsMade}/${job?.opts?.attempts}:`, err.message);

    // If job has exhausted all retry attempts, update DB record to failed
    if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
      const fileUploadId = job.data?.fileUploadId;
      if (fileUploadId) {
        try {
          await prisma.fileUpload.update({
            where: { id: fileUploadId },
            data: {
              processingStatus: 'failed',
              errorMessage: err.message,
            },
          });
          console.log(`📝 [Worker Event] Upload record ${fileUploadId} marked as 'failed' in DB.`);
        } catch (dbErr) {
          console.error(`⚠️ [Worker Event] Failed to update upload record ${fileUploadId} to failed:`, dbErr.message);
        }
      }
    }
  });

  fileWorker.on('error', (err) => {
    console.warn('⚠️ [Worker Error]:', err.message);
  });
}

module.exports = {
  fileWorker,
};
