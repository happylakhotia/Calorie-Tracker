const prisma = require('../lib/prisma');
const { createError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { todayString } = require('../utils/helpers');
const { getCache, setCache, invalidateUserCache, TTL } = require('../services/redisService');

/**
 * Build the Prisma where clause from query params.
 * All filters are scoped to the authenticated user.
 */
const buildWhere = (userId, query) => {
  const where = { userId };

  if (query.date) {
    where.date = query.date;
  } else if (query.startDate || query.endDate) {
    where.date = {};
    if (query.startDate) where.date.gte = query.startDate;
    if (query.endDate) where.date.lte = query.endDate;
  }

  if (query.mealType) where.mealType = query.mealType;

  return where;
};

/**
 * GET /api/entries
 * Query params: startDate, endDate, date, mealType, page, limit
 */
const getEntries = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = buildWhere(req.user.id, req.query);

    const [entries, total] = await Promise.all([
      prisma.foodEntry.findMany({
        where,
        orderBy: [{ date: 'desc' }, { mealType: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.foodEntry.count({ where }),
    ]);

    res.json(paginatedResponse(entries, total, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/entries/today
 * Returns all entries for today, grouped by meal type.
 * Cache-aside pattern with Redis Cloud.
 */
const getTodayEntries = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const targetDate = req.query.date || todayString();
    const cacheKey = `entries:date:${userId}:${targetDate}`;

    // 1. Check Redis cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    // 2. Fetch from Supabase
    const entries = await prisma.foodEntry.findMany({
      where: { userId, date: targetDate },
      orderBy: [{ mealType: 'asc' }, { createdAt: 'asc' }],
    });

    // Group by meal type
    const grouped = entries.reduce((acc, entry) => {
      if (!acc[entry.mealType]) acc[entry.mealType] = [];
      acc[entry.mealType].push(entry);
      return acc;
    }, {});

    // Compute daily totals
    const totals = entries.reduce(
      (acc, e) => {
        acc.calories += e.calories;
        acc.protein += e.protein;
        acc.carbs += e.carbs;
        acc.fat += e.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const payload = { date: targetDate, grouped, totals, entries };

    // 3. Store in Redis cache
    await setCache(cacheKey, payload, TTL.TODAY_ENTRIES);

    res.json({ success: true, data: payload, source: 'database' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/entries/:id
 */
const getEntry = async (req, res, next) => {
  try {
    const entry = await prisma.foodEntry.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!entry) return next(createError('Food entry not found.', 404));
    res.json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/entries
 */
const createEntry = async (req, res, next) => {
  try {
    const entry = await prisma.foodEntry.create({
      data: { ...req.body, userId: req.user.id },
    });

    // Invalidate user caches (today entries, reports)
    await invalidateUserCache(req.user.id);

    res.status(201).json({ success: true, message: 'Food entry added.', data: entry });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/entries/:id
 */
const updateEntry = async (req, res, next) => {
  try {
    const existing = await prisma.foodEntry.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return next(createError('Food entry not found.', 404));

    const entry = await prisma.foodEntry.update({
      where: { id: req.params.id },
      data: req.body,
    });

    // Invalidate user caches
    await invalidateUserCache(req.user.id);

    res.json({ success: true, message: 'Entry updated.', data: entry });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/entries/:id
 */
const deleteEntry = async (req, res, next) => {
  try {
    const existing = await prisma.foodEntry.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return next(createError('Food entry not found.', 404));

    await prisma.foodEntry.delete({ where: { id: req.params.id } });

    // Invalidate user caches
    await invalidateUserCache(req.user.id);

    res.json({ success: true, message: 'Entry deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEntries, getTodayEntries, getEntry, createEntry, updateEntry, deleteEntry };
