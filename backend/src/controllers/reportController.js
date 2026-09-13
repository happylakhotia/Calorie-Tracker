const prisma = require('../lib/prisma');
const { getCache, setCache, TTL } = require('../services/redisService');

/**
 * Helper: subtract N days from today and return YYYY-MM-DD.
 */
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

/**
 * GET /api/reports/weekly-calories
 * Returns daily calorie totals for the last 7 days.
 */
const weeklyCalories = async (req, res, next) => {
  try {
    const startDate = req.query.startDate || daysAgo(6);
    const endDate = req.query.endDate || daysAgo(0);
    const userId = req.user.id;
    const cacheKey = `reports:weekly:${userId}:${startDate}:${endDate}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, ...cached, source: 'cache' });
    }

    const groups = await prisma.foodEntry.groupBy({
      by: ['date'],
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { calories: true, protein: true, carbs: true, fat: true },
      _count: { id: true },
      orderBy: { date: 'asc' },
    });

    const data = groups.map((g) => ({
      date: g.date,
      calories: g._sum.calories || 0,
      protein: g._sum.protein || 0,
      carbs: g._sum.carbs || 0,
      fat: g._sum.fat || 0,
      entryCount: g._count.id || 0,
    }));

    const result = { data, range: { startDate, endDate } };
    await setCache(cacheKey, result, TTL.REPORTS);

    res.json({ success: true, ...result, source: 'database' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/macros
 * Returns per-day macro breakdown for a given date range.
 */
const macroBreakdown = async (req, res, next) => {
  try {
    const startDate = req.query.startDate || daysAgo(29);
    const endDate = req.query.endDate || daysAgo(0);
    const userId = req.user.id;
    const cacheKey = `reports:macros:${userId}:${startDate}:${endDate}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, ...cached, source: 'cache' });
    }

    const groups = await prisma.foodEntry.groupBy({
      by: ['date'],
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { protein: true, carbs: true, fat: true, calories: true },
      orderBy: { date: 'asc' },
    });

    const data = groups.map((g) => ({
      date: g.date,
      protein: Math.round((g._sum.protein || 0) * 10) / 10,
      carbs: Math.round((g._sum.carbs || 0) * 10) / 10,
      fat: Math.round((g._sum.fat || 0) * 10) / 10,
      calories: Math.round(g._sum.calories || 0),
    }));

    const result = { data, range: { startDate, endDate } };
    await setCache(cacheKey, result, TTL.REPORTS);

    res.json({ success: true, ...result, source: 'database' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/micros
 * Micronutrient totals over a date range, plus number of days tracked.
 */
const microSummary = async (req, res, next) => {
  try {
    const startDate = req.query.startDate || daysAgo(6);
    const endDate = req.query.endDate || daysAgo(0);
    const userId = req.user.id;
    const cacheKey = `reports:micros:${userId}:${startDate}:${endDate}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, ...cached, source: 'cache' });
    }

    const where = { userId, date: { gte: startDate, lte: endDate } };

    const [agg, distinctDays] = await Promise.all([
      prisma.foodEntry.aggregate({
        where,
        _sum: {
          fiber: true,
          sugar: true,
          sodium: true,
          potassium: true,
          vitaminC: true,
          vitaminD: true,
          calcium: true,
          iron: true,
        },
      }),
      prisma.foodEntry.findMany({
        where,
        distinct: ['date'],
        select: { date: true },
      }),
    ]);

    const result = {
      data: {
        fiber: Math.round((agg._sum.fiber || 0) * 10) / 10,
        sugar: Math.round((agg._sum.sugar || 0) * 10) / 10,
        sodium: Math.round(agg._sum.sodium || 0),
        potassium: Math.round(agg._sum.potassium || 0),
        vitaminC: Math.round((agg._sum.vitaminC || 0) * 10) / 10,
        vitaminD: Math.round(agg._sum.vitaminD || 0),
        calcium: Math.round(agg._sum.calcium || 0),
        iron: Math.round((agg._sum.iron || 0) * 10) / 10,
        daysTracked: distinctDays.length,
      },
      range: { startDate, endDate },
    };

    await setCache(cacheKey, result, TTL.REPORTS);

    res.json({ success: true, ...result, source: 'database' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/goal-comparison
 * Compare actual vs goal for each day in the range.
 */
const goalComparison = async (req, res, next) => {
  try {
    const startDate = req.query.startDate || daysAgo(6);
    const endDate = req.query.endDate || daysAgo(0);
    const userId = req.user.id;
    const cacheKey = `reports:goal-comp:${userId}:${startDate}:${endDate}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, ...cached, source: 'cache' });
    }

    const [groups, goal] = await Promise.all([
      prisma.foodEntry.groupBy({
        by: ['date'],
        where: { userId, date: { gte: startDate, lte: endDate } },
        _sum: { calories: true, protein: true, carbs: true, fat: true },
        orderBy: { date: 'asc' },
      }),
      prisma.goal.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const actualData = groups.map((g) => ({
      date: g.date,
      calories: g._sum.calories || 0,
      protein: g._sum.protein || 0,
      carbs: g._sum.carbs || 0,
      fat: g._sum.fat || 0,
    }));

    const result = {
      data: {
        actual: actualData,
        goal: goal
          ? { dailyCalories: goal.dailyCalories, proteinG: goal.proteinG, carbsG: goal.carbsG, fatG: goal.fatG }
          : null,
      },
      range: { startDate, endDate },
    };

    await setCache(cacheKey, result, TTL.REPORTS);

    res.json({ success: true, ...result, source: 'database' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/meal-distribution
 * Calorie distribution by meal type over a date range.
 */
const mealDistribution = async (req, res, next) => {
  try {
    const startDate = req.query.startDate || daysAgo(6);
    const endDate = req.query.endDate || daysAgo(0);
    const userId = req.user.id;
    const cacheKey = `reports:meal-dist:${userId}:${startDate}:${endDate}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, ...cached, source: 'cache' });
    }

    const groups = await prisma.foodEntry.groupBy({
      by: ['mealType'],
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { calories: true },
      _count: { id: true },
    });

    const data = groups.map((g) => ({
      mealType: g.mealType,
      calories: Math.round(g._sum.calories || 0),
      count: g._count.id || 0,
    }));

    const result = { data, range: { startDate, endDate } };
    await setCache(cacheKey, result, TTL.REPORTS);

    res.json({ success: true, ...result, source: 'database' });
  } catch (error) {
    next(error);
  }
};

module.exports = { weeklyCalories, macroBreakdown, microSummary, goalComparison, mealDistribution };
