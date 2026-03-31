import { describe, it, expect, vi } from 'vitest';
import { lookupMx } from '../src/dns';

function mockFetch(data: object, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
}

describe('lookupMx', () => {
  it('should construct Cloudflare resolver URL', async () => {
    const fetch = mockFetch({ Answer: [] });
    await lookupMx('example.com', { fetch });
    expect(fetch).toHaveBeenCalledWith(
      'https://cloudflare-dns.com/dns-query?name=example.com&type=MX',
      expect.objectContaining({ headers: { Accept: 'application/dns-json' } }),
    );
  });

  it('should construct Google resolver URL', async () => {
    const fetch = mockFetch({ Answer: [] });
    await lookupMx('example.com', { resolver: 'google', fetch });
    expect(fetch).toHaveBeenCalledWith(
      'https://dns.google/resolve?name=example.com&type=MX',
      expect.objectContaining({ headers: { Accept: 'application/dns-json' } }),
    );
  });

  it('should parse MX records from JSON response', async () => {
    const fetch = mockFetch({
      Status: 0,
      Answer: [
        { name: 'example.com', type: 15, TTL: 300, data: '10 mx1.example.com.' },
        { name: 'example.com', type: 15, TTL: 300, data: '20 mx2.example.com.' },
      ],
    });

    const { records } = await lookupMx('example.com', { fetch });
    expect(records).toEqual([
      { priority: 10, exchange: 'mx1.example.com' },
      { priority: 20, exchange: 'mx2.example.com' },
    ]);
  });

  it('should sort records by priority', async () => {
    const fetch = mockFetch({
      Answer: [
        { name: 'example.com', type: 15, TTL: 300, data: '30 mx3.example.com.' },
        { name: 'example.com', type: 15, TTL: 300, data: '10 mx1.example.com.' },
        { name: 'example.com', type: 15, TTL: 300, data: '20 mx2.example.com.' },
      ],
    });

    const { records } = await lookupMx('example.com', { fetch });
    expect(records[0].priority).toBe(10);
    expect(records[1].priority).toBe(20);
    expect(records[2].priority).toBe(30);
  });

  it('should filter non-MX record types', async () => {
    const fetch = mockFetch({
      Answer: [
        { name: 'example.com', type: 1, TTL: 300, data: '1.2.3.4' },
        { name: 'example.com', type: 15, TTL: 300, data: '10 mx.example.com.' },
      ],
    });

    const { records } = await lookupMx('example.com', { fetch });
    expect(records).toHaveLength(1);
    expect(records[0].exchange).toBe('mx.example.com');
  });

  it('should handle empty response', async () => {
    const fetch = mockFetch({ Status: 0 });
    const { records } = await lookupMx('example.com', { fetch });
    expect(records).toEqual([]);
  });

  it('should handle non-ok response', async () => {
    const fetch = mockFetch({}, false);
    const { records } = await lookupMx('example.com', { fetch });
    expect(records).toEqual([]);
  });

  it('should handle fetch error', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { records } = await lookupMx('example.com', { fetch });
    expect(records).toEqual([]);
  });

  it('should handle timeout via AbortController', async () => {
    const fetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const { records } = await lookupMx('example.com', { fetch, timeout: 1 });
    expect(records).toEqual([]);
  });
});
