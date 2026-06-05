import { Response } from 'express';
import { getTraceId } from './asyncStorage';

/**
 * Sends a unified JSON success response.
 * @param res Express response object
 * @param data Response payload
 * @param statusCode HTTP status code (defaults to 200)
 */
export function sendSuccess(res: Response, data: any, statusCode: number = 200) {
  const traceId = getTraceId() || 'unknown';
  
  res.status(statusCode).json({
    traceId,
    success: true,
    data
  });
}
