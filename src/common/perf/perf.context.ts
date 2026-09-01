import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestPerfStore {
  dbMs: number;
  dbQueries: number;
  storageMs: number;
  storageOps: number;
}

const storage = new AsyncLocalStorage<RequestPerfStore>();

export function createPerfStore(): RequestPerfStore {
  return {
    dbMs: 0,
    dbQueries: 0,
    storageMs: 0,
    storageOps: 0,
  };
}

export function runWithPerf<T>(store: RequestPerfStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function getPerfStore(): RequestPerfStore | undefined {
  return storage.getStore();
}

export function addPerf(partial: Partial<RequestPerfStore>): void {
  const current = storage.getStore();
  if (!current) return;
  if (typeof partial.dbMs === 'number') current.dbMs += partial.dbMs;
  if (typeof partial.dbQueries === 'number') current.dbQueries += partial.dbQueries;
  if (typeof partial.storageMs === 'number') current.storageMs += partial.storageMs;
  if (typeof partial.storageOps === 'number') current.storageOps += partial.storageOps;
}

export async function measureAsync<T>(kind: 'db' | 'storage', fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    const elapsed = Date.now() - started;
    if (kind === 'db') {
      addPerf({ dbMs: elapsed, dbQueries: 1 });
    } else {
      addPerf({ storageMs: elapsed, storageOps: 1 });
    }
  }
}
