const { Queue } = require('bullmq');
const { createQueueConnection } = require('../config/queue');

const connection = createQueueConnection();

let fileQueue = null;

if (connection) {
  fileQueue = new Queue('file-processing', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  fileQueue.on('error', (err) => {
    console.warn('⚠️ BullMQ File Queue Error:', err.message);
  });
}

/**
 * Enqueue a file for background Gemini AI processing.
 *
 * @param {Object} payload
 * @param {string} payload.fileUploadId - Database FileUpload ID
 * @param {string} payload.userId - Authenticated user ID
 * @param {string} payload.fileHash - SHA-256 digest
 * @param {string} payload.fileType - 'image' | 'pdf'
 * @param {string} payload.cloudinaryUrl - Secure CDN URL of the uploaded asset
 * @param {string} [payload.originalName] - Original file name
 * @param {string} [payload.mimeType] - MIME type (e.g. 'image/jpeg', 'application/pdf')
 * @returns {Promise<Object|null>} BullMQ Job instance or null
 */
const addFileJob = async (payload) => {
  if (!fileQueue) {
    throw new Error('BullMQ file queue is not initialized. Check Redis connection.');
  }

  const jobName = `process-${payload.fileType}-${payload.fileUploadId}`;
  const job = await fileQueue.add(jobName, payload, {
    jobId: payload.fileUploadId, // Use upload ID as unique job ID
  });

  console.log(`📥 [BullMQ] Queued job ${job.id} for file ${payload.originalName || payload.fileUploadId} (${payload.fileType})`);
  return job;
};

module.exports = {
  fileQueue,
  addFileJob,
};
