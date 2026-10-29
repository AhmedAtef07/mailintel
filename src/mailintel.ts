import { MailintelOptions, MailintelResult, ConnectionInfo, RawConnectionInfo } from './types';
import { Cache } from './cache';
import { lookupMx } from './dns';
import { lookupIspdb } from './ispdb';
import { KNOWN_DOMAINS } from './data/domains';
import { KNOWN_MX } from './data/mx';
import { KNOWN_PROVIDERS, PROVIDER_DISPLAY_NAMES, REGIONAL_PROVIDERS, CONSUMER_MICROSOFT_DOMAINS, PROVIDER_NOTES } from './data/providers';
import { FREE_DOMAINS } from './data/free';

function getDisplayName(provider: string | null, override?: string): string | null {
  if (override) return override;
  if (!provider) return null;
  return PROVIDER_DISPLAY_NAMES[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

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

/**
 * Pick the provider's endpoint for this account. Known-domain lookups pass the
 * domain; MX lookups pass the matched MX suffix so regional Zoho/GMX accounts
 * get the host that actually serves them.
 */
function connectionFor(
  provider: string,
  domain: string,
  mxSuffix?: string | null,
): RawConnectionInfo | null {
  const base = KNOWN_PROVIDERS[provider];
  if (!base) return null;

  let connection = base;

  if (provider === 'microsoft' && CONSUMER_MICROSOFT_DOMAINS.has(domain)) {
    connection = {
      ...connection,
      imap: { host: 'imap-mail.outlook.com', port: 993, security: 'tls' },
      smtp: { host: 'smtp-mail.outlook.com', port: 587, security: 'starttls' },
    };
  }

  const regional = REGIONAL_PROVIDERS[provider];
  if (regional) {
    const key = mxSuffix ?? domain;
    for (const [suffix, region] of Object.entries(regional)) {
      if (key === suffix || key.endsWith('.' + suffix)) {
        connection = {
          ...connection,
          imap: { ...connection.imap, host: region.imapHost },
          smtp: { ...connection.smtp, host: region.smtpHost },
        };
        break;
      }
    }
  }

  return connection;
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
      providerDisplayName: getDisplayName(override.provider, override.providerDisplayName),
      mx: null,
      type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
      isFree: FREE_DOMAINS.has(domain),
      hasMx: true,
      mxChecked: false,
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
    const connection = connectionFor(knownProvider, domain);
    const result: MailintelResult = {
      email,
      domain,
      provider: knownProvider,
      providerDisplayName: getDisplayName(knownProvider),
      mx: null,
      type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
      isFree: FREE_DOMAINS.has(domain),
      hasMx: true,
      mxChecked: false,
      connection: connection ? resolveConnection(connection, email, domain) : null,
      note: PROVIDER_NOTES[knownProvider],
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
      providerDisplayName: null,
      mx: null,
      type: 'unknown',
      isFree: false,
      hasMx: false,
      mxChecked: true,
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
          providerDisplayName: getDisplayName(override.provider, override.providerDisplayName),
          mx: primaryMx,
          type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
          isFree: FREE_DOMAINS.has(domain),
          hasMx: true,
          mxChecked: true,
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
    let connection: RawConnectionInfo | null = connectionFor(mxProvider, domain, matchedMxSuffix);
    let ispdbRaw: string | null = null;
    let confidence: 'high' | 'medium' | 'low' = connection ? 'high' : 'low';

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
      providerDisplayName: getDisplayName(mxProvider),
      mx: primaryMx,
      type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
      isFree: FREE_DOMAINS.has(domain),
      hasMx: true,
      mxChecked: true,
      connection: connection ? resolveConnection(connection, email, domain) : null,
      note: PROVIDER_NOTES[mxProvider],
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
    providerDisplayName: null,
    mx: primaryMx,
    type: FREE_DOMAINS.has(domain) ? 'free' : 'business',
    isFree: FREE_DOMAINS.has(domain),
    hasMx: true,
    mxChecked: true,
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
    providerDisplayName: null,
    mx: null,
    type: 'unknown',
    isFree: false,
    hasMx: false,
    mxChecked: false,
    connection: null,
    status: 'lookup-disabled',
    confidence: 'low',
    source: null,
    raw: { mx: null, dns: null, ispdb: null },
  };
}
