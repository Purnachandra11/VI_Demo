import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

export const config = {
  runner: 'local',
  specs: ['./src/specs/swift.login.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--allow-insecure-localhost',
          '--window-size=1920,1080',
        ],
        excludeSwitches: ['enable-automation'],
      },
    },
  ],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 180000,
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
    await browser.maximizeWindow();
    
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.resolve('./screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    // Create captcha screenshots directory if it doesn't exist
    const captchaDir = path.resolve('./captcha_screenshots');
    if (!fs.existsSync(captchaDir)) {
      fs.mkdirSync(captchaDir, { recursive: true });
    }
  },
  afterTest: async (test, _context, { error }) => {
    if (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.resolve(`./screenshots/FAILED_${test.title.replace(/\s+/g, '_')}_${timestamp}.png`);
      await browser.saveScreenshot(screenshotPath);
      console.error(`[Hook] Screenshot saved for failed test: ${test.title}`);
    }
  },
  logLevel: 'info',
  bail: 0,
  baseUrl: 'https://swiftcrm.vodafoneidea.in',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
};
