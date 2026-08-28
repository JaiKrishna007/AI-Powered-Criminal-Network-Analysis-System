import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' }
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute for auth endpoints
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts, please try again later.' }
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 API requests per minute
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many API requests, please try again later.' }
});
