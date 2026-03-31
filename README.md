# Mailintel

Resolve email providers and IMAP/SMTP settings from any email address. Zero npm dependencies.

Most email setup flows make users manually enter SMTP hosts, IMAP ports, and SSL settings. Mailintel takes an email address - even custom domains like `ceo@acme-corp.com` - and returns the complete server configuration automatically.

## Install

```bash
npm install mailintel
```

Or use directly from the command line:

```bash
npx mailintel user@gmail.com
```

## CLI

```bash
$ mailintel ceo@acme-corp.com

ceo@acme-corp.com

  provider      zoho
  domain        acme-corp.com
  type          business
  confidence    high
  mx            mx.zoho.com
  source        mx-lookup

  IMAP  imappro.zoho.com:993  SSL
  SMTP  smtppro.zoho.com:465  SSL
  User  ceo@acme-corp.com
```

Multiple emails, JSON output, and options:

```bash
mailintel user@gmail.com ceo@corp.com          # multiple emails
mailintel user@example.com --json              # machine-readable JSON
mailintel user@example.com --resolver google   # use Google DNS instead of Cloudflare
mailintel user@example.com --timeout 3000      # custom timeout
mailintel user@example.com --no-ispdb          # skip ISPDB fallback
```

## API

```typescript
import { mailintel } from 'mailintel';

const result = await mailintel('ceo@acme-corp.com');
// result.provider             => 'zoho'
// result.connection.imap      => { host: 'imappro.zoho.com', port: 993, secure: true }
// result.connection.username  => 'ceo@acme-corp.com'
// result.type                 => 'business'
// result.confidence           => 'high'
```

Works with arrays too:

```typescript
const results = await mailintel(['user@gmail.com', 'ceo@corp.com']);
```

## How it works

```
                     ┌─────────────────┐
                     │  user@domain.com │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │   Check cache   │
                     └────────┬────────┘
                              │ miss
                     ┌────────▼────────┐
                     │ Domain override? │─── hit ──▶ done (confidence: high)
                     └────────┬────────┘
                              │ miss
                     ┌────────▼────────┐
                     │  Known domain?  │─── hit ──▶ done (confidence: high)
                     │  (~50 domains)  │    gmail.com, outlook.com, etc.
                     └────────┬────────┘
                              │ miss
                  ┌───────────▼───────────┐
                  │  DNS MX lookup (DoH)  │  cloudflare-dns.com/dns-query
                  │  or dns.google        │  or dns.google/resolve
                  └───────────┬───────────┘
                              │
                     ┌────────▼────────┐
                     │  MX override?   │─── hit ──▶ done (confidence: high)
                     └────────┬────────┘
                              │ miss
                     ┌────────▼────────┐
                     │   Known MX?     │─── hit ──▶ done (confidence: high)
                     │  (~30 patterns) │    *.google.com, *.zoho.com, etc.
                     └────────┬────────┘
                              │ miss
              ┌───────────────▼───────────────┐
              │  Thunderbird ISPDB fallback    │  autoconfig.thunderbird.net
              └───────────────┬───────────────┘
                              │
                   ┌──────────▼──────────┐
                   │  Apply regional     │  e.g., mx.zoho.eu -> imappro.zoho.eu
                   │  variants + classify│
                   └──────────┬──────────┘
                              │
                     ┌────────▼────────┐
                     │  Cache + return  │
                     └─────────────────┘
```

**Network calls**: at most 2 HTTP requests per uncached lookup - one DNS-over-HTTPS query and one ISPDB fetch. Known domains (gmail.com, outlook.com, etc.) resolve instantly with zero network calls.

## Result

```typescript
interface MailintelResult {
  email: string;
  domain: string;
  provider: string | null;       // 'google', 'microsoft', 'zoho', etc.
  mx: string | null;             // primary MX hostname
  type: 'free' | 'business' | 'unknown';
  isFree: boolean;
  hasMx: boolean;
  connection: {                  // null when settings can't be determined
    imap: { host: string; port: number; secure: boolean };
    smtp: { host: string; port: number; secure: boolean };
    username: string;            // resolved: 'ceo@acme-corp.com'
    usernameTemplate: string;    // raw template: '%EMAILADDRESS%'
  } | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'override' | 'known-domain' | 'mx-lookup' | null;
  raw: { mx, dns, ispdb };      // raw data for debugging
}
```

### Username

`username` is the resolved value you pass directly to the mail server - no extra work needed.

`usernameTemplate` is the raw ISPDB template, useful if you're building a config UI or need to display the pattern. Templates follow the [Thunderbird ISPDB convention](https://wiki.mozilla.org/Thunderbird:Autoconfiguration:ConfigFileFormat):

| Template | Resolves to | Used by |
|----------|------------|---------|
| `%EMAILADDRESS%` | `atef@example.com` | Nearly all modern providers |
| `%EMAILLOCALPART%` | `atef` | Some older/self-hosted setups |
| `%EMAILDOMAIN%` | `example.com` | Rare |

All built-in providers use `%EMAILADDRESS%`. The ISPDB fallback may return any of the three, depending on what Thunderbird's database has for that provider.

## Factory

Use `createMailintel()` when you need custom config, domain overrides, or a shared cache:

```typescript
import { createMailintel } from 'mailintel';

const lookup = createMailintel({
  timeout: 3000,
  providers: {
    'mycompany.com': {
      provider: 'internal',
      imap: { host: 'imap.mycompany.com', port: 993, secure: true },
      smtp: { host: 'smtp.mycompany.com', port: 465, secure: true },
    },
  },
});

await lookup('user@mycompany.com');  // uses override, no network call
lookup.clearCache();
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `5000` | Network request timeout (ms) |
| `cache` | `boolean` | `true` | In-memory domain caching |
| `cacheTtl` | `number` | `1800000` | Cache TTL in ms (30 min) |
| `mxLookup` | `boolean \| 'google'` | `true` | `true` = Cloudflare, `'google'` = Google, `false` = disabled |
| `ispdb` | `boolean` | `true` | Thunderbird ISPDB fallback |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch (useful for proxies or testing) |
| `providers` | `Record<string, ProviderOverride>` | - | Domain-to-provider overrides |
| `mxOverrides` | `Record<string, ProviderOverride>` | - | MX suffix-to-provider overrides |

## Supported providers

Google, Microsoft, Yahoo, Zoho (with EU/IN/AU/JP regional variants), iCloud, Fastmail, ProtonMail, GoDaddy, Titan, OVH, IONOS, Hostinger, Yandex, AOL, Rackspace, DreamHost - plus any provider discoverable via MX records or Thunderbird ISPDB.

## Contributing

Missing a provider or found incorrect settings? [Open an issue](https://github.com/AhmedAtef07/mailintel/issues) or submit a PR.

## License

MIT
