// In-process TTL cache. Stands in for Redis (LLD §4.5) until the worker is split out;
// keys follow the same naming so the swap is mechanical.
const TTL_MS = 10 * 60 * 1000;

const store = new Map<string, { value: unknown; expires: number }>();

export const cache = {
  async getOrSet<T>(key: string, load: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const value = await load();
    store.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  },
  del(key: string) {
    store.delete(key);
  },
  delPrefix(prefix: string) {
    for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
  },
};
