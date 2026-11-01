/**
 * mealTools.js — Backend tool layer (middleware between Gemini & Database)
 *
 * Flow: user → Gemini → tool call → mealTools → Prisma/DB → tool result → Gemini → user
 *
 * Gemini NEVER directly accesses the database or sees raw DB records.
 * All tools validate, sanitize, and return only minimal, safe result summaries to the model.
 */

const prisma = require('../lib/prisma');
const { todayString } = require('../utils/helpers');
const { invalidateUserCache } = require('../services/redisService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

const normalizeMealType = (raw) => {
  if (!raw) return 'snacks';
  const m = String(raw).toLowerCase().trim();
  if (m.includes('snack')) return 'snacks';
  if (m.includes('break')) return 'breakfast';
  if (m.includes('lunch')) return 'lunch';
  if (m.includes('din')) return 'dinner';
  return 'snacks';
};

const safeFloat = (val, fallback = 0) => {
  const n = parseFloat(val);
  return isFinite(n) && n >= 0 ? n : fallback;
};

const safePositiveFloat = (val, fallback = 1) => {
  const n = parseFloat(val);
  return isFinite(n) && n > 0 ? n : fallback;
};

// ---------------------------------------------------------------------------
// Tool: logMeal
// ---------------------------------------------------------------------------

const logMeal = async (userId, args) => {
  if (!userId) throw new Error('logMeal: userId is required');

  const foodName = String(args.foodName || '').trim();
  if (!foodName) return { success: false, error: 'foodName is required to log a meal.' };

  const mealType = normalizeMealType(args.mealType);
  if (!VALID_MEAL_TYPES.includes(mealType)) {
    return { success: false, error: `Invalid mealType. Must be one of: ${VALID_MEAL_TYPES.join(', ')}` };
  }

  const calories = safeFloat(args.calories, 0);
  if (calories <= 0) return { success: false, error: 'calories must be a positive number.' };

  const entryDate = args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : todayString();

  const data = {
    userId,
    source: 'ai',
    date: entryDate,
    mealType,
    foodName,
    quantity: safePositiveFloat(args.quantity, 1),
    unit: args.unit ? String(args.unit).trim().slice(0, 30) : 'serving',
    calories,
    protein: safeFloat(args.protein),
    carbs: safeFloat(args.carbs),
    fat: safeFloat(args.fat),
    fiber: safeFloat(args.fiber),
    sugar: safeFloat(args.sugar),
    sodium: safeFloat(args.sodium),
    potassium: safeFloat(args.potassium),
    vitaminC: safeFloat(args.vitaminC),
    vitaminD: safeFloat(args.vitaminD),
    calcium: safeFloat(args.calcium),
    iron: safeFloat(args.iron),
    notes: args.notes ? String(args.notes).trim().slice(0, 200) : null,
  };

  const entry = await prisma.foodEntry.create({ data });
  await invalidateUserCache(userId);

  console.log(`[mealTools.logMeal] Logged "${entry.foodName}" (${entry.calories} kcal) in ${entry.mealType} for user ${userId}`);

  // Return ONLY a safe summary — never the full DB record
  return {
    success: true,
    entryId: entry.id,
    foodName: entry.foodName,
    mealType: entry.mealType,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    date: entry.date,
    message: `Successfully logged "${entry.foodName}" (${entry.calories} kcal) to ${entry.mealType}.`,
  };
};

// ---------------------------------------------------------------------------
// Tool: setGoal
// ---------------------------------------------------------------------------

const setGoal = async (userId, args) => {
  if (!userId) throw new Error('setGoal: userId is required');

  const dailyCalories = safePositiveFloat(args.dailyCalories, 0);
  if (!dailyCalories) return { success: false, error: 'dailyCalories must be a positive number to set a goal.' };

  const goalData = {
    userId,
    dailyCalories,
    proteinG: safeFloat(args.proteinG),
    carbsG: safeFloat(args.carbsG),
    fatG: safeFloat(args.fatG),
    weightGoalKg: args.weightGoalKg ? safeFloat(args.weightGoalKg) : null,
    notes: args.notes ? String(args.notes).trim() : 'Updated via AI Chat',
  };

  const goal = await prisma.goal.create({ data: goalData });
  await invalidateUserCache(userId);

  console.log(`[mealTools.setGoal] Goal set: ${goal.dailyCalories} kcal for user ${userId}`);

  return {
    success: true,
    goalId: goal.id,
    dailyCalories: goal.dailyCalories,
    proteinG: goal.proteinG,
    carbsG: goal.carbsG,
    fatG: goal.fatG,
    message: `Goal updated: ${goal.dailyCalories} kcal/day with ${goal.proteinG}g protein, ${goal.carbsG}g carbs, ${goal.fatG}g fat.`,
  };
};

// ---------------------------------------------------------------------------
// Tool: deleteMeal
// ---------------------------------------------------------------------------

const deleteMeal = async (userId, args) => {
  if (!userId) throw new Error('deleteMeal: userId is required');

  let target = null;

  // Strategy 1: delete by explicit ID
  if (args.entryId) {
    target = await prisma.foodEntry.findFirst({
      where: { id: String(args.entryId), userId },
      select: { id: true, foodName: true, mealType: true, calories: true, date: true },
    });
  }

  // Strategy 2: fuzzy match by foodName on today (or specified date)
  if (!target && args.foodName) {
    const searchDate = args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : todayString();

    const whereClause = {
      userId,
      date: searchDate,
      foodName: { contains: String(args.foodName).trim(), mode: 'insensitive' },
    };

    if (args.mealType) {
      const mt = normalizeMealType(args.mealType);
      if (VALID_MEAL_TYPES.includes(mt)) whereClause.mealType = mt;
    }

    target = await prisma.foodEntry.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: { id: true, foodName: true, mealType: true, calories: true, date: true },
    });
  }

  if (!target) {
    return {
      success: false,
      error: args.foodName
        ? `No entry found matching "${args.foodName}" on ${args.date || todayString()}.`
        : 'No entry found. Provide either entryId or foodName.',
    };
  }

  await prisma.foodEntry.delete({ where: { id: target.id } });
  await invalidateUserCache(userId);

  console.log(`[mealTools.deleteMeal] Deleted "${target.foodName}" from ${target.mealType} for user ${userId}`);

  return {
    success: true,
    deletedFoodName: target.foodName,
    mealType: target.mealType,
    calories: target.calories,
    date: target.date,
    message: `Deleted "${target.foodName}" (${target.calories} kcal) from ${target.mealType} on ${target.date}.`,
  };
};

