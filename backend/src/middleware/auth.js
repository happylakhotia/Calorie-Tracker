const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

/**
 * Protect routes — verifies JWT access token and attaches req.user (without passwordHash).
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const rawUser = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!rawUser) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    // Strip passwordHash so it never leaks into route handlers
    const { passwordHash: _, ...user } = rawUser;
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access token expired. Please refresh your token.' });
    }
    next(error);
  }
};

module.exports = { protect };
