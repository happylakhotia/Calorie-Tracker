const { Queue } = require('bullmq');

let fileQueue = null;

/**
 * Initialize the BullMQ file queue using an already-verified Redis connection.
 * Must be called after initQueueConnection() resolves.
 *
 * @param {import('ioredis').Redis} connection - pre-tested ioredis connection
 */
const initFileQueue = (connection) => {
  if (!connection) return;

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
    console.warn('[BullMQ] File Queue Error:', err.message);
  });
};

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
    console.warn('[BullMQ] Queue unavailable (Redis not connected). File job skipped for:', payload.fileUploadId);
    return null;
  }

  const jobName = `process-${payload.fileType}-${payload.fileUploadId}`;
  const job = await fileQueue.add(jobName, payload, {
    jobId: payload.fileUploadId, // Use upload ID as unique job ID
  });

  console.log(`[BullMQ] Queued job ${job.id} for file ${payload.originalName || payload.fileUploadId} (${payload.fileType})`);
  return job;
};

module.exports = {
  initFileQueue,
  addFileJob,
  getFileQueue: () => fileQueue,
};
