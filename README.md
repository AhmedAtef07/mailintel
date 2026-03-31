# Mailintel

Email domain intelligence. Resolve providers and IMAP/SMTP settings from any email address.

Takes an email address - including custom domains like `ceo@acme-corp.com` - and returns the complete server configuration. Resolves custom domains to their underlying provider (Zoho, Google, Microsoft, etc.) via DNS MX lookups, then maps the MX records to known providers and their settings.

One function. One return type. Zero dependencies.

## Install

```bash
npm install mailintel
```

## Quick start

```typescript
import { mailintel } from 'mailintel';

const result = await mailintel('ceo@acme-corp.com');
// {
//   email: 'ceo@acme-corp.com',
//   domain: 'acme-corp.com',
//   provider: 'zoho',
//   mx: 'mx.zoho.com',
//   type: 'business',
//   isFree: false,
//   hasMx: true,
//   connection: {
//     imap: { host: 'imappro.zoho.com', port: 993, secure: true },
//     smtp: { host: 'smtppro.zoho.com', port: 465, secure: true },
//     username: '%EMAILADDRESS%',
//   },
//   confidence: 'high',
//   source: 'mx-lookup',
//   raw: { mx: [...], dns: {...}, ispdb: null },
// }
```

## Array input

```typescript
const results = await mailintel(['user@gmail.com', 'ceo@corp.com']);
```

## Factory pattern

Use `createMailintel()` for reusable configuration:

```typescript
import { createMailintel } from 'mailintel';

const mailintel = createMailintel({
  timeout: 5000,
  cache: true,
  cacheTtl: 30 * 60 * 1000,
  providers: {
    'mycompany.com': {
      provider: 'internal',
      imap: { host: 'imap.mycompany.com', port: 993, secure: true },
      smtp: { host: 'smtp.mycompany.com', port: 465, secure: true },
    },
  },
  mxOverrides: {
    'privateemail.com': {
      provider: 'namecheap',
      imap: { host: 'mail.privateemail.com', port: 993, secure: true },
      smtp: { host: 'mail.privateemail.com', port: 465, secure: true },
    },
  },
});

await mailintel('user@mycompany.com');
mailintel.clearCache();
```

## Detection cascade

Given an email, Mailintel runs through these steps:

1. **Parse** - Extract domain from email address
2. **Cache check** - Return cached result if available
3. **Domain overrides** - Check user-provided `providers` map
4. **Known domains** - Check ~50 built-in domain-to-provider mappings (gmail.com, outlook.com, etc.)
5. **MX lookup** - Query DNS-over-HTTPS (Cloudflare or Google) for MX records
6. **MX overrides** - Check user-provided `mxOverrides` map
7. **Known MX** - Match MX hostname suffix against ~30 known provider patterns
8. **Provider settings** - Look up IMAP/SMTP config from known providers
9. **ISPDB fallback** - Query Thunderbird's ISPDB for server settings
10. **Regional variants** - Apply regional hostnames (e.g., Zoho EU/IN/AU/JP)
11. **Classify** - Determine type (free/business/unknown), confidence, and source

## Result type

```typescript
interface MailintelResult {
  email: string;              // Input email
  domain: string;             // Extracted domain
  provider: string | null;    // Provider name (google, microsoft, zoho, etc.)
  mx: string | null;          // Primary MX hostname
  type: 'free' | 'business' | 'unknown';
  isFree: boolean;            // True for gmail.com, outlook.com, etc.
  hasMx: boolean;             // Whether MX records were found
  connection: {               // null when settings can't be determined
    imap: { host: string; port: number; secure: boolean };
    smtp: { host: string; port: number; secure: boolean };
    username: string;         // '%EMAILADDRESS%' placeholder
  } | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'override' | 'known-domain' | 'mx-lookup' | null;
  raw: {                      // Raw data for debugging
    mx: MxRecord[] | null;
    dns: object | null;
    ispdb: string | null;
  };
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `5000` | Network request timeout in ms |
| `cache` | `boolean` | `true` | Enable in-memory domain caching |
| `cacheTtl` | `number` | `1800000` | Cache TTL in ms (30 min) |
| `mxLookup` | `boolean \| 'google'` | `true` | DNS resolver: `true` = Cloudflare, `'google'` = Google, `false` = disabled |
| `ispdb` | `boolean` | `true` | Enable Thunderbird ISPDB fallback |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch function |
| `providers` | `Record<string, ProviderOverride>` | `{}` | Domain-to-provider overrides |
| `mxOverrides` | `Record<string, ProviderOverride>` | `{}` | MX suffix-to-provider overrides |

## Supported providers

Google, Microsoft (Outlook/Office 365), Yahoo, Zoho (with regional variants), iCloud, Fastmail, ProtonMail, GoDaddy, Titan, OVH, IONOS, Hostinger, Yandex, AOL, Rackspace, DreamHost, and more via MX detection.

## Contributing

Found a missing provider or incorrect settings? [Open an issue](https://github.com/AhmedAtef07/mailintel/issues) or submit a PR.

## License

MIT
