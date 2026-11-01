const IORedis = require('ioredis');
const net = require('net');
const dns = require('dns').promises;

/**
 * Tests if the Redis host is reachable via DNS + TCP within 4 seconds.
 * This prevents BullMQ from ever being initialized when Redis is down,
 * avoiding the infinite [Worker Error] reconnect spam.
 *
 * @param {string} host
 * @param {number} port
 * @returns {Promise<boolean>}
 */
const isRedisReachable = (host, port) => {
  return new Promise(async (resolve) => {
    // 1. DNS check first (fast-fail on ENOTFOUND)
    try {
      await dns.lookup(host);
    } catch {
      return resolve(false);
    }

    // 2. TCP connect check
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 4000);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
};

/**
 * Parses the Redis URL and returns { host, port } or null if invalid.
 */
const parseRedisUrl = (redisUrl) => {
  try {
    const url = new URL(redisUrl);
    return { host: url.hostname, port: parseInt(url.port) || 6379 };
  } catch {
    return null;
  }
};

/**
 * Creates an ioredis connection configured specifically for BullMQ.
 * Returns null immediately if Redis is unreachable (checked synchronously
 * using the result of the async preflight — call initQueueConnection first).
 *
 * BullMQ strictly requires `maxRetriesPerRequest: null` for blocking commands.
 * Do NOT add commandTimeout here — BullMQ uses BLPOP which blocks intentionally.
 */
const createQueueConnection = (redisUrl) => {
  const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ — do NOT change
    enableReadyCheck: false,
    connectTimeout: 5000,
    // NOTE: No commandTimeout — BullMQ uses blocking commands (BLPOP etc.)
    // NOTE: No retryStrategy — Redis was already confirmed reachable by preflight.
    //       If it drops later, BullMQ will emit errors but won't spam reconnects
    //       since retryStrategy returning null stops retries.
    retryStrategy(times) {
      if (times > 2) {
        console.warn('[BullMQ] Redis lost after startup. Worker paused until Redis returns.');
        return null; // Stop retrying — prevents infinite spam
      }
      return Math.min(times * 1000, 3000);
    },
    autoResubscribe: false,
    autoResendUnfulfilledCommands: false,
  });

  client.on('error', (err) => {
    // Suppress noisy ENOTFOUND / ECONNREFUSED logs — already handled by retryStrategy
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') return;
    console.warn('[BullMQ] Redis Error:', err.message);
  });

  return client;
};

/**
 * Async preflight: checks Redis reachability, then returns a BullMQ-ready
 * ioredis connection or null if Redis is not available.
 *
 * Call this once at server startup.
 */
const initQueueConnection = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redisUrl === 'your_redis_cloud_url_here') {
    console.warn('[BullMQ] REDIS_URL not configured. BullMQ disabled.');
    return null;
  }

  const parsed = parseRedisUrl(redisUrl);
  if (!parsed) {
    console.warn('[BullMQ] Invalid REDIS_URL. BullMQ disabled.');
    return null;
  }

  console.log(`[BullMQ] Checking Redis connectivity at ${parsed.host}:${parsed.port}...`);
  const reachable = await isRedisReachable(parsed.host, parsed.port);

  if (!reachable) {
    console.warn(`[BullMQ] Redis unreachable at ${parsed.host}:${parsed.port}. BullMQ disabled — file upload queuing unavailable.`);
    return null;
  }

  console.log('[BullMQ] Redis reachable. Initializing queue connection...');
  return createQueueConnection(redisUrl);
};

module.exports = {
  initQueueConnection,
};
