import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './wdio.shared';
import { FailureAnalyzer } from '../test/ai/failureAnalyzer';
import { TestSummarizer, clearAiFailures, recordAiFailure } from '../test/ai/testSummarizer';
import { flushReports } from '../test/reporting';
import { clearResults } from '../test/reporting/resultStore';

const screenshotsDir = path.join(PROJECT_ROOT, 'screenshots');
const logsDir = path.join(PROJECT_ROOT, 'logs');

function ensureDirs(): void {
  const dirs = [
    screenshotsDir,
    logsDir,
    path.join(PROJECT_ROOT, 'reports'),
    path.join(PROJECT_ROOT, 'test-output', 'comprehensive-reports')
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function getDeviceIdFromCapabilities(capabilities: unknown): string | undefined {
  if (!capabilities || typeof capabilities !== 'object') return undefined;
  if (Array.isArray(capabilities)) {
    return getDeviceIdFromCapabilities(capabilities[0]);
  }
  const c = capabilities as Record<string, unknown>;
  if (c.alwaysMatch && typeof c.alwaysMatch === 'object') {
    return (c.alwaysMatch as Record<string, unknown>)['appium:udid'] as string | undefined;
  }
  return c['appium:udid'] as string | undefined;
}

export const hooks = {
  onPrepare: async () => {
    ensureDirs();
    clearResults();
    clearAiFailures();
    const excel = process.env.EXCEL_FILE;
    if (excel) {
      console.log(`[WDIO] EXCEL_FILE=${excel} (exists=${fs.existsSync(excel)})`);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeSession: async (_config: any, capabilities: any) => {
    const deviceId = getDeviceIdFromCapabilities(capabilities);
    if (!deviceId) return;
    try {
      execSync(`adb -s "${deviceId}" shell am force-stop io.appium.uiautomator2.server`, {
        stdio: 'ignore'
      });
      execSync(`adb -s "${deviceId}" shell am force-stop io.appium.uiautomator2.server.test`, {
        stdio: 'ignore'
      });
    } catch {
      /* device may be offline */
    }
  },

  beforeTest: async (test: { title: string }) => {
    console.log(`[WDIO] Starting: ${test.title}`);
  },

  afterTest: async (
    test: { title: string },
    _context: unknown,
    result: { passed?: boolean; error?: Error }
  ) => {
    const status = result.passed ? 'passed' : 'failed';
    try {
      // @ts-expect-error allure global from @wdio/allure-reporter
      if (typeof allure !== 'undefined') {
        // @ts-expect-error allure API
        allure.addLabel('test', test.title);
        // @ts-expect-error allure API
        allure.addSeverity(result.passed ? 'normal' : 'critical');
        if (result.error) {
          // @ts-expect-error allure API
          allure.addAttachment('Error', result.error.message, 'text/plain');
        }
      }
    } catch {
      /* allure optional */
    }

    if (!result.passed && result.error) {
      const analyzer = new FailureAnalyzer();
      const summary = await analyzer.analyzeAsync(result.error, test.title);
      console.log(`[AI] ${summary.rootCause}`);
      console.log(`[AI] Suggestions: ${summary.suggestions.join('; ')}`);
      recordAiFailure({
        test: test.title,
        category: summary.category,
        rootCause: summary.rootCause,
        suggestions: summary.suggestions
      });

      try {
        const png = await browser.takeScreenshot();
        // @ts-expect-error allure API
        if (typeof allure !== 'undefined' && png) {
          // @ts-expect-error allure API
          allure.addAttachment('Screenshot', Buffer.from(png, 'base64'), 'image/png');
        }
      } catch {
        /* session may be closed */
      }
    }
    console.log(`[WDIO] Test ${status}: ${test.title}`);
  },

  onComplete: async () => {
    const summarizer = new TestSummarizer();
    const reportPath = path.join(PROJECT_ROOT, 'reports', 'execution-summary.json');
    summarizer.writeSummary(reportPath);
    console.log(`[WDIO] Execution summary: ${reportPath}`);

    try {
      await flushReports();
      console.log('[WDIO] Excel + HTML reports → test-output/comprehensive-reports/');
      console.log('[WDIO] Allure raw results → allure-results/ (run: npm run report:allure)');
    } catch (err) {
      console.error('[WDIO] Report generation failed:', (err as Error).message);
    }
  }
};
