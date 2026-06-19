import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/** WDIO defaults rootDir to the config file folder — must be project root for test/specs paths */
export const PROJECT_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

function systemPortForDevice(deviceId: string): number {
  const hash = Math.abs(
    deviceId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  );
  // Use 8300–8999 range to avoid stale UiAutomator2 on 8200–8299
  return 8300 + (hash % 699);
}

export function androidCapabilities(deviceId: string): WebdriverIO.Capabilities {
  return {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': deviceId,
    'appium:deviceName': deviceId,
    'appium:systemPort': systemPortForDevice(deviceId),
    'appium:noReset': true,
    'appium:newCommandTimeout': 300
  };
}

export function resolveSpecs(): string[] {
  const fromEnv = process.env.WDIO_SPECS;
  if (fromEnv) {
    return fromEnv.split(',').map((entry) => {
      const trimmed = entry.trim().replace(/^\.\//, '');
      const absolute = path.isAbsolute(trimmed)
        ? trimmed
        : path.join(PROJECT_ROOT, trimmed);
      if (!fs.existsSync(absolute)) {
        console.warn(`[WDIO] Spec file not found: ${absolute}`);
      }
      return absolute;
    });
  }
  return [path.join(PROJECT_ROOT, 'test', 'specs', '**', '*.spec.ts')];
}

export const sharedConfig = {
  rootDir: PROJECT_ROOT,
  runner: 'local' as const,
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json'
    }
  },
  specs: resolveSpecs(),
  exclude: [],
  maxInstances: parseInt(process.env.WDIO_MAX_INSTANCES || '2', 10),
  logLevel: 'warn',
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,
  framework: 'mocha',
  reporters: [
    'spec',
    ['junit', {
      outputDir: path.join(PROJECT_ROOT, 'reports', 'junit'),
      outputFileFormat: (opts: { cid: string }) => `results-${opts.cid}.xml`
    }],
    ['allure', {
      outputDir: path.join(PROJECT_ROOT, 'allure-results'),
      disableWebdriverStepsReporting: false,
      disableWebdriverScreenshotsReporting: false,
      addConsoleLogs: true,
      reportedEnvironmentVars: ['APARTY_DEVICE', 'APARTY_NUMBER', 'EXCEL_FILE']
    }]
  ],
  mochaOpts: {
    ui: 'bdd',
    timeout: 600000
  },
  hostname: process.env.APPIUM_HOST || '127.0.0.1',
  port: parseInt(process.env.APPIUM_PORT || '4723', 10),
  path: '/'
} as unknown as Partial<WebdriverIO.Config>;
