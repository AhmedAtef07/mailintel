import { MailintelOptions, MailintelCallOptions, MailintelResult, Mailintel } from './types';
import { mailintelCore } from './mailintel';
import { Cache } from './cache';

export function createMailintel(options: MailintelOptions = {}): Mailintel {
  const cache = options.cache !== false ? new Cache<MailintelResult>() : null;
  const cacheTtl = options.cacheTtl ?? 30 * 60 * 1000;

  async function mailintel(input: string, callOptions?: MailintelCallOptions): Promise<MailintelResult>;
  async function mailintel(input: string[], callOptions?: MailintelCallOptions): Promise<MailintelResult[]>;
  async function mailintel(
    input: string | string[],
    callOptions?: MailintelCallOptions,
  ): Promise<MailintelResult | MailintelResult[]> {
    const mergedOptions = { ...options, ...callOptions };

    if (Array.isArray(input)) {
      return Promise.all(input.map((email) => mailintelCore(email, mergedOptions, cache, cacheTtl)));
    }

    return mailintelCore(input, mergedOptions, cache, cacheTtl);
  }

  mailintel.clearCache = () => cache?.clear();

  return mailintel as Mailintel;
}
