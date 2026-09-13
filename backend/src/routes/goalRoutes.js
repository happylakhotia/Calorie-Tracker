const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  getActiveGoal,
  createGoal,
  getGoalHistory,
  updateGoal,
  deleteGoal,
} = require('../controllers/goalController');

router.use(protect); // All goal routes require auth

router.get('/', getActiveGoal);
router.post('/', validate(schemas.goalSchema), createGoal);
router.get('/history', getGoalHistory);
router.put('/:id', validate(schemas.goalSchema), updateGoal);
router.delete('/:id', deleteGoal);

module.exports = router;