// ---------------------------------------------------------------------------
// Tool: queryEntries
// ---------------------------------------------------------------------------

const queryEntries = async (userId, args) => {
  if (!userId) throw new Error('queryEntries: userId is required');

  const date = args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : todayString();

  const where = { userId, date };

  if (args.mealType) {
    const mt = normalizeMealType(args.mealType);
    if (VALID_MEAL_TYPES.includes(mt)) where.mealType = mt;
  }

  if (args.foodName) {
    where.foodName = { contains: String(args.foodName).trim(), mode: 'insensitive' };
  }

  // Fetch only the fields needed — never expose userId, internal metadata, etc.
  const entries = await prisma.foodEntry.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      foodName: true,
      mealType: true,
      quantity: true,
      unit: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
    },
  });

  // Aggregate totals
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
  Object.keys(totals).forEach((k) => { totals[k] = Math.round(totals[k] * 10) / 10; });

  console.log(`[mealTools.queryEntries] Queried ${entries.length} entries for user ${userId} on ${date}`);

  return {
    success: true,
    date,
    mealType: args.mealType || 'all',
    entryCount: entries.length,
    totals,
    entries: entries.map((e) => ({
      entryId: e.id,
      foodName: e.foodName,
      mealType: e.mealType,
      quantity: e.quantity,
      unit: e.unit,
      calories: e.calories,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
    })),
  };
};

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

