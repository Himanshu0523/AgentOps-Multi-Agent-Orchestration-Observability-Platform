const Redis = require('ioredis');
const env = require('./env');

// console.log(`Connecting to Redis at: ${env.redisUrl}`);

const redisClient = new Redis(env.redisUrl, {
  retryStrategy: (times) => {
    // Stop retrying after 5 attempts
    if (times > 5) {
      console.error('Redis connection failed after 5 attempts. Is Redis running?');
      return null; // stop retrying
    }
    const delay = Math.min(times * 1000, 5000);
    console.log(`Redis retry attempt ${times} in ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false
});

redisClient.on('connect', () => {
  console.log('Redis Connected ✓');
});

redisClient.on('ready', () => {
  console.log('Redis Ready ✓');
});

redisClient.on('error', (error) => {
  console.error(`Redis Error: ${error.message}`);
});

redisClient.on('close', () => {
  console.log('Redis connection closed');
});

module.exports = redisClient;