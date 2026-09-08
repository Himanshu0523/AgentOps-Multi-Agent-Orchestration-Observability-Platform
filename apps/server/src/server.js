const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

// Connect to MongoDB
connectDB().then(() => {
  const server = app.listen(env.port, () => {
    console.log(`✓ Server running in ${env.nodeEnv} mode on port ${env.port}`);
  });

  try {
    const redisClient = require('./src/config/redis');
    console.log('Redis initialization attempted');
  } catch (error) {
    console.warn('Redis not available, continuing without it');
  }

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    server.close(() => {
      process.exit(1);
    });
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Process terminated.');
      process.exit(0);
    });
  });
});