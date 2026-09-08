require('dotenv').config();

const env = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27018/agentops?directConnection=true',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  agentServiceUrl: process.env.AGENT_SERVICE_URL || 'http://localhost:8000',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100
  }
};

// Log configuration in development
// if (env.nodeEnv === 'development') {
//   console.log('Environment Configuration:');
//   console.log(`  Port: ${env.port}`);
//   console.log(`  MongoDB URI: ${env.mongodbUri}`);
//   console.log(`  Redis URL: ${env.redisUrl}`);
// }

module.exports = env;