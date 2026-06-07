import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Standard rate limit envelope handler
const standardLimitHandler = (message: string) => {
  return (req: Request, res: Response) => {
    res.status(429).json({
      traceId: req.headers['x-trace-id'] || 'trace-system',
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message
      }
    });
  };
};

// Global rate limiter applied to all routes
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per 15 minutes
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: standardLimitHandler('Too many requests from this IP. Please try again later.')
});

// Strict rate limiter for Authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 register/login requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardLimitHandler('Too many authentication attempts from this IP. Please try again after 15 minutes.')
});

// Limiter for expensive AI analysis calls
export const analyzeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 Groq requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardLimitHandler('Too many AI analysis requests from this IP. Please try again after 5 minutes.')
});
