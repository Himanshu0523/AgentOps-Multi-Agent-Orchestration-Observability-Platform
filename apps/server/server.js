const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const redisClient = require('./src/config/redis');
const socketGateway = require('./src/sockets/socketGateway');

// Create HTTP server
const server = http.createServer(app);

// Connect to MongoDB
connectDB().then(() => {
  // Initialize Socket.IO
  socketGateway.initialize(server);

  // Start server
  server.listen(env.port, () => {
    console.log(`✓ Server running in ${env.nodeEnv} mode on port ${env.port}`);
    console.log(`✓ Socket.IO active on port ${env.port}`);
  });
}).catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => {
    socketGateway.close();
    if (redisClient && redisClient.quit) {
      redisClient.quit();
    }
    process.exit(1);
  });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    socketGateway.close();
    if (redisClient && redisClient.quit) {
      redisClient.quit();
    }
    console.log('Process terminated.');
    process.exit(0);
  });
});
