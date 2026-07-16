import type { Options } from '@wdio/types';

// Device id can be passed in via env var, e.g. DEVICE_ID=emulator-5554 npm test
const deviceId = process.env.DEVICE_ID || undefined;

export const config: Options.Testrunner = {
    runner: 'local',
    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            transpileOnly: true,
            project: './tsconfig.json'
        }
    },

    specs: ['./test/specs/**/*.ts'],
    exclude: [],

    maxInstances: 1,

    capabilities: [
        {
            platformName: 'Android',
            'appium:automationName': 'UiAutomator2',
            'appium:udid': deviceId,
            'appium:noReset': true,
            'appium:newCommandTimeout': 240,
            // We are NOT launching a specific app package on session start
            // because we drive the native com.android.stk (SIM Toolkit) app
            // via ADB, mirroring the original Java framework's launch flow.
            'appium:autoLaunch': false
        }
    ],

    logLevel: 'info',
    bail: 0,
    baseUrl: '',
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    services: [
        [
            'appium',
            {
                command: 'appium',
                args: {
                    address: 'localhost',
                    port: 4723
                }
            }
        ]
    ],

    framework: 'mocha',
    reporters: ['spec'],

    mochaOpts: {
        ui: 'bdd',
        timeout: 180000
    }
};
