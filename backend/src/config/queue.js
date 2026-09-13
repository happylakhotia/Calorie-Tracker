const IORedis = require('ioredis');

/**
 * Creates an ioredis connection configured specifically for BullMQ.
 * BullMQ strictly requires `maxRetriesPerRequest: null` for blocking commands.
 */
const createQueueConnection = () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redisUrl === 'your_redis_cloud_url_here') {
    console.warn('⚠️ REDIS_URL not configured for BullMQ.');
    return null;
  }

  const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 5) {
        console.warn('⚠️ BullMQ Redis connection retry limit reached.');
        return null;
      }
      return Math.min(times * 500, 3000);
    },
  });

  client.on('error', (err) => {
    console.warn('⚠️ BullMQ Redis Error:', err.message);
  });

  return client;
};

module.exports = {
  createQueueConnection,
};
