const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  analyzeFood,
  chat,
  getChatHistory,
  clearChatHistory,
  importPdf,
  getUploadStatus,
} = require('../controllers/aiController');

// ── Multer memory storage configuration (in-memory for SHA-256 & Cloudinary streaming) ──
const storage = multer.memoryStorage();

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
  },
});

const pdfUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────
router.use(protect);

router.post('/analyze-image', imageUpload.single('image'), analyzeFood);
router.post('/chat', validate(schemas.chatSchema), chat);
router.get('/chat/history', getChatHistory);
router.delete('/chat/history', clearChatHistory);
router.post('/import-pdf', pdfUpload.single('pdf'), importPdf);
router.get('/status/:id', getUploadStatus);

module.exports = router;
