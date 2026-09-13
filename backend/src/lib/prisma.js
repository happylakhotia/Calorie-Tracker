const { PrismaClient } = require('@prisma/client');

// Reuse the same PrismaClient instance across hot-reloads in development
const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = prisma;
