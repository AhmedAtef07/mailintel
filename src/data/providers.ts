import { RawConnectionInfo } from '../types';

export const KNOWN_PROVIDERS: Record<string, RawConnectionInfo> = {
  google: {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  microsoft: {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    username: '%EMAILADDRESS%',
  },
  zoho: {
    imap: { host: 'imappro.zoho.com', port: 993, secure: true },
    smtp: { host: 'smtppro.zoho.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  yahoo: {
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  icloud: {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    username: '%EMAILADDRESS%',
  },
  fastmail: {
    imap: { host: 'imap.fastmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.fastmail.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  protonmail: {
    imap: { host: '127.0.0.1', port: 1143, secure: false },
    smtp: { host: '127.0.0.1', port: 1025, secure: false },
    username: '%EMAILADDRESS%',
  },
  godaddy: {
    imap: { host: 'imap.secureserver.net', port: 993, secure: true },
    smtp: { host: 'smtpout.secureserver.net', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  titan: {
    imap: { host: 'imap.titan.email', port: 993, secure: true },
    smtp: { host: 'smtp.titan.email', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  ovh: {
    imap: { host: 'ssl0.ovh.net', port: 993, secure: true },
    smtp: { host: 'ssl0.ovh.net', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  ionos: {
    imap: { host: 'imap.ionos.com', port: 993, secure: true },
    smtp: { host: 'smtp.ionos.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  hostinger: {
    imap: { host: 'imap.hostinger.com', port: 993, secure: true },
    smtp: { host: 'smtp.hostinger.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  yandex: {
    imap: { host: 'imap.yandex.com', port: 993, secure: true },
    smtp: { host: 'smtp.yandex.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  aol: {
    imap: { host: 'imap.aol.com', port: 993, secure: true },
    smtp: { host: 'smtp.aol.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  rackspace: {
    imap: { host: 'secure.emailsrvr.com', port: 993, secure: true },
    smtp: { host: 'secure.emailsrvr.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
  dreamhost: {
    imap: { host: 'imap.dreamhost.com', port: 993, secure: true },
    smtp: { host: 'smtp.dreamhost.com', port: 465, secure: true },
    username: '%EMAILADDRESS%',
  },
};

export const REGIONAL_PROVIDERS: Record<string, Record<string, { imapHost: string; smtpHost: string }>> = {
  zoho: {
    'zoho.eu': { imapHost: 'imappro.zoho.eu', smtpHost: 'smtppro.zoho.eu' },
    'zoho.in': { imapHost: 'imappro.zoho.in', smtpHost: 'smtppro.zoho.in' },
    'zoho.com.au': { imapHost: 'imappro.zoho.com.au', smtpHost: 'smtppro.zoho.com.au' },
    'zoho.jp': { imapHost: 'imappro.zoho.jp', smtpHost: 'smtppro.zoho.jp' },
  },
};
