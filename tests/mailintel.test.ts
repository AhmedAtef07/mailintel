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
    expect(result.provider).toBe('google');
    expect(result.domain).toBe('gmail.com');
    expect(result.isFree).toBe(true);
    expect(result.type).toBe('free');
    expect(result.status).toBe('ok');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('known-domain');
    expect(result.hasMx).toBe(true);
    expect(result.mxChecked).toBe(false);
    expect(result.mx).toBeNull();
    expect(result.providerDisplayName).toBe('Google Workspace');
    expect(result.connection).not.toBeNull();
    expect(result.connection!.imap.host).toBe('imap.gmail.com');
    expect(result.connection!.imap.security).toBe('tls');
    expect(result.connection!.smtp.host).toBe('smtp.gmail.com');
    expect(result.connection!.username).toBe('user@gmail.com');
    expect(result.connection!.usernameTemplate).toBe('%EMAILADDRESS%');
  });

  it('should resolve custom domain via MX lookup', async () => {
    const fetch = mockFetchForMx(['10 mx.zoho.com.']);
    const mi = createMailintel({ fetch });
    const result = await mi('user@customdomain.com');

    expect(result.provider).toBe('zoho');
    expect(result.hasMx).toBe(true);
    expect(result.mxChecked).toBe(true);
    expect(result.mx).toBe('mx.zoho.com');
    expect(result.status).toBe('ok');
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
    const result = await mi('user@somedomain.com');

    expect(result.hasMx).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.connection).not.toBeNull();
    expect(result.connection!.imap.host).toBe('imap.custom.com');
    expect(result.confidence).toBe('medium');
  });

  it('should return no-mx-records status for domain with no MX', async () => {
    const fetch = mockFetchEmpty();
    const mi = createMailintel({ fetch });
    const result = await mi('user@mystery-host.com');

    expect(result.provider).toBeNull();
    expect(result.connection).toBeNull();
    expect(result.hasMx).toBe(false);
    expect(result.mxChecked).toBe(true);
    expect(result.type).toBe('unknown');
    expect(result.status).toBe('no-mx-records');
    expect(result.confidence).toBe('low');
  });

  it('should return unknown-provider status when MX found but no settings', async () => {
    const fetch = mockFetchForMx(['10 mx.unknownprovider.net.']);
    const mi = createMailintel({ fetch, ispdb: false });
    const result = await mi('user@somedomain.com');

    expect(result.hasMx).toBe(true);
    expect(result.connection).toBeNull();
    expect(result.status).toBe('unknown-provider');
  });

  it('should return lookup-disabled status when mxLookup is false', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({ fetch, mxLookup: false });
    const result = await mi('user@unknowndomain.com');

    expect(fetch).not.toHaveBeenCalled();
    expect(result.status).toBe('lookup-disabled');
    expect(result.connection).toBeNull();
  });

  it('should handle array input', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({ fetch });
    const results = await mi(['user@gmail.com', 'user@outlook.com']);

    expect(results).toHaveLength(2);
    expect(results[0].provider).toBe('google');
    expect(results[1].provider).toBe('microsoft');
    expect(results[1].connection!.imap.host).toBe('imap-mail.outlook.com');
    expect(results[1].connection!.smtp.host).toBe('smtp-mail.outlook.com');
  });

  it('should use user domain override first', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({
      fetch,
      providers: {
        'mycompany.com': {
          provider: 'internal',
          imap: { host: 'imap.mycompany.com', port: 993, security: 'tls' },
          smtp: { host: 'smtp.mycompany.com', port: 465, security: 'tls' },
        },
      },
    });

    const result = await mi('user@mycompany.com');
    expect(fetch).not.toHaveBeenCalled();
    expect(result.provider).toBe('internal');
    expect(result.status).toBe('ok');
    expect(result.source).toBe('override');
    expect(result.connection!.imap.host).toBe('imap.mycompany.com');
  });

  it('should use user MX override', async () => {
    const fetch = mockFetchForMx(['10 mail.privateemail.com.']);
    const mi = createMailintel({
      fetch,
      mxOverrides: {
        'privateemail.com': {
          provider: 'namecheap',
          imap: { host: 'mail.privateemail.com', port: 993, security: 'tls' },
          smtp: { host: 'mail.privateemail.com', port: 465, security: 'tls' },
        },
      },
    });

    const result = await mi('user@somesite.com');
    expect(result.provider).toBe('namecheap');
    expect(result.status).toBe('ok');
    expect(result.connection!.imap.host).toBe('mail.privateemail.com');
  });

  it('should handle Zoho regional variant (zoho.eu)', async () => {
    const fetch = mockFetchForMx(['10 mx.zoho.eu.']);
    const mi = createMailintel({ fetch });
    const result = await mi('user@eucompany.com');

    expect(result.provider).toBe('zoho');
    expect(result.status).toBe('ok');
    expect(result.connection!.imap.host).toBe('imappro.zoho.eu');
    expect(result.connection!.smtp.host).toBe('smtppro.zoho.eu');
  });

  it('should use the Zoho region for a known regional domain without DNS', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({ fetch });

    for (const [domain, imap, smtp] of [
      ['zoho.eu', 'imappro.zoho.eu', 'smtppro.zoho.eu'],
      ['zoho.in', 'imappro.zoho.in', 'smtppro.zoho.in'],
      ['zoho.com.au', 'imappro.zoho.com.au', 'smtppro.zoho.com.au'],
      ['zoho.jp', 'imappro.zoho.jp', 'smtppro.zoho.jp'],
      ['zohocloud.ca', 'imappro.zohocloud.ca', 'smtppro.zohocloud.ca'],
      ['zoho.com.cn', 'imappro.zoho.com.cn', 'smtppro.zoho.com.cn'],
    ] as const) {
      const result = await mi(`user@${domain}`);
      expect(result.provider).toBe('zoho');
      expect(result.connection!.imap.host).toBe(imap);
      expect(result.connection!.smtp.host).toBe(smtp);
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should use business endpoints for Microsoft 365 custom domains', async () => {
    const fetch = mockFetchForMx(['10 contoso-com.mail.protection.outlook.com.']);
    const mi = createMailintel({ fetch });
    const result = await mi('user@contoso.com');

    expect(result.provider).toBe('microsoft');
    expect(result.mxChecked).toBe(true);
    expect(result.connection!.imap.host).toBe('outlook.office365.com');
    expect(result.connection!.smtp.host).toBe('smtp.office365.com');
    expect(result.connection!.smtp.security).toBe('starttls');
  });

  it('should return settings for GMX, WEB.DE, mail.com and Mail.ru', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({ fetch });

    const gmx = await mi('user@gmx.com');
    expect(gmx.provider).toBe('gmx');
    expect(gmx.connection!.imap.host).toBe('imap.gmx.com');
    expect(gmx.connection!.smtp.host).toBe('mail.gmx.com');

    const gmxDe = await mi('user@gmx.de');
    expect(gmxDe.provider).toBe('gmx');
    expect(gmxDe.connection!.imap.host).toBe('imap.gmx.net');
    expect(gmxDe.connection!.smtp.host).toBe('mail.gmx.net');

    const webde = await mi('user@web.de');
    expect(webde.provider).toBe('webde');
    expect(webde.connection!.imap.host).toBe('imap.web.de');
    expect(webde.connection!.smtp.host).toBe('smtp.web.de');

    const mailcom = await mi('user@mail.com');
    expect(mailcom.provider).toBe('mailcom');
    expect(mailcom.connection!.imap.host).toBe('imap.mail.com');
    expect(mailcom.connection!.smtp.host).toBe('smtp.mail.com');

    const mailru = await mi('user@mail.ru');
    expect(mailru.provider).toBe('mailru');
    expect(mailru.connection!.imap.host).toBe('imap.mail.ru');
    expect(mailru.connection!.smtp.host).toBe('smtp.mail.ru');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should explain providers without standard IMAP/SMTP instead of guessing', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({ fetch });

    for (const domain of ['tutanota.com', 'hey.com']) {
      const result = await mi(`user@${domain}`);
      expect(result.connection).toBeNull();
      expect(result.status).toBe('unknown-provider');
      expect(result.note).toBeTruthy();
    }
  });

  it('should note that Proton requires the local Bridge', async () => {
    const fetch = vi.fn();
    const mi = createMailintel({ fetch });
    const result = await mi('user@proton.me');

    expect(result.connection!.imap.host).toBe('127.0.0.1');
    expect(result.note).toContain('Bridge');
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

  it('should treat input without @ as domain', async () => {
    const fetch = mockFetchForMx(['10 mx.zoho.com.']);
    const mi = createMailintel({ fetch });
    const result = await mi('customdomain.com');

    expect(result.email).toBe('');
    expect(result.domain).toBe('customdomain.com');
    expect(result.provider).toBe('zoho');
    expect(result.status).toBe('ok');
    expect(result.connection!.username).toBe('%EMAILADDRESS%');
    expect(result.connection!.usernameTemplate).toBe('%EMAILADDRESS%');
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
