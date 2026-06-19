"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hooks = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const wdio_shared_1 = require("./wdio.shared");
const failureAnalyzer_1 = require("../test/ai/failureAnalyzer");
const testSummarizer_1 = require("../test/ai/testSummarizer");
const reporting_1 = require("../test/reporting");
const resultStore_1 = require("../test/reporting/resultStore");
const screenshotsDir = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'screenshots');
const logsDir = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'logs');
function ensureDirs() {
    const dirs = [
        screenshotsDir,
        logsDir,
        path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'reports'),
        path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'test-output', 'comprehensive-reports')
    ];
    for (const dir of dirs) {
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
function getDeviceIdFromCapabilities(capabilities) {
    if (!capabilities || typeof capabilities !== 'object')
        return undefined;
    if (Array.isArray(capabilities)) {
        return getDeviceIdFromCapabilities(capabilities[0]);
    }
    const c = capabilities;
    if (c.alwaysMatch && typeof c.alwaysMatch === 'object') {
        return c.alwaysMatch['appium:udid'];
    }
    return c['appium:udid'];
}
exports.hooks = {
    onPrepare: async () => {
        ensureDirs();
        (0, resultStore_1.clearResults)();
        (0, testSummarizer_1.clearAiFailures)();
        const excel = process.env.EXCEL_FILE;
        if (excel) {
            console.log(`[WDIO] EXCEL_FILE=${excel} (exists=${fs_1.default.existsSync(excel)})`);
        }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeSession: async (_config, capabilities) => {
        const deviceId = getDeviceIdFromCapabilities(capabilities);
        if (!deviceId)
            return;
        try {
            (0, child_process_1.execSync)(`adb -s "${deviceId}" shell am force-stop io.appium.uiautomator2.server`, {
                stdio: 'ignore'
            });
            (0, child_process_1.execSync)(`adb -s "${deviceId}" shell am force-stop io.appium.uiautomator2.server.test`, {
                stdio: 'ignore'
            });
        }
        catch {
            /* device may be offline */
        }
    },
    beforeTest: async (test) => {
        console.log(`[WDIO] Starting: ${test.title}`);
    },
    afterTest: async (test, _context, result) => {
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
        }
        catch {
            /* allure optional */
        }
        if (!result.passed && result.error) {
            const analyzer = new failureAnalyzer_1.FailureAnalyzer();
            const summary = await analyzer.analyzeAsync(result.error, test.title);
            console.log(`[AI] ${summary.rootCause}`);
            console.log(`[AI] Suggestions: ${summary.suggestions.join('; ')}`);
            (0, testSummarizer_1.recordAiFailure)({
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
            }
            catch {
                /* session may be closed */
            }
        }
        console.log(`[WDIO] Test ${status}: ${test.title}`);
    },
    onComplete: async () => {
        const summarizer = new testSummarizer_1.TestSummarizer();
        const reportPath = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'reports', 'execution-summary.json');
        summarizer.writeSummary(reportPath);
        console.log(`[WDIO] Execution summary: ${reportPath}`);
        try {
            await (0, reporting_1.flushReports)();
            console.log('[WDIO] Excel + HTML reports → test-output/comprehensive-reports/');
            console.log('[WDIO] Allure raw results → allure-results/ (run: npm run report:allure)');
        }
        catch (err) {
            console.error('[WDIO] Report generation failed:', err.message);
        }
    }
};
