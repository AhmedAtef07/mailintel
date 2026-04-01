import { createMailintel } from './factory';
import type { MailintelResult, MailintelOptions } from './types';

const HELP = `
  mailintel - Resolve email providers and IMAP/SMTP settings

  Usage
    $ mailintel <email> [email...]

  Options
    --json             Output raw JSON
    --timeout <ms>     Network timeout (default: 5000)
    --resolver <name>  DNS resolver: cloudflare (default) or google
    --no-cache         Disable caching (useful for multiple lookups)
    --no-ispdb         Skip Thunderbird ISPDB fallback
    --help, -h         Show this help
    --version, -v      Show version

  Examples
    $ mailintel user@gmail.com
    $ mailintel ceo@acme-corp.com admin@corp.com --json
    $ npx mailintel user@example.com --resolver google
`.trimStart();

interface CliArgs {
  emails: string[];
  json: boolean;
  timeout: number;
  resolver: 'cloudflare' | 'google';
  cache: boolean;
  ispdb: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    emails: [],
    json: false,
    timeout: 5000,
    resolver: 'cloudflare',
    cache: true,
    ispdb: true,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--json':
        args.json = true;
        break;
      case '--timeout':
        args.timeout = parseInt(argv[++i], 10) || 5000;
        break;
      case '--resolver':
        args.resolver = argv[++i] === 'google' ? 'google' : 'cloudflare';
        break;
      case '--no-cache':
        args.cache = false;
        break;
      case '--no-ispdb':
        args.ispdb = false;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--version':
      case '-v':
        args.version = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          args.emails.push(arg);
        }
        break;
    }
  }

  return args;
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

function yellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`;
}

function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

function cyan(text: string): string {
  return `\x1b[36m${text}\x1b[0m`;
}

function confidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high':
      return green(confidence);
    case 'medium':
      return yellow(confidence);
    default:
      return red(confidence);
  }
}

function formatResult(result: MailintelResult): string {
  const lines: string[] = [];

  lines.push(bold(result.email || result.domain));
  lines.push('');

  if (result.provider) {
    const name = result.providerDisplayName ?? result.provider;
    lines.push(`  provider      ${cyan(name)}${result.providerDisplayName ? dim(` (${result.provider})`) : ''}`);
  } else {
    lines.push(`  provider      ${dim('unknown')}`);
  }

  lines.push(`  domain        ${result.domain}`);
  lines.push(`  type          ${result.type}${result.isFree ? dim(' (free)') : ''}`);
  lines.push(`  confidence    ${confidenceColor(result.confidence)}`);

  if (result.mx) {
    lines.push(`  mx            ${result.mx}`);
  }

  if (result.source) {
    lines.push(`  source        ${dim(result.source)}`);
  }

  if (result.connection) {
    const { imap, smtp, username } = result.connection;
    lines.push('');
    lines.push(`  ${bold('IMAP')}  ${imap.host}:${imap.port}  ${imap.security === 'tls' ? green('TLS') : imap.security === 'starttls' ? yellow('STARTTLS') : red('none')}`);
    lines.push(`  ${bold('SMTP')}  ${smtp.host}:${smtp.port}  ${smtp.security === 'tls' ? green('TLS') : smtp.security === 'starttls' ? yellow('STARTTLS') : red('none')}`);
    lines.push(`  ${bold('Username')}  ${dim(username)}`);
  } else {
    lines.push('');
    lines.push(`  ${dim('No connection settings found')}  ${dim(`(${result.status})`)}`);
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    process.stdout.write(__MAILINTEL_VERSION__ + '\n');
    return;
  }

  if (args.help || args.emails.length === 0) {
    process.stdout.write(HELP);
    process.exitCode = args.help ? 0 : 1;
    return;
  }

  const options: MailintelOptions = {
    timeout: args.timeout,
    cache: args.cache,
    ispdb: args.ispdb,
    mxLookup: args.resolver === 'google' ? 'google' : true,
  };

  const mailintel = createMailintel(options);
  const results: MailintelResult[] = [];

  for (const email of args.emails) {
    const result = await mailintel(email);
    results.push(result);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(results.length === 1 ? results[0] : results, null, 2) + '\n');
    return;
  }

  for (let i = 0; i < results.length; i++) {
    if (i > 0) process.stdout.write('\n' + dim('---') + '\n\n');
    process.stdout.write(formatResult(results[i]) + '\n');
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exitCode = 1;
});