const dispatchTool = async (toolName, args, userId) => {
  switch (toolName) {
    case 'logMeal':      return logMeal(userId, args);
    case 'setGoal':      return setGoal(userId, args);
    case 'deleteMeal':   return deleteMeal(userId, args);
    case 'queryEntries': return queryEntries(userId, args);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
};

// ---------------------------------------------------------------------------
// Gemini Function Declarations (schema sent to Gemini)
// ---------------------------------------------------------------------------

const TOOL_DECLARATIONS = [
  {
    name: 'logMeal',
    description: 'Log a food/meal entry for the user. Call this when the user says they ate, consumed, or want to log any food item.',
    parameters: {
      type: 'object',
      properties: {
        foodName:  { type: 'string',  description: 'Name of the food item or dish' },
        mealType:  { type: 'string',  description: 'One of: breakfast, lunch, dinner, snacks' },
        quantity:  { type: 'number',  description: 'Amount consumed' },
        unit:      { type: 'string',  description: 'Unit of measurement: g, ml, cup, piece, serving, bar, slice, etc.' },
        calories:  { type: 'number',  description: 'Estimated calories (kcal). Required.' },
        protein:   { type: 'number',  description: 'Protein in grams' },
        carbs:     { type: 'number',  description: 'Carbohydrates in grams' },
        fat:       { type: 'number',  description: 'Fat in grams' },
        fiber:     { type: 'number',  description: 'Fiber in grams' },
        sugar:     { type: 'number',  description: 'Sugar in grams' },
        sodium:    { type: 'number',  description: 'Sodium in mg' },
        date:      { type: 'string',  description: 'Date as YYYY-MM-DD. Defaults to today if omitted.' },
        notes:     { type: 'string',  description: 'Optional notes about this entry' },
      },
      required: ['foodName', 'mealType', 'calories'],
    },
  },
  {
    name: 'setGoal',
    description: "Set or update the user's daily nutrition goal. Call this when the user wants to set a calorie target or macro goals.",
    parameters: {
      type: 'object',
      properties: {
        dailyCalories: { type: 'number', description: 'Daily calorie target in kcal. Required.' },
        proteinG:      { type: 'number', description: 'Daily protein target in grams' },
        carbsG:        { type: 'number', description: 'Daily carbohydrates target in grams' },
        fatG:          { type: 'number', description: 'Daily fat target in grams' },
        weightGoalKg:  { type: 'number', description: 'Target weight in kg (optional)' },
        notes:         { type: 'string', description: 'Notes about this goal' },
      },
      required: ['dailyCalories'],
    },
  },
  {
    name: 'deleteMeal',
    description: 'Delete a logged food entry. Call this when the user wants to remove or delete a meal they previously logged.',
    parameters: {
      type: 'object',
      properties: {
        entryId:   { type: 'string', description: 'The exact ID of the entry to delete (preferred if known)' },
        foodName:  { type: 'string', description: 'Name of the food to search and delete (used if entryId is unknown)' },
        mealType:  { type: 'string', description: 'Meal type to narrow the search: breakfast, lunch, dinner, snacks' },
        date:      { type: 'string', description: 'Date as YYYY-MM-DD. Defaults to today.' },
      },
      required: [],
    },
  },
  {
    name: 'queryEntries',
    description: "Query the user's food log entries and get calorie/macro totals for a given date. Call this when the user asks what they have eaten, their calorie count, remaining calories, or macro breakdown.",
    parameters: {
      type: 'object',
      properties: {
        date:      { type: 'string', description: 'Date as YYYY-MM-DD. Defaults to today.' },
        mealType:  { type: 'string', description: 'Filter by meal type: breakfast, lunch, dinner, snacks. Omit for all meals.' },
        foodName:  { type: 'string', description: 'Filter by food name (partial match).' },
      },
      required: [],
    },
  },
];

module.exports = { dispatchTool, TOOL_DECLARATIONS, logMeal, setGoal, deleteMeal, queryEntries };
