# Mailintel

## Project

Zero-dependency npm package that resolves email addresses to their provider and IMAP/SMTP connection settings via DNS MX lookups.

## Stack

TypeScript, tsup (build), vitest (test), DNS-over-HTTPS (Cloudflare/Google), Thunderbird ISPDB fallback.

## Commands

```bash
npm run build       # Build with tsup (ESM + CJS + types)
npm test            # Run vitest
npm run test:watch  # Watch mode
```

## Before committing

- Run `npm run build && npm test` to ensure everything passes
- Update `CHANGELOG.md` with a summary of changes under the current version
- If adding a new provider: update `KNOWN_DOMAINS`, `KNOWN_MX`, `KNOWN_PROVIDERS`, and `FREE_DOMAINS` (if applicable) - keep them consistent
- If bumping the version: update both `package.json` and `CHANGELOG.md`

## Architecture

- `src/mailintel.ts` - Core detection cascade (known domain -> MX lookup -> ISPDB fallback)
- `src/data/` - Static maps: domains, MX patterns, provider configs, free domains
- `src/dns.ts` - MX lookup via DNS-over-HTTPS
- `src/ispdb.ts` - Thunderbird ISPDB XML parser
- `src/cache.ts` - In-memory TTL cache
- `src/factory.ts` - `createMailintel()` factory
- `src/index.ts` - Public exports + default instance

## Rules

- Zero runtime dependencies - never add one
- The main function never throws - always returns a result
- All network calls use AbortController for timeout
- All network failures are caught and return null/empty
- Package name is `mailintel` (lowercase). Brand name is `Mailintel` (capital M)
- Types use `Mailintel` prefix: `MailintelResult`, `MailintelOptions`, etc.
- No em dashes anywhere - use commas or normal dashes
