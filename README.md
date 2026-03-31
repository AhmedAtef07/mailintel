# Mailintel

Resolve email providers and IMAP/SMTP settings from any email address or domain. Zero npm dependencies.

Every email domain has DNS MX records that point to the mail server handling its email. `atef.dev` might point to `smtp.google.com`, meaning it uses Google Workspace. `noor.sh` might point to `mx.zoho.com`, meaning Zoho. Mailintel reads these MX records via DNS-over-HTTPS (no system DNS needed), matches them against known provider patterns, and returns the full IMAP/SMTP connection settings you need to connect - host, port, SSL, and username.

For well-known domains like `gmail.com` or `outlook.com`, it skips the network entirely and returns settings instantly from a built-in map.

## Install

```bash
npm install mailintel
```

## API

```typescript
import { mailintel } from 'mailintel';

// With an email - username is resolved automatically
const result = await mailintel('ahmed@atef.dev');
// result.provider             => 'google'
// result.connection.imap      => { host: 'imap.gmail.com', port: 993, secure: true }
// result.connection.username  => 'ahmed@atef.dev'
// result.type                 => 'business'
// result.confidence           => 'high'

// With just a domain - same result, username stays as template
const result = await mailintel('atef.dev');
// result.connection.username  => '%EMAILADDRESS%'

// Multiple inputs at once
const results = await mailintel(['ahmed@atef.dev', 'noor.sh', 'user@gmail.com']);
```

### Factory

Use `createMailintel()` for reusable config, custom overrides, or a shared cache:

```typescript
import { createMailintel } from 'mailintel';

const lookup = createMailintel({
  timeout: 3000,
  providers: {
    'megacorp.io': {
      provider: 'internal',
      imap: { host: 'imap.megacorp.io', port: 993, secure: true },
      smtp: { host: 'smtp.megacorp.io', port: 465, secure: true },
    },
  },
});

await lookup('admin@megacorp.io');  // uses override, no network call
lookup.clearCache();
```

### Options

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

## CLI

```bash
npx mailintel ahmed@atef.dev
```

```
ahmed@atef.dev

  provider      google
  domain        atef.dev
  type          business
  confidence    high
  mx            smtp.google.com
  source        mx-lookup

  IMAP  imap.gmail.com:993  SSL
  SMTP  smtp.gmail.com:465  SSL
  Username  ahmed@atef.dev
```

Supports multiple emails, domain-only lookups, and JSON output:

```bash
mailintel user@gmail.com ceo@noor.sh          # multiple emails
mailintel atef.dev                            # domain-only lookup
mailintel ahmed@atef.dev --json               # machine-readable JSON
```

### CLI options

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON |
| `--timeout <ms>` | Network timeout (default: 5000) |
| `--resolver google` | Use Google DNS instead of Cloudflare |
| `--no-cache` | Disable caching |
| `--no-ispdb` | Skip Thunderbird ISPDB fallback |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## How it works

```
                     ┌─────────────────┐
                     │  ahmed@atef.dev  │
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

## Result type

```typescript
interface MailintelResult {
  email: string;                 // input email, or '' for domain-only lookups
  domain: string;
  provider: string | null;       // 'google', 'microsoft', 'zoho', etc.
  mx: string | null;             // primary MX hostname
  type: 'free' | 'business' | 'unknown';
  isFree: boolean;
  hasMx: boolean;
  connection: {                  // null when settings can't be determined
    imap: { host: string; port: number; secure: boolean };
    smtp: { host: string; port: number; secure: boolean };
    username: string;            // resolved: 'ahmed@atef.dev'
    usernameTemplate: string;    // raw template: '%EMAILADDRESS%'
  } | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'override' | 'known-domain' | 'mx-lookup' | null;
  raw: { mx, dns, ispdb };      // raw data for debugging
}
```

### Username

`username` is the resolved value you pass directly to the mail server. When the input is a domain (no email), it stays as the raw template since there's no email to resolve.

`usernameTemplate` is the raw template, useful if you're building a config UI. Templates follow the [Thunderbird ISPDB convention](https://wiki.mozilla.org/Thunderbird:Autoconfiguration:ConfigFileFormat):

| Template | Resolves to | Used by |
|----------|------------|---------|
| `%EMAILADDRESS%` | `ahmed@atef.dev` | Nearly all modern providers |
| `%EMAILLOCALPART%` | `ahmed` | Some older/self-hosted setups |
| `%EMAILDOMAIN%` | `atef.dev` | Rare |

All built-in providers use `%EMAILADDRESS%`. The ISPDB fallback may return any of the three depending on what Thunderbird's database has for that provider.

## Supported providers

Google, Microsoft, Yahoo, Zoho (with EU/IN/AU/JP regional variants), iCloud, Fastmail, ProtonMail, GoDaddy, Titan, OVH, IONOS, Hostinger, Yandex, AOL, Rackspace, DreamHost - plus any provider discoverable via MX records or Thunderbird ISPDB.

## Contributing

Missing a provider or found incorrect settings? [Open an issue](https://github.com/AhmedAtef07/mailintel/issues) or submit a PR.

## License

MIT
