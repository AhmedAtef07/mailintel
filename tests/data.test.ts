import { describe, it, expect } from 'vitest';
import { KNOWN_DOMAINS } from '../src/data/domains';
import { KNOWN_MX } from '../src/data/mx';
import { KNOWN_PROVIDERS } from '../src/data/providers';
import { FREE_DOMAINS } from '../src/data/free';

describe('data maps consistency', () => {
  it('every FREE_DOMAINS entry should exist in KNOWN_DOMAINS', () => {
    for (const domain of FREE_DOMAINS) {
      expect(KNOWN_DOMAINS).toHaveProperty(domain);
    }
  });

  it('every KNOWN_DOMAINS provider should have KNOWN_PROVIDERS entry', () => {
    const providersWithoutSettings = new Set(['mailru', 'gmx', 'webde', 'tutanota', 'hey', 'mailcom']);

    for (const [domain, provider] of Object.entries(KNOWN_DOMAINS)) {
      if (!providersWithoutSettings.has(provider)) {
        expect(KNOWN_PROVIDERS, `Provider "${provider}" for domain "${domain}" missing from KNOWN_PROVIDERS`).toHaveProperty(provider);
      }
    }
  });

  it('all provider settings should have valid port numbers', () => {
    for (const [name, config] of Object.entries(KNOWN_PROVIDERS)) {
      expect(config.imap.port, `${name} IMAP port`).toBeGreaterThan(0);
      expect(config.imap.port, `${name} IMAP port`).toBeLessThan(65536);
      expect(config.smtp.port, `${name} SMTP port`).toBeGreaterThan(0);
      expect(config.smtp.port, `${name} SMTP port`).toBeLessThan(65536);
    }
  });

  it('all provider settings should have non-empty hosts', () => {
    for (const [name, config] of Object.entries(KNOWN_PROVIDERS)) {
      expect(config.imap.host, `${name} IMAP host`).toBeTruthy();
      expect(config.smtp.host, `${name} SMTP host`).toBeTruthy();
    }
  });

  it('should have no duplicate KNOWN_DOMAINS entries', () => {
    const domains = Object.keys(KNOWN_DOMAINS);
    const unique = new Set(domains);
    expect(domains.length).toBe(unique.size);
  });

  it('should have no duplicate KNOWN_MX entries', () => {
    const keys = Object.keys(KNOWN_MX);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });
});
