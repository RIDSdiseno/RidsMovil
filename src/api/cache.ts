type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const DEFAULT_TTL_MS = Number.POSITIVE_INFINITY;
const cache = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

type CacheOptions = {
  force?: boolean;
  ttlMs?: number;
};

export async function cachedRequest<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (!options.force && cached && cached.expiresAt > now) {
    return cached.data;
  }

  if (!options.force) {
    const currentPending = pending.get(key) as Promise<T> | undefined;
    if (currentPending) return currentPending;
  }

  const request = loader()
    .then((data) => {
      cache.set(key, {
        data,
        expiresAt: Date.now() + (options.ttlMs ?? DEFAULT_TTL_MS),
      });
      return data;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, request);
  return request;
}

export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cache.clear();
    pending.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      cache.delete(key);
    }
  }

  for (const key of pending.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      pending.delete(key);
    }
  }
}

export function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.data;
}
