const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  weeklyCalories,
  macroBreakdown,
  microSummary,
  goalComparison,
  mealDistribution,
} = require('../controllers/reportController');

router.use(protect);

router.get('/weekly-calories', weeklyCalories);
router.get('/macros', macroBreakdown);
router.get('/micros', microSummary);
router.get('/goal-comparison', goalComparison);
router.get('/meal-distribution', mealDistribution);

module.exports = router;
