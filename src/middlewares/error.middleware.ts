import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { getTraceId } from '../utils/asyncStorage';
import { logger } from '../utils/logger';

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const traceId = getTraceId() || 'unknown';

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  } else if (err.name === 'SyntaxError' && 'status' in err && err.status === 400) {
    // Catch malformed JSON payloads from Express JSON parser
    statusCode = 400;
    code = 'MALFORMED_REQUEST';
    message = 'Malformed JSON request body';
  }

  // Log error with context
  logger.error('Unhandled request error', {
    error: err.message || err,
    stack: err.stack,
    statusCode,
    code,
    path: req.path,
    method: req.method
  });

  res.status(statusCode).json({
    traceId,
    success: false,
    error: {
      code,
      message
    }
  });
}
