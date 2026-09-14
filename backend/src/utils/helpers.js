const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

/**
 * Generate a short-lived JWT access token.
 */
const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/**
 * Generate a cryptographically random refresh token and its expiry date.
 * Default lifetime: 30 days.
 */
const generateRefreshToken = () => {
  const token = crypto.randomBytes(64).toString('hex');
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
};

/**
 * Persist a refresh token in the database.
 */
const saveRefreshToken = (userId, token, expiresAt) =>
  prisma.refreshToken.create({ data: { userId, token, expiresAt } });

/**
 * Return today's date as YYYY-MM-DD string (UTC).
 */
const todayString = () => new Date().toISOString().split('T')[0];

/**
 * Convert any Date or ISO string to YYYY-MM-DD.
 */
const toDateString = (date) => new Date(date).toISOString().split('T')[0];

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  todayString,
  toDateString,
};
