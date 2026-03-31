# Changelog

## 0.1.0

- `connection.username` now returns the resolved value (e.g., `ceo@acme-corp.com`) instead of the raw template
- `connection.usernameTemplate` added for the raw ISPDB template (e.g., `%EMAILADDRESS%`)
- CLI tool: `npx mailintel user@example.com` with colored output, `--json`, `--resolver`, `--timeout` flags
- Initial release
- Email domain detection via known domains map
- MX lookup via Cloudflare/Google DNS-over-HTTPS
- Thunderbird ISPDB fallback
- In-memory TTL cache
- Factory pattern with `createMailintel()`
- Support for domain overrides and MX overrides
- Zoho regional variant support
- Zero runtime dependencies
