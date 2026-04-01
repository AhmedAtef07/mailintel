import { describe, it, expect, vi } from 'vitest';
import { lookupIspdb } from '../src/ispdb';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="example.com">
    <domain>example.com</domain>
    <incomingServer type="imap">
      <hostname>imap.example.com</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>smtp.example.com</hostname>
      <port>465</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>`;

const STARTTLS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="example.com">
    <incomingServer type="imap">
      <hostname>imap.example.com</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>smtp.example.com</hostname>
      <port>587</port>
      <socketType>STARTTLS</socketType>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>`;

function mockFetch(body: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    text: () => Promise.resolve(body),
  });
}

describe('lookupIspdb', () => {
  it('should extract IMAP settings from XML', async () => {
    const fetch = mockFetch(SAMPLE_XML);
    const { connection } = await lookupIspdb('example.com', { fetch });

    expect(connection).not.toBeNull();
    expect(connection!.imap).toEqual({ host: 'imap.example.com', port: 993, security: 'tls' });
  });

  it('should extract SMTP settings from XML', async () => {
    const fetch = mockFetch(SAMPLE_XML);
    const { connection } = await lookupIspdb('example.com', { fetch });

    expect(connection).not.toBeNull();
    expect(connection!.smtp).toEqual({ host: 'smtp.example.com', port: 465, security: 'tls' });
  });

  it('should extract username from XML', async () => {
    const fetch = mockFetch(SAMPLE_XML);
    const { connection } = await lookupIspdb('example.com', { fetch });

    expect(connection!.username).toBe('%EMAILADDRESS%');
  });

  it('should correctly map STARTTLS socket type', async () => {
    const fetch = mockFetch(STARTTLS_XML);
    const { connection } = await lookupIspdb('example.com', { fetch });

    expect(connection!.smtp.security).toBe('starttls');
    expect(connection!.smtp.port).toBe(587);
    expect(connection!.imap.security).toBe('tls');
  });

  it('should return null for malformed XML', async () => {
    const fetch = mockFetch('<not-valid>xml</not-valid>');
    const { connection } = await lookupIspdb('example.com', { fetch });
    expect(connection).toBeNull();
  });

  it('should return null for non-ok response', async () => {
    const fetch = mockFetch('', false);
    const { connection } = await lookupIspdb('example.com', { fetch });
    expect(connection).toBeNull();
  });

  it('should handle fetch error', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { connection } = await lookupIspdb('example.com', { fetch });
    expect(connection).toBeNull();
  });

  it('should handle timeout', async () => {
    const fetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const { connection } = await lookupIspdb('example.com', { fetch, timeout: 1 });
    expect(connection).toBeNull();
  });
});
