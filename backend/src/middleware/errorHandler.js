const { Prisma } = require('@prisma/client');

/**
 * Central error-handling middleware.
 * Must be registered LAST in the Express middleware chain.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Prisma unique constraint violation (e.g. duplicate email)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      const field = err.meta?.target?.[0] || 'field';
      message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found.';
    } else {
      statusCode = 400;
      message = 'Database request error.';
    }
  }

  // Prisma validation error
  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided.';
  }

  // Only log unexpected server errors, not intentional client errors (4xx)
  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    console.error('[Server Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Create an error with a custom status code.
 */
const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { errorHandler, createError };
