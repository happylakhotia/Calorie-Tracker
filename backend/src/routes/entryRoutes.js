const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  getEntries,
  getTodayEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
} = require('../controllers/entryController');

router.use(protect);

router.get('/', getEntries);
router.get('/today', getTodayEntries);
router.get('/:id', getEntry);
router.post('/', validate(schemas.foodEntrySchema), createEntry);
router.put('/:id', validate(schemas.foodEntrySchema), updateEntry);
router.delete('/:id', deleteEntry);

module.exports = router;
