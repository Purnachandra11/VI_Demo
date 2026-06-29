// wdio.recharge.conf.ts
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

const HEADLESS = process.env.HEADLESS !== 'false';

const chromeArgs = [
  '--disable-blink-features=AutomationControlled',
  '--ignore-certificate-errors',
  '--ignore-ssl-errors',
  '--allow-insecure-localhost',
  '--window-size=1920,1080',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-setuid-sandbox',
  '--disable-browser-side-navigation',
  '--disable-infobars',
  '--disable-notifications',
  '--disable-features=OutOfBlinkCors',
  '--disable-features=BlockInsecurePrivateNetworkRequests',
  '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
  '--force-fieldtrials=',
  '--use-system-default-privacy-screen',
  '--dns-prefetch-disable',
];

if (HEADLESS) {
  chromeArgs.push('--headless=new');
} else {
  chromeArgs.push('--start-maximized');
}

export const config = {
  runner: 'local',
  specs: ['./src/specs/swift_recharge_spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: chromeArgs,
        excludeSwitches: ['enable-automation'],
      },
    },
  ],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 24 * 60 * 60 * 1000,
  },
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json',
    },
  },
  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],
  before: async () => {
    if (!HEADLESS) {
      await browser.maximizeWindow();
    }

    const screenshotsDir = path.resolve('./screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const captchaDir = path.resolve('./captcha_screenshots');
    if (!fs.existsSync(captchaDir)) {
      fs.mkdirSync(captchaDir, { recursive: true });
    }

    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    console.log(`[WDIO] Single-batch run starting — Headless: ${HEADLESS}`);
  },

  afterTest: async (test, _context, { error }) => {
    if (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.resolve(`./screenshots/FAILED_${test.title.replace(/\s+/g, '_')}_${timestamp}.png`);
      try {
        await browser.saveScreenshot(screenshotPath);
        console.error(`[Hook] Screenshot saved for failed test: ${test.title}`);
      } catch (e) {
        console.warn('[Hook] Could not save screenshot:', e);
      }
    }
  },

  onComplete: async () => {
    console.log('[WDIO] Batch finished — browser session can be closed manually.');
  },

  logLevel: 'info',
  bail: 0,
  baseUrl: 'https://swiftcrm.vodafoneidea.in',
  waitforTimeout: 30000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
};