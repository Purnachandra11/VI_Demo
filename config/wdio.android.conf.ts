import { execSync } from 'child_process';
import { sharedConfig, androidCapabilities, resolveSpecs } from './wdio.shared';
import { hooks } from './wdio.hooks';

function detectFirstDevice(): string {
  try {
    const out = execSync('adb devices', { encoding: 'utf8' });
    const line = out
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && l.endsWith('device') && !l.startsWith('List'));
    return line ? line.split(/\s+/)[0] : '';
  } catch {
    return '';
  }
}

const deviceId =
  process.env.APARTY_DEVICE ||
  process.env.deviceId ||
  process.env.DEVICE_ID ||
  detectFirstDevice();

if (!deviceId) {
  console.warn('[WDIO] No APARTY_DEVICE set and no adb device found. Connect a device or set APARTY_DEVICE in .env');
} else if (!process.env.APARTY_DEVICE) {
  console.log(`[WDIO] Using detected device: ${deviceId}`);
}

export const config = {
  ...sharedConfig,
  specs: resolveSpecs(),
  capabilities: deviceId ? [androidCapabilities(deviceId)] : [],
  services: [],
  ...hooks,
  /**
   * expect-webdriverio soft assertions / auto-wait
   * @see https://webdriver.io/docs/api/expect-webdriverio
   */
  injectGlobals: true
};
