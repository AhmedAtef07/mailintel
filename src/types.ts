export interface ServerConfig {
  host: string;
  port: number;
  /** Connection security: "tls" = implicit TLS on connect (993/465), "starttls" = upgrade after connect (587/143), "none" = no encryption */
  security: 'tls' | 'starttls' | 'none';
}

export interface RawConnectionInfo {
  imap: ServerConfig;
  smtp: ServerConfig;
  username: string;
}

export interface ConnectionInfo {
  imap: ServerConfig;
  smtp: ServerConfig;
  /** Resolved username ready to use - template already applied with the input email. e.g. "user@gmail.com" or "user" */
  username: string;
  /** Raw ISPDB/provider template before resolution. Possible values: "%EMAILADDRESS%", "%EMAILLOCALPART%", "%EMAILDOMAIN%" */
  usernameTemplate: string;
}

export interface MxRecord {
  priority: number;
  exchange: string;
}

export interface MailintelResult {
  email: string;
  domain: string;
  /** Detected email provider name, e.g. "google", "microsoft", "zoho". null if provider could not be identified */
  provider: string | null;
  /** Human-readable provider name, e.g. "Google Workspace", "Microsoft 365", "Zoho Mail". null if provider unknown */
  providerDisplayName: string | null;
  /** Primary MX record hostname from DNS. null if MX lookup was skipped or no records found */
  mx: string | null;
  /** "free" for consumer providers (Gmail, Yahoo), "business" for custom/work domains, "unknown" if unresolved */
  type: 'free' | 'business' | 'unknown';
  isFree: boolean;
  /**
   * True when the domain is known or observed to accept mail.
   * Check `mxChecked` to distinguish a DNS-confirmed answer from a known-domain shortcut.
   */
  hasMx: boolean;
  /** True only when an MX DNS query actually ran and returned records. */
  mxChecked: boolean;
  /** IMAP/SMTP connection settings. null when status is not "ok" */
  connection: ConnectionInfo | null;
  /** Human-readable caveat for providers without standard IMAP/SMTP, or for Bridge-based setups. */
  note?: string;
  /**
   * Detection outcome.
   * - "ok": connection settings found successfully
   * - "no-mx-records": DNS returned no MX records for this domain
   * - "unknown-provider": provider not recognized, or no IMAP/SMTP settings available for it
   * - "lookup-disabled": MX lookup was disabled and domain is not in the known list, or input was empty/invalid
   */
  status: 'ok' | 'no-mx-records' | 'unknown-provider' | 'lookup-disabled';
  /**
   * How confident we are in the result.
   * - "high": matched a known domain or known MX pattern
   * - "medium": resolved via Thunderbird ISPDB fallback
   * - "low": could not determine connection settings
   */
  confidence: 'high' | 'medium' | 'low';
  /**
   * How the provider was identified.
   * - "override": matched a user-provided domain or MX override
   * - "known-domain": matched the built-in domain map (~50 domains)
   * - "mx-lookup": resolved via DNS MX lookup + provider matching or ISPDB
   * - null: provider could not be identified
   */
  source: 'override' | 'known-domain' | 'mx-lookup' | null;
  raw: {
    mx: MxRecord[] | null;
    dns: object | null;
    ispdb: string | null;
  };
}

export interface ProviderOverride {
  provider: string;
  providerDisplayName?: string;
  imap: ServerConfig;
  smtp: ServerConfig;
  username?: string;
}

export interface MailintelOptions {
  timeout?: number;
  cache?: boolean;
  cacheTtl?: number;
  /** DNS resolver for MX lookups. true or "cloudflare" (default), "google", or false to disable */
  mxLookup?: boolean | 'cloudflare' | 'google';
  /** Enable Thunderbird ISPDB fallback. Defaults to true */
  ispdb?: boolean;
  fetch?: typeof globalThis.fetch;
  providers?: Record<string, ProviderOverride>;
  mxOverrides?: Record<string, ProviderOverride>;
}

export type MailintelCallOptions = Pick<MailintelOptions, 'timeout'>;

/** Function returned by createMailintel() with overloaded signatures for single and array input */
export interface Mailintel {
  (input: string, options?: MailintelCallOptions): Promise<MailintelResult>;
  (input: string[], options?: MailintelCallOptions): Promise<MailintelResult[]>;
  clearCache(): void;
}
