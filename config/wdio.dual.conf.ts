import { sharedConfig, androidCapabilities, resolveSpecs } from './wdio.shared';
import { hooks } from './wdio.hooks';

const aDevice = process.env.APARTY_DEVICE || '';
const bDevice = process.env.BPARTY_DEVICE || process.env.bPartyDevice || '';

const caps: WebdriverIO.Capabilities[] = [];
if (aDevice) caps.push({ ...androidCapabilities(aDevice), 'wdio:maxInstances': 1 });
if (bDevice) caps.push({ ...androidCapabilities(bDevice), 'wdio:maxInstances': 1 });

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  specs: resolveSpecs(),
  maxInstances: 2,
  capabilities: caps.length ? caps : [androidCapabilities(aDevice || 'emulator-5554')],
  ...hooks
};
