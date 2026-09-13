const Joi = require('joi');

/**
 * Factory: returns Express middleware that validates req.body against a Joi schema.
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map((d) => d.message).join(', ');
    return res.status(400).json({ success: false, message });
  }
  req.body = value; // use sanitised/coerced value
  next();
};

// ── Schema definitions ────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const goalSchema = Joi.object({
  dailyCalories: Joi.number().min(500).required(),
  proteinG: Joi.number().min(0).default(0),
  carbsG: Joi.number().min(0).default(0),
  fatG: Joi.number().min(0).default(0),
  weightGoalKg: Joi.number().min(0).allow(null).default(null),
  targetDate: Joi.date().iso().allow(null).default(null),
  notes: Joi.string().trim().max(500).allow('').default(''),
});

const foodEntrySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snacks').required(),
  foodName: Joi.string().trim().max(200).required(),
  quantity: Joi.number().min(0).required(),
  unit: Joi.string().trim().max(20).default('g'),
  calories: Joi.number().min(0).default(0),
  protein: Joi.number().min(0).default(0),
  carbs: Joi.number().min(0).default(0),
  fat: Joi.number().min(0).default(0),
  fiber: Joi.number().min(0).default(0),
  sugar: Joi.number().min(0).default(0),
  sodium: Joi.number().min(0).default(0),
  potassium: Joi.number().min(0).default(0),
  vitaminC: Joi.number().min(0).default(0),
  vitaminD: Joi.number().min(0).default(0),
  calcium: Joi.number().min(0).default(0),
  iron: Joi.number().min(0).default(0),
  notes: Joi.string().trim().max(500).allow('').default(''),
  source: Joi.string().valid('manual', 'ai', 'pdf').default('manual'),
});

const chatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
});

module.exports = {
  validate,
  schemas: { registerSchema, loginSchema, goalSchema, foodEntrySchema, chatSchema },
};
