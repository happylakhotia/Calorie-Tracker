const Redis = require('ioredis');

let redisClient = null;
let isRedisAvailable = false;

/**
 * Initialize and return Redis client for Redis Cloud
 */
const getRedisClient = () => {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redisUrl === 'your_redis_cloud_url_here') {
    console.warn('⚠️ REDIS_URL not configured. Running without Redis Cloud cache.');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('⚠️ Redis Cloud connection failed after 3 retries. Cache temporarily disabled.');
          isRedisAvailable = false;
          return null; // Stop retrying
        }
        return Math.min(times * 300, 2000);
      },
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      console.log('✅ Connected to Redis Cloud');
    });

    redisClient.on('ready', () => {
      isRedisAvailable = true;
    });

    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      console.warn('⚠️ Redis Cloud Error:', err.message);
    });

    redisClient.on('close', () => {
      isRedisAvailable = false;
    });

    // Initiate connection asynchronously
    redisClient.connect().catch((err) => {
      isRedisAvailable = false;
      console.warn('⚠️ Failed to connect to Redis Cloud:', err.message);
    });
  } catch (err) {
    console.warn('⚠️ Failed to create Redis client:', err.message);
    redisClient = null;
    isRedisAvailable = false;
  }

  return redisClient;
};

// Initialize connection on module load
getRedisClient();

/**
 * Standard TTL durations in seconds
 */
const TTL = {
  FILE_ANALYSIS: 60 * 60 * 24 * 30, // 30 days for Gemini file deduplication
  REPORTS: 60 * 30,                 // 30 minutes for aggregated reports
  TODAY_ENTRIES: 60 * 10,           // 10 minutes for today's summary
  GOALS: 60 * 60,                   // 1 hour for user nutrition goals
};

/**
 * Retrieve cached JSON data by key
 * @param {string} key
 * @returns {Promise<any|null>}
 */
const getCache = async (key) => {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return null;

  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.warn(`⚠️ Redis getCache error for key [${key}]:`, err.message);
    return null;
  }
};

/**
 * Store data as JSON in Redis with a TTL
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>}
 */
const setCache = async (key, value, ttlSeconds = TTL.REPORTS) => {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return false;

  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (err) {
    console.warn(`⚠️ Redis setCache error for key [${key}]:`, err.message);
    return false;
  }
};

/**
 * Delete a specific key from Redis
 * @param {string} key
 * @returns {Promise<boolean>}
 */
const deleteCache = async (key) => {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return false;

  try {
    await client.del(key);
    return true;
  } catch (err) {
    console.warn(`⚠️ Redis deleteCache error for key [${key}]:`, err.message);
    return false;
  }
};

/**
 * Delete all keys matching a pattern using non-blocking SCAN
 * @param {string} pattern - e.g. "reports:user123:*"
 * @returns {Promise<number>} count of deleted keys
 */
const deleteCachePattern = async (pattern) => {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return 0;

  try {
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (err) {
    console.warn(`⚠️ Redis deleteCachePattern error for [${pattern}]:`, err.message);
    return 0;
  }
};

/**
 * Invalidate all cached data for a given user (entries, reports, goals)
 * Called when underlying food entries or goals change.
 * @param {string} userId
 */
const invalidateUserCache = async (userId) => {
  if (!userId) return;
  try {
    await Promise.all([
      deleteCachePattern(`entries:*:${userId}*`),
      deleteCachePattern(`reports:*:${userId}*`),
      deleteCachePattern(`goals:*:${userId}*`),
    ]);
  } catch (err) {
    console.warn(`⚠️ Redis invalidateUserCache error for user [${userId}]:`, err.message);
  }
};

module.exports = {
  getRedisClient,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  invalidateUserCache,
  TTL,
  isRedisConnected: () => isRedisAvailable,
};
