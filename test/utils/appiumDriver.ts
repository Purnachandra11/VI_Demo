import { remote } from 'webdriverio';
import type { Capabilities } from '@wdio/types';

/** Per-device UiAutomator2 port — aligned with DriverManager (8300–8999) */
function getSystemPort(deviceId: string, attempt = 0): number {
  const hash = deviceId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 8300 + ((hash + attempt * 31) % 699);
}

const activeSessions = new Map<string, WebdriverIO.Browser>();

async function closeExistingSession(deviceId: string): Promise<void> {
  const existing = activeSessions.get(deviceId);
  if (!existing) return;
  try {
    await existing.deleteSession();
  } catch {
    /* session may already be gone */
  }
  activeSessions.delete(deviceId);
}

async function createDriver(deviceId: string): Promise<WebdriverIO.Browser> {
  await closeExistingSession(deviceId);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    const systemPort = getSystemPort(deviceId, attempt);
    const params: Capabilities.WebdriverIOConfig = {
      path: '/',
      port: parseInt(process.env.APPIUM_PORT || '4723', 10),
      hostname: process.env.APPIUM_HOST || '127.0.0.1',
      capabilities: {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:udid': deviceId,
        'appium:systemPort': systemPort,
        'appium:deviceName': deviceId,
        'appium:noReset': true,
        'appium:newCommandTimeout': 300,
        'appium:autoGrantPermissions': true
      },
      logLevel: 'warn'
    };

    try {
      const driver = await remote(params);
      activeSessions.set(deviceId, driver);
      return driver;
    } catch (e) {
      lastError = e as Error;
      const msg = lastError.message || '';
      if (msg.includes('port') && msg.includes('busy') && attempt < 2) {
        console.warn(`[USSD] systemPort ${systemPort} busy — retrying (${attempt + 2}/3)...`);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error('Failed to create Appium session for USSD');
}

async function quitDriver(deviceId: string, driver?: WebdriverIO.Browser): Promise<void> {
  const session = driver ?? activeSessions.get(deviceId);
  if (!session) return;
  try {
    await session.deleteSession();
  } catch {
    /* ignore */
  }
  activeSessions.delete(deviceId);
}

export { createDriver, quitDriver, closeExistingSession };
