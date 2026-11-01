/**
 * keepAliveJob.js
 *
 * Prevents free-tier inactivity pauses on:
 *  • Supabase PostgreSQL  — pauses after 7 days of no activity
 *  • Redis Cloud          — drops connection after ~30 min of silence
 *
 * Strategy:
 *  ┌─ Every 25 min ──────────────────────────────────────────────┐
 *  │  Redis PING  (beats the 30-min Redis Cloud idle timeout)    │
 *  └─────────────────────────────────────────────────────────────┘
 *  ┌─ Every 4 hours ─────────────────────────────────────────────┐
 *  │  DB ping: insert __keepalive__ entry → delete immediately   │
 *  │  + Redis PING                                               │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * Configure via .env:
 *   KEEPALIVE_EMAIL=happy123@gmail.com
 */

const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { getRedisClient, isRedisConnected } = require('../services/redisService');

const KEEPALIVE_EMAIL = process.env.KEEPALIVE_EMAIL || 'happy123@gmail.com';

// ── Redis Ping ─────────────────────────────────────────────────────────────────

const pingRedis = async () => {
  try {
    const client = getRedisClient();
    if (!client || !isRedisConnected()) {
      // Redis not available — silently skip (no spam)
      return;
    }
    await client.ping();
    console.log('[KeepAlive] Redis PING ✅');
  } catch (err) {
    console.warn('[KeepAlive] Redis PING failed:', err.message);
  }
};

// ── DB Ping ────────────────────────────────────────────────────────────────────

const pingDatabase = async () => {
  try {
    const user = await prisma.user.findUnique({
      where:  { email: KEEPALIVE_EMAIL },
      select: { id: true },
    });

    if (!user) {
      console.warn(`[KeepAlive] User "${KEEPALIVE_EMAIL}" not found — DB ping skipped.`);
      return;
    }

    // Insert a dummy entry then immediately delete it — zero net change in DB
    const dummy = await prisma.foodEntry.create({
      data: {
        userId:   user.id,
        foodName: '__keepalive__',
        calories: 0,
        protein:  0,
        carbs:    0,
        fat:      0,
        quantity: 1,
        mealType: 'snacks',  // enum: breakfast | lunch | dinner | snacks
        date:     new Date().toISOString().slice(0, 10),
        source:   'manual',  // enum: manual | ai | pdf
      },
    });
    await prisma.foodEntry.delete({ where: { id: dummy.id } });

    console.log('[KeepAlive] DB ping ✅ (dummy entry inserted + deleted)');
  } catch (err) {
    console.error('[KeepAlive] DB ping failed:', err.message);
  }
};

// ── Full ping (DB + Redis) ─────────────────────────────────────────────────────

const runFullKeepAlive = async () => {
  console.log('[KeepAlive] Running full keep-alive (DB + Redis)...');
  await Promise.allSettled([pingDatabase(), pingRedis()]);
};

// ── Cron Registration ──────────────────────────────────────────────────────────

const registerKeepAliveJobs = () => {
  // ── Job 1: Redis only — every 25 minutes ──────────────────────────────────
  // Redis Cloud free tier disconnects after ~30 min of silence.
  // Pinging every 25 min guarantees it stays alive.
  cron.schedule(
    '*/25 * * * *',    // every 25 minutes
    pingRedis,
    {
      timezone: 'Asia/Kolkata',
      name:     'keepalive-redis-25min',
    }
  );

  // ── Job 2: Full ping (DB + Redis) — every 4 hours ─────────────────────────
  // Supabase free tier pauses after 7 days; pinging every 4h is a comfortable buffer.
  cron.schedule(
    '0 */4 * * *',     // at minute 0 of every 4th hour  (00:00, 04:00, 08:00 …)
    runFullKeepAlive,
    {
      timezone: 'Asia/Kolkata',
      name:     'keepalive-full-4h',
    }
  );

  console.log(
    '⏰ Keep-alive cron jobs registered:\n' +
    `   • Redis PING        — every 25 minutes\n` +
    `   • DB + Redis ping   — every 4 hours\n` +
    `   • Target user       — ${KEEPALIVE_EMAIL}`
  );
};

module.exports = { registerKeepAliveJobs, runFullKeepAlive, pingDatabase, pingRedis };
