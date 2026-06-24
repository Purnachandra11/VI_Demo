// test/config/wdio.siebel.conf.ts

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config: WebdriverIO.Config = {
  runner: 'local',

  specs: [
    path.join(__dirname, '../specs/siebel_invoice_validation.spec.ts'),
  ],
  exclude: [],

  capabilities: [
    {
      browserName: 'chrome',
      acceptInsecureCerts: true,
      'goog:chromeOptions': {
        args: [
          '--ignore-certificate-errors',
          '--disable-web-security',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        binary: process.env.CHROME_BIN || undefined,
      },
    },
  ],

  automationProtocol: 'webdriver',
  path: '/',

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 600000,
  },

  reporters: [
    'spec',
    ['junit', {
      outputDir: './reports/junit',
      outputFileFormat: (opts: { cid: string }) => `siebel-${opts.cid}.xml`,
    }],
  ],

  waitforTimeout: 30_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  before() {
    console.log('\n' + '='.repeat(80));
    console.log('🌐 SIEBEL INVOICE VALIDATION SUITE');
    console.log('='.repeat(80));
    console.log(`   URL  : ${process.env.SIEBEL_URL ?? '(default)'}`);
    console.log(`   User : ${process.env.SIEBEL_USERNAME ?? '(not set)'}`);
    console.log('='.repeat(80) + '\n');
  },

  afterTest(test, _ctx, result) {
    console.log(`${result.passed ? '✅' : '❌'} ${test.fullTitle}`);
  },
};