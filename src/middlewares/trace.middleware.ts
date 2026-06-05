import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { asyncLocalStorage } from '../utils/asyncStorage';
import { logger } from '../utils/logger';

export function traceMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerTraceId = req.headers['x-trace-id'] || req.headers['x-request-id'];
  const traceId = typeof headerTraceId === 'string' && headerTraceId ? headerTraceId : randomUUID();

  // Attach trace ID to response header
  res.setHeader('x-trace-id', traceId);

  asyncLocalStorage.run({ traceId }, () => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.headers['user-agent']
    });

    res.on('finish', () => {
      logger.info('Response completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      });
    });

    next();
  });
}
