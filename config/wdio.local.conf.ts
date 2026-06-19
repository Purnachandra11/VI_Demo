import { config as androidConfig } from './wdio.android.conf';

export const config: WebdriverIO.Config = {
  ...androidConfig,
  maxInstances: 1,
  logLevel: 'debug'
};
