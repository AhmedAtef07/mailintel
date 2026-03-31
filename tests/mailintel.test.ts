import { describe, it, expect, vi } from 'vitest';
import { createMailintel } from '../src/factory';

function mockFetchForMx(mxData: string[], ispdbXml?: string) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('dns-query') || url.includes('dns.google')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            Status: 0,
            Answer: mxData.map((data) => ({
              name: 'test.com',
              type: 15,
              TTL: 300,
              data,
            })),
          }),
      });
    }
    if (url.includes('autoconfig.thunderbird.net')) {
      if (!ispdbXml) {
        return Promise.resolve({ ok: false, text: () => Promise.resolve('') });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(ispdbXml),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  });
}

function mockFetchEmpty() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('dns-query') || url.includes('dns.google')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ Status: 0 }),
      });
    }
    return Promise.resolve({ ok: false, text: () => Promise.resolve('') });
  });
}

describe('mailintel', () => {
  it('should resolve known domain (gmail.com) instantly', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({ fetch });
    const result = await mi('user@gmail.com');

    expect(fetch).not.toHaveBeenCalled();
    expect(result).not.toBeInstanceOf(Array);
    const r = result as Awaited<ReturnType<typeof mi>> & { provider: string };
    expect(r.provider).toBe('google');
    expect(r.domain).toBe('gmail.com');
    expect(r.isFree).toBe(true);
    expect(r.type).toBe('free');
    expect(r.confidence).toBe('high');
    expect(r.source).toBe('known-domain');
    expect(r.connection).not.toBeNull();
    expect(r.connection!.imap.host).toBe('imap.gmail.com');
    expect(r.connection!.smtp.host).toBe('smtp.gmail.com');
  });

  it('should resolve custom domain via MX lookup', async () => {
    const fetch = mockFetchForMx(['10 mx.zoho.com.']);
    const mi = createMailintel({ fetch });
    const result = (await mi('user@customdomain.com')) as any;

    expect(result.provider).toBe('zoho');
    expect(result.hasMx).toBe(true);
    expect(result.mx).toBe('mx.zoho.com');
    expect(result.source).toBe('mx-lookup');
    expect(result.confidence).toBe('high');
    expect(result.connection!.imap.host).toBe('imappro.zoho.com');
  });

  it('should fallback to ISPDB when provider not in KNOWN_PROVIDERS', async () => {
    const ispdbXml = `<clientConfig>
      <emailProvider>
        <incomingServer type="imap">
          <hostname>imap.custom.com</hostname>
          <port>993</port>
          <socketType>SSL</socketType>
          <username>%EMAILADDRESS%</username>
        </incomingServer>
        <outgoingServer type="smtp">
          <hostname>smtp.custom.com</hostname>
          <port>587</port>
          <socketType>STARTTLS</socketType>
          <username>%EMAILADDRESS%</username>
        </outgoingServer>
      </emailProvider>
    </clientConfig>`;

    const fetch = mockFetchForMx(['10 mx.unknownprovider.net.'], ispdbXml);
    const mi = createMailintel({ fetch });
    const result = (await mi('user@somedomain.com')) as any;

    expect(result.hasMx).toBe(true);
    expect(result.connection).not.toBeNull();
    expect(result.connection.imap.host).toBe('imap.custom.com');
    expect(result.confidence).toBe('medium');
  });

  it('should return null provider for unknown domain with no MX', async () => {
    const fetch = mockFetchEmpty();
    const mi = createMailintel({ fetch });
    const result = (await mi('user@mystery-host.com')) as any;

    expect(result.provider).toBeNull();
    expect(result.connection).toBeNull();
    expect(result.hasMx).toBe(false);
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe('low');
  });

  it('should handle array input', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({ fetch });
    const results = await mi(['user@gmail.com', 'user@outlook.com']);

    expect(Array.isArray(results)).toBe(true);
    const arr = results as any[];
    expect(arr).toHaveLength(2);
    expect(arr[0].provider).toBe('google');
    expect(arr[1].provider).toBe('microsoft');
  });

  it('should use user domain override first', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({
      fetch,
      providers: {
        'mycompany.com': {
          provider: 'internal',
          imap: { host: 'imap.mycompany.com', port: 993, secure: true },
          smtp: { host: 'smtp.mycompany.com', port: 465, secure: true },
        },
      },
    });

    const result = (await mi('user@mycompany.com')) as any;
    expect(fetch).not.toHaveBeenCalled();
    expect(result.provider).toBe('internal');
    expect(result.source).toBe('override');
    expect(result.connection.imap.host).toBe('imap.mycompany.com');
  });

  it('should use user MX override', async () => {
    const fetch = mockFetchForMx(['10 mail.privateemail.com.']);
    const mi = createMailintel({
      fetch,
      mxOverrides: {
        'privateemail.com': {
          provider: 'namecheap',
          imap: { host: 'mail.privateemail.com', port: 993, secure: true },
          smtp: { host: 'mail.privateemail.com', port: 465, secure: true },
        },
      },
    });

    const result = (await mi('user@somesite.com')) as any;
    expect(result.provider).toBe('namecheap');
    expect(result.connection.imap.host).toBe('mail.privateemail.com');
  });

  it('should handle Zoho regional variant (zoho.eu)', async () => {
    const fetch = mockFetchForMx(['10 mx.zoho.eu.']);
    const mi = createMailintel({ fetch });
    const result = (await mi('user@eucompany.com')) as any;

    expect(result.provider).toBe('zoho');
    expect(result.connection.imap.host).toBe('imappro.zoho.eu');
    expect(result.connection.smtp.host).toBe('smtppro.zoho.eu');
  });

  it('should cache results by domain', async () => {
    const fetch = mockFetchForMx(['10 mx.zoho.com.']);
    const mi = createMailintel({ fetch });

    await mi('alice@customdomain.com');
    await mi('bob@customdomain.com');

    // Only one DNS call should be made (second is cached)
    const dnsCallCount = fetch.mock.calls.filter(
      (c: string[]) => c[0].includes('dns-query') || c[0].includes('dns.google'),
    ).length;
    expect(dnsCallCount).toBe(1);
  });

  it('should respect cache: false option', async () => {
    const fetch = mockFetchForMx(['10 mx.zoho.com.']);
    const mi = createMailintel({ fetch, cache: false });

    await mi('alice@customdomain.com');
    await mi('bob@customdomain.com');

    const dnsCallCount = fetch.mock.calls.filter(
      (c: string[]) => c[0].includes('dns-query') || c[0].includes('dns.google'),
    ).length;
    expect(dnsCallCount).toBe(2);
  });

  it('should handle invalid email gracefully', async () => {
    const mi = createMailintel();
    const result = (await mi('notanemail')) as any;
    expect(result.provider).toBeNull();
    expect(result.domain).toBe('');
  });

  it('clearCache should work', async () => {
    const fetch = mockFetchForMx(['10 mx.zoho.com.']);
    const mi = createMailintel({ fetch });

    await mi('user@customdomain.com');
    mi.clearCache();
    await mi('user@customdomain.com');

    const dnsCallCount = fetch.mock.calls.filter(
      (c: string[]) => c[0].includes('dns-query') || c[0].includes('dns.google'),
    ).length;
    expect(dnsCallCount).toBe(2);
  });
});
