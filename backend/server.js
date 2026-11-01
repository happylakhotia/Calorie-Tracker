require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./src/config/db');
const { errorHandler } = require('./src/middleware/errorHandler');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/authRoutes');
const entryRoutes = require('./src/routes/entryRoutes');
const goalRoutes = require('./src/routes/goalRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const aiRoutes = require('./src/routes/aiRoutes');

const app = express();

// ── Connect to Database ───────────────────────────────────────────────────────
connectDB();

// ── Security & Parsing Middleware ─────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS policy.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Static Files ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Calorie Tracker API is running 🚀', timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ── Central Error Handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ── BullMQ Background Worker (async init with Redis preflight) ───────────────
const { initQueueConnection } = require('./src/config/queue');
const { initFileWorker, getFileWorker } = require('./src/workers/fileWorker');
const { initFileQueue, getFileQueue } = require('./src/queues/fileQueue');

// ── Keep-Alive Cron Jobs ──────────────────────────────────────────────────────
const { registerKeepAliveJobs } = require('./src/jobs/keepAliveJob');

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/health`);

  // Initialize BullMQ asynchronously after server is already accepting requests.
  // The Redis preflight prevents infinite [Worker Error] spam when Redis is down.
  initQueueConnection().then((connection) => {
    if (connection) {
      initFileQueue(connection);
      initFileWorker(connection);
      console.log('🐂 BullMQ Worker active and listening for file processing jobs');
    } else {
      console.warn('⚠️  BullMQ disabled — file upload queuing unavailable (Redis unreachable).');
    }
  }).catch((err) => {
    console.warn('⚠️  BullMQ init error:', err.message);
  });

  // Register keep-alive cron jobs (DB + Redis inactivity prevention)
  registerKeepAliveJobs();
});

// ── Graceful Shutdown Handlers ────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    const worker = getFileWorker();
    const queue = getFileQueue();
    if (worker) {
      await worker.close();
      console.log('BullMQ worker closed.');
    }
    if (queue) {
      await queue.close();
      console.log('BullMQ queue closed.');
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
