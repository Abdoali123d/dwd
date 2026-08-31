const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Create rate limiters
const ratelimit = {
  // General API: 120 requests per minute
  general: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, '1 m'),
    prefix: 'ratelimit:general',
  }),

  // BATU login: 5 attempts per 5 minutes
  batuLogin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '5 m'),
    prefix: 'ratelimit:batu',
  }),

  // Gemini API: 30 requests per minute
  gemini: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'ratelimit:gemini',
  }),

  // Bulk import: 10 requests per hour
  bulkImport: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'ratelimit:bulk',
  }),
};

module.exports = { ratelimit, redis };
