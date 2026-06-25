"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedConfig = exports.PROJECT_ROOT = void 0;
exports.androidCapabilities = androidCapabilities;
exports.resolveSpecs = resolveSpecs;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
/** WDIO defaults rootDir to the config file folder — must be project root for test/specs paths */
exports.PROJECT_ROOT = path_1.default.resolve(__dirname, '..');
dotenv_1.default.config({ path: path_1.default.join(exports.PROJECT_ROOT, '.env') });
function systemPortForDevice(deviceId) {
    const hash = Math.abs(deviceId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
    // Use 8300–8999 range to avoid stale UiAutomator2 on 8200–8299
    return 8300 + (hash % 699);
}
function androidCapabilities(deviceId) {
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
function resolveSpecs() {
    const fromEnv = process.env.WDIO_SPECS;
    if (fromEnv) {
        return fromEnv.split(',').map((entry) => {
            const trimmed = entry.trim().replace(/^\.\//, '');
            const absolute = path_1.default.isAbsolute(trimmed)
                ? trimmed
                : path_1.default.join(exports.PROJECT_ROOT, trimmed);
            if (!fs_1.default.existsSync(absolute)) {
                console.warn(`[WDIO] Spec file not found: ${absolute}`);
            }
            return absolute;
        });
    }
    return [path_1.default.join(exports.PROJECT_ROOT, 'test', 'specs', '**', '*.spec.ts')];
}
exports.sharedConfig = {
    rootDir: exports.PROJECT_ROOT,
    runner: 'local',
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
                outputDir: path_1.default.join(exports.PROJECT_ROOT, 'reports', 'junit'),
                outputFileFormat: (opts) => `results-${opts.cid}.xml`
            }],
        ['allure', {
                outputDir: path_1.default.join(exports.PROJECT_ROOT, 'allure-results'),
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
};
