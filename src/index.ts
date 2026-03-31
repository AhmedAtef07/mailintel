export { createMailintel } from './factory';
export { mailintelCore } from './mailintel';
export type {
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
