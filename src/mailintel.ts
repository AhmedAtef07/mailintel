import { MailintelOptions, MailintelResult, ConnectionInfo, RawConnectionInfo } from './types';
import { Cache } from './cache';
import { lookupMx } from './dns';
import { lookupIspdb } from './ispdb';
import { KNOWN_DOMAINS } from './data/domains';
import { KNOWN_MX } from './data/mx';
import { KNOWN_PROVIDERS, REGIONAL_PROVIDERS } from './data/providers';
import { FREE_DOMAINS } from './data/free';

function resolveUsername(template: string, email: string, domain: string): string {
  return template
    .replace('%EMAILADDRESS%', email)
    .replace('%EMAILLOCALPART%', email.split('@')[0] ?? '')
    .replace('%EMAILDOMAIN%', domain);
}

function resolveConnection(raw: RawConnectionInfo, email: string, domain: string): ConnectionInfo {
  return {
    imap: raw.imap,
    smtp: raw.smtp,
    username: email ? resolveUsername(raw.username, email, domain) : raw.username,
    usernameTemplate: raw.username,
  };
}

export async function mailintelCore(
  input: string,
  options: MailintelOptions,
  cache: Cache<MailintelResult> | null,
  cacheTtl: number,
): Promise<MailintelResult> {
  const atIndex = input.lastIndexOf('@');
  const isDomainOnly = atIndex === -1;
  const email = isDomainOnly ? '' : input;
  const domain = isDomainOnly ? input.toLowerCase() : input.slice(atIndex + 1).toLowerCase();

  if (!domain) {
    return emptyResult(email, '');
  }

  // Check cache
  if (cache) {
    const cached = cache.get(domain);
    if (cached) {
      return { ...cached, email };
    }
  }

  // Check user domain overrides
  if (options.providers?.[domain]) {
    const override = options.providers[domain];
    const result: MailintelResult = {
      email,
      domain,
      provider: override.provider,
      mx: null,
      type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
      isFree: FREE_DOMAINS.has(domain),
      hasMx: false,
      connection: resolveConnection(
        { imap: override.imap, smtp: override.smtp, username: override.username ?? '%EMAILADDRESS%' },
        email,
        domain,
      ),
      status: 'ok',
      confidence: 'high',
      source: 'override',
      raw: { mx: null, dns: null, ispdb: null },
    };
    cache?.set(domain, result, cacheTtl);
    return result;
  }

  // Check KNOWN_DOMAINS
  const knownProvider = KNOWN_DOMAINS[domain];
  if (knownProvider) {
    const connection = KNOWN_PROVIDERS[knownProvider] ?? null;
    const result: MailintelResult = {
      email,
      domain,
      provider: knownProvider,
      mx: null,
      type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
      isFree: FREE_DOMAINS.has(domain),
      hasMx: false,
      connection: connection ? resolveConnection(connection, email, domain) : null,
      status: connection ? 'ok' : 'unknown-provider',
      confidence: 'high',
      source: 'known-domain',
      raw: { mx: null, dns: null, ispdb: null },
    };
    cache?.set(domain, result, cacheTtl);
    return result;
  }

  // MX lookup
  if (options.mxLookup === false) {
    const result: MailintelResult = {
      ...emptyResult(email, domain),
      status: 'lookup-disabled',
    };
    cache?.set(domain, result, cacheTtl);
    return result;
  }

  const resolver = options.mxLookup === 'google' ? 'google' : 'cloudflare';
  const { records: mxRecords, raw: dnsRaw } = await lookupMx(domain, {
    resolver,
    timeout: options.timeout,
    fetch: options.fetch,
  });

  if (mxRecords.length === 0) {
    const result: MailintelResult = {
      email,
      domain,
      provider: null,
      mx: null,
      type: 'unknown',
      isFree: false,
      hasMx: false,
      connection: null,
      status: 'no-mx-records',
      confidence: 'low',
      source: null,
      raw: { mx: [], dns: dnsRaw, ispdb: null },
    };
    cache?.set(domain, result, cacheTtl);
    return result;
  }

  const primaryMx = mxRecords[0].exchange;

  // Check user MX overrides
  if (options.mxOverrides) {
    for (const [suffix, override] of Object.entries(options.mxOverrides)) {
      if (primaryMx === suffix || primaryMx.endsWith('.' + suffix)) {
        const result: MailintelResult = {
          email,
          domain,
          provider: override.provider,
          mx: primaryMx,
          type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
          isFree: FREE_DOMAINS.has(domain),
          hasMx: true,
          connection: resolveConnection(
            { imap: override.imap, smtp: override.smtp, username: override.username ?? '%EMAILADDRESS%' },
            email,
            domain,
          ),
          status: 'ok',
          confidence: 'high',
          source: 'mx-lookup',
          raw: { mx: mxRecords, dns: dnsRaw, ispdb: null },
        };
        cache?.set(domain, result, cacheTtl);
        return result;
      }
    }
  }

  // Check KNOWN_MX by suffix matching
  let mxProvider: string | null = null;
  let matchedMxSuffix: string | null = null;

  for (const [suffix, provider] of Object.entries(KNOWN_MX)) {
    if (primaryMx === suffix || primaryMx.endsWith('.' + suffix)) {
      mxProvider = provider;
      matchedMxSuffix = suffix;
      break;
    }
  }

  if (mxProvider) {
    let connection: RawConnectionInfo | null = KNOWN_PROVIDERS[mxProvider] ?? null;
    let ispdbRaw: string | null = null;
    let confidence: 'high' | 'medium' | 'low' = connection ? 'high' : 'low';

    // Apply regional variants
    if (connection && matchedMxSuffix) {
      const regional = REGIONAL_PROVIDERS[mxProvider];
      if (regional) {
        for (const [regionSuffix, regionConfig] of Object.entries(regional)) {
          if (matchedMxSuffix === regionSuffix || matchedMxSuffix.endsWith('.' + regionSuffix)) {
            connection = {
              ...connection,
              imap: { ...connection.imap, host: regionConfig.imapHost },
              smtp: { ...connection.smtp, host: regionConfig.smtpHost },
            };
            break;
          }
        }
      }
    }

    // Fallback to ISPDB if no known provider settings
    if (!connection && options.ispdb !== false) {
      const ispdbResult = await lookupIspdb(domain, {
        timeout: options.timeout,
        fetch: options.fetch,
      });
      connection = ispdbResult.connection;
      ispdbRaw = ispdbResult.raw;
      if (connection) {
        confidence = 'medium';
      }
    }

    const result: MailintelResult = {
      email,
      domain,
      provider: mxProvider,
      mx: primaryMx,
      type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
      isFree: FREE_DOMAINS.has(domain),
      hasMx: true,
      connection: connection ? resolveConnection(connection, email, domain) : null,
      status: connection ? 'ok' : 'unknown-provider',
      confidence,
      source: 'mx-lookup',
      raw: { mx: mxRecords, dns: dnsRaw, ispdb: ispdbRaw },
    };
    cache?.set(domain, result, cacheTtl);
    return result;
  }

  // No known MX match - try ISPDB
  let connection: RawConnectionInfo | null = null;
  let ispdbRaw: string | null = null;

  if (options.ispdb !== false) {
    const ispdbResult = await lookupIspdb(domain, {
      timeout: options.timeout,
      fetch: options.fetch,
    });
    connection = ispdbResult.connection;
    ispdbRaw = ispdbResult.raw;
  }

  const result: MailintelResult = {
    email,
    domain,
    provider: null,
    mx: primaryMx,
    type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
    isFree: FREE_DOMAINS.has(domain),
    hasMx: true,
    connection: connection ? resolveConnection(connection, email, domain) : null,
    status: connection ? 'ok' : 'unknown-provider',
    confidence: connection ? 'medium' : 'low',
    source: connection ? 'mx-lookup' : null,
    raw: { mx: mxRecords, dns: dnsRaw, ispdb: ispdbRaw },
  };
  cache?.set(domain, result, cacheTtl);
  return result;
}

function emptyResult(email: string, domain: string): MailintelResult {
  return {
    email,
    domain,
    provider: null,
    mx: null,
    type: 'unknown',
    isFree: false,
    hasMx: false,
    connection: null,
    status: 'lookup-disabled',
    confidence: 'low',
    source: null,
    raw: { mx: null, dns: null, ispdb: null },
  };
}
