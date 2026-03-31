import { ConnectionInfo } from './types';

const ISPDB_URL = 'https://autoconfig.thunderbird.net/v1.1';

export async function lookupIspdb(
  domain: string,
  options: {
    timeout?: number;
    fetch?: typeof globalThis.fetch;
  } = {},
): Promise<{ connection: ConnectionInfo | null; raw: string | null }> {
  const timeout = options.timeout ?? 5000;
  const fetchFn = options.fetch ?? globalThis.fetch;
  const url = `${ISPDB_URL}/${encodeURIComponent(domain)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetchFn(url, { signal: controller.signal });

    if (!response.ok) {
      return { connection: null, raw: null };
    }

    const xml = await response.text();
    const connection = parseIspdbXml(xml);
    return { connection, raw: xml };
  } catch {
    return { connection: null, raw: null };
  } finally {
    clearTimeout(timer);
  }
}

function parseIspdbXml(xml: string): ConnectionInfo | null {
  const imapMatch = xml.match(/<incomingServer type="imap">([\s\S]*?)<\/incomingServer>/);
  const smtpMatch = xml.match(/<outgoingServer type="smtp">([\s\S]*?)<\/outgoingServer>/);

  if (!imapMatch || !smtpMatch) return null;

  const imapBlock = imapMatch[1];
  const smtpBlock = smtpMatch[1];

  const imapHost = imapBlock.match(/<hostname>(.*?)<\/hostname>/)?.[1];
  const imapPort = imapBlock.match(/<port>(.*?)<\/port>/)?.[1];
  const imapSocket = imapBlock.match(/<socketType>(.*?)<\/socketType>/)?.[1];

  const smtpHost = smtpBlock.match(/<hostname>(.*?)<\/hostname>/)?.[1];
  const smtpPort = smtpBlock.match(/<port>(.*?)<\/port>/)?.[1];
  const smtpSocket = smtpBlock.match(/<socketType>(.*?)<\/socketType>/)?.[1];

  const username = xml.match(/<username>(.*?)<\/username>/)?.[1] ?? '%EMAILADDRESS%';

  if (!imapHost || !imapPort || !smtpHost || !smtpPort) return null;

  return {
    imap: {
      host: imapHost,
      port: parseInt(imapPort, 10),
      secure: imapSocket === 'SSL',
    },
    smtp: {
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpSocket === 'SSL' || smtpSocket === 'STARTTLS',
    },
    username,
  };
}
