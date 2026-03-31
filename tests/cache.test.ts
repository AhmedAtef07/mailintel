import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache } from '../src/cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set and get a value', () => {
    cache.set('key', 'value', 60000);
    expect(cache.get('key')).toBe('value');
  });

  it('should return null for missing keys', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('should expire entries after TTL', () => {
    cache.set('key', 'value', 1000);
    expect(cache.get('key')).toBe('value');

    vi.advanceTimersByTime(1001);
    expect(cache.get('key')).toBeNull();
  });

  it('should clear all entries', () => {
    cache.set('a', '1', 60000);
    cache.set('b', '2', 60000);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
  });
});
