import { AsyncLocalStorage } from 'async_hooks';

export interface TraceContext {
  traceId: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<TraceContext>();

export function getTraceId(): string | undefined {
  return asyncLocalStorage.getStore()?.traceId;
}
