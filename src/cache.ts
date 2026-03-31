interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttl: number): void {
    this.store.set(key, { value, expires: Date.now() + ttl });
  }

  clear(): void {
    this.store.clear();
  }
}
