export interface ServerConfig {
  host: string;
  port: number;
  secure: boolean;
}

export interface ConnectionInfo {
  imap: ServerConfig;
  smtp: ServerConfig;
  username: string;
}

export interface MxRecord {
  priority: number;
  exchange: string;
}

export interface MailintelResult {
  email: string;
  domain: string;
  provider: string | null;
  mx: string | null;
  type: 'free' | 'business' | 'unknown';
  isFree: boolean;
  hasMx: boolean;
  connection: ConnectionInfo | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'override' | 'known-domain' | 'mx-lookup' | null;
  raw: {
    mx: MxRecord[] | null;
    dns: object | null;
    ispdb: string | null;
  };
}

export interface ProviderOverride {
  provider: string;
  imap: ServerConfig;
  smtp: ServerConfig;
  username?: string;
}

export interface MailintelOptions {
  timeout?: number;
  cache?: boolean;
  cacheTtl?: number;
  mxLookup?: boolean | 'google';
  ispdb?: boolean;
  fetch?: typeof globalThis.fetch;
  providers?: Record<string, ProviderOverride>;
  mxOverrides?: Record<string, ProviderOverride>;
}

export type MailintelCallOptions = Pick<MailintelOptions, 'timeout'>;
