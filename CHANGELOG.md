# Changelog

## 0.3.0

- **TypeScript overloads**: `mailintel(string)` returns `Promise<MailintelResult>`, `mailintel(string[])` returns `Promise<MailintelResult[]>` - no more `Array.isArray()` checks
- **`status` field**: `'ok' | 'no-mx-records' | 'unknown-provider' | 'lookup-disabled'` on every result - callers can now distinguish why `connection` is null
- **JSDoc on exported types**: all key fields documented inline for IDE and AI tool support
- **`llms.txt`**: ships with the package for AI tool quick reference
- **`Mailintel` interface**: exported typed interface for the factory return value

## 0.2.2

- Replace Mermaid diagram with plain-text ASCII tree for npm compatibility

## 0.2.1

- Fix README not rendering on npm package page

## 0.2.0

- **CLI tool**: `npx mailintel user@example.com` with ANSI colored output, `--json`, `--resolver`, `--timeout`, `--no-cache`, `--no-ispdb` flags
- **Resolved username**: `connection.username` now returns the resolved value (e.g., `ceo@acme-corp.com`) instead of the raw template
- **Username template**: `connection.usernameTemplate` added for the raw ISPDB template (e.g., `%EMAILADDRESS%`)
- **Domain-only input**: pass a bare domain (e.g., `atef.dev`) — `connection.username` stays as the template since there's no email to resolve
- **Explicit Cloudflare resolver**: `mxLookup: 'cloudflare'` as a named option alongside `true` and `'google'`
- **Internal type split**: `RawConnectionInfo` (internal, template-only) vs `ConnectionInfo` (public, resolved + template) — keeps username resolution in one place

## 0.1.0

- Initial release
- Email domain detection via known domains map (~50 built-in)
- MX lookup via Cloudflare/Google DNS-over-HTTPS
- Thunderbird ISPDB fallback
- In-memory TTL cache
- Factory pattern with `createMailintel()`
- Support for domain overrides and MX overrides
- Zoho regional variant support
- Zero runtime dependencies
