export { createMailintel } from './factory';
export { mailintelCore } from './mailintel';
export type {
  Mailintel,
  MailintelResult,
  MailintelOptions,
  MailintelCallOptions,
  ServerConfig,
  ConnectionInfo,
  MxRecord,
  ProviderOverride,
} from './types';

import { createMailintel } from './factory';
export const mailintel = createMailintel();
