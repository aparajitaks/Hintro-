import { createLogger, format, transports } from 'winston';
import { getTraceId } from './asyncStorage';

// Custom format to inject the current trace ID from AsyncLocalStorage
const injectTraceId = format((info) => {
  const traceId = getTraceId();
  if (traceId) {
    info.traceId = traceId;
  }
  return info;
});

export const logger = createLogger({
  level: process.env.NODE_ENV === 'test' ? 'error' : 'info',
  format: format.combine(
    injectTraceId(),
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console()
  ]
});
