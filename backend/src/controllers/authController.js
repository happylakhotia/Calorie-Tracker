const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshToken, saveRefreshToken } = require('../utils/helpers');
const { createError } = require('../middleware/errorHandler');

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(createError('An account with this email already exists.', 409));

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });

    const accessToken = generateAccessToken(user.id);
    const { token: refreshToken, expiresAt } = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken, expiresAt);

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      accessToken,
      refreshToken,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return next(createError('Invalid email or password.', 401));
    }

    const accessToken = generateAccessToken(user.id);
    const { token: refreshToken, expiresAt } = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken, expiresAt);

    const { passwordHash: _, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Logged in successfully.',
      accessToken,
      refreshToken,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Exchange a valid refresh token for a new access token.
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(createError('Refresh token is required.', 400));

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!stored) return next(createError('Invalid refresh token.', 401));

    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      return next(createError('Refresh token expired. Please log in again.', 401));
    }

    const accessToken = generateAccessToken(stored.userId);
    res.json({ success: true, accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Invalidate the provided refresh token.
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  // req.user already has passwordHash stripped by protect middleware
  res.json({ success: true, user: req.user });
};

module.exports = { register, login, refresh, logout, getMe };
