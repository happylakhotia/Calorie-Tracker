const prisma = require('../lib/prisma');
const { createError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { getCache, setCache, invalidateUserCache, TTL } = require('../services/redisService');

/**
 * GET /api/goals — Get the user's current active goal (most recent)
 * Cache-aside with Redis Cloud
 */
const getActiveGoal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = `goals:active:${userId}`;

    const cached = await getCache(cacheKey);
    if (cached !== null) {
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    const goal = await prisma.goal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    await setCache(cacheKey, goal, TTL.GOALS);

    res.json({ success: true, data: goal, source: 'database' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/goals — Create a new goal (becomes the active one)
 */
const createGoal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const goal = await prisma.goal.create({
      data: { ...req.body, userId },
    });

    await invalidateUserCache(userId);

    res.status(201).json({ success: true, message: 'Goal saved.', data: goal });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/goals/history — Paginated goal history
 */
const getGoalHistory = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { userId: req.user.id };

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.goal.count({ where }),
    ]);

    res.json(paginatedResponse(goals, total, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/goals/:id — Update an existing goal
 */
const updateGoal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return next(createError('Goal not found.', 404));

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: req.body,
    });

    await invalidateUserCache(userId);

    res.json({ success: true, message: 'Goal updated.', data: goal });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/goals/:id
 */
const deleteGoal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return next(createError('Goal not found.', 404));

    await prisma.goal.delete({ where: { id: req.params.id } });

    await invalidateUserCache(userId);

    res.json({ success: true, message: 'Goal deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getActiveGoal, createGoal, getGoalHistory, updateGoal, deleteGoal };
