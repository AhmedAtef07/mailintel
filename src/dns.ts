import { MxRecord } from './types';

const RESOLVERS = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/resolve',
} as const;

export async function lookupMx(
  domain: string,
  options: {
    resolver?: 'cloudflare' | 'google';
    timeout?: number;
    fetch?: typeof globalThis.fetch;
  } = {},
): Promise<{ records: MxRecord[]; raw: object }> {
  const resolver = options.resolver ?? 'cloudflare';
  const timeout = options.timeout ?? 5000;
  const fetchFn = options.fetch ?? globalThis.fetch;
  const url = `${RESOLVERS[resolver]}?name=${encodeURIComponent(domain)}&type=MX`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetchFn(url, {
      headers: { Accept: 'application/dns-json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { records: [], raw: {} };
    }

    const data = await response.json();
    const records: MxRecord[] = (data.Answer ?? [])
      .filter((r: { type: number }) => r.type === 15)
      .map((r: { data: string }) => {
        const parts = r.data.split(' ');
        return {
          priority: parseInt(parts[0], 10),
          exchange: parts[1]?.replace(/\.$/, '') ?? '',
        };
      })
      .sort((a: MxRecord, b: MxRecord) => a.priority - b.priority);

    return { records, raw: data };
  } catch {
    return { records: [], raw: {} };
  } finally {
    clearTimeout(timer);
  }
}
