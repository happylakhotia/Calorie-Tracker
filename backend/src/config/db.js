const prisma = require('../lib/prisma');

/**
 * Connect to Supabase PostgreSQL via Prisma.
 */
const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected via Prisma');
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
