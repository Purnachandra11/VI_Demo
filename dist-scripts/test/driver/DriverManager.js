"use strict";
// D:\New VI UAT PROJECT\WIP\Automation Folder\VI Demo 31.05.2026\VI Demo\test\driver\DriverManager.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverManager = void 0;
const webdriverio_1 = require("webdriverio");
const globals_1 = require("@wdio/globals");
const ConfigReader_1 = require("../config/ConfigReader");
const ADBHelper_1 = require("../utils/ADBHelper");
const wdio_shared_1 = require("../../config/wdio.shared");
const path_1 = __importDefault(require("path"));
const APPIUM_URL = process.env.APPIUM_URL ||
    `http://${process.env.APPIUM_HOST || '127.0.0.1'}:${process.env.APPIUM_PORT || '4723'}`;
let extraDriver;
let usingWdioSession = false;
function systemPortForDevice(deviceId) {
    const hash = Math.abs(deviceId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
    return 8300 + (hash % 699);
}
/** DriverManager — WDIO-native session handling */
class DriverManager {
    static async startAppiumService() {
        try {
            const res = await fetch(`${APPIUM_URL}/status`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                console.log('[DriverManager] Appium server is running');
                return;
            }
        }
        catch {
            console.warn('[DriverManager] Appium not reachable — start with: appium');
        }
    }
    static async stopAppiumService() {
        console.log('[DriverManager] Leaving Appium server running (dashboard reuse)');
    }
    static isServiceRunning() {
        return true;
    }
    static baseCaps(deviceId, platformVersion) {
        return {
            ...(0, wdio_shared_1.androidCapabilities)(deviceId),
            'appium:platformVersion': platformVersion,
            'appium:systemPort': systemPortForDevice(deviceId)
        };
    }
    /** Use WDIO global session when inside a WDIO test; otherwise create remote */
    static async resolveBrowser(deviceId, platformVersion, appPackage, appActivity) {
        try {
            if (globals_1.browser === null || globals_1.browser === void 0 ? void 0 : globals_1.browser.sessionId) {
                usingWdioSession = true;
                return globals_1.browser;
            }
        }
        catch {
            /* not in WDIO context */
        }
        const caps = {
            ...this.baseCaps(deviceId, platformVersion),
            ...(appPackage
                ? {
                    'appium:appPackage': appPackage,
                    'appium:appActivity': appActivity
                }
                : {})
        };
        extraDriver = (await (0, webdriverio_1.remote)({
            hostname: new URL(APPIUM_URL).hostname,
            port: parseInt(new URL(APPIUM_URL).port || '4723', 10),
            path: '/',
            capabilities: caps,
            logLevel: 'warn'
        }));
        usingWdioSession = false;
        return extraDriver;
    }
    static async initializeDriver(deviceId, platformVersion) {
        await ADBHelper_1.ADBHelper.grantPermissions(deviceId);
        return this.resolveBrowser(deviceId, platformVersion, ConfigReader_1.ConfigReader.getAppPackage(), ConfigReader_1.ConfigReader.getAppActivity());
    }
    static async initializeDriverForMessaging(deviceId, platformVersion) {
        await ADBHelper_1.ADBHelper.grantPermissions(deviceId);
        return this.resolveBrowser(deviceId, platformVersion, ConfigReader_1.ConfigReader.getMessageAppPackage(), ConfigReader_1.ConfigReader.getMessageAppActivity());
    }
    static async initializeDriverForDataUsage(deviceId, platformVersion) {
        return this.resolveBrowser(deviceId, platformVersion);
    }
    static async createDriverWithCapabilities(capabilities) {
        extraDriver = (await (0, webdriverio_1.remote)({
            hostname: new URL(APPIUM_URL).hostname,
            port: parseInt(new URL(APPIUM_URL).port || '4723', 10),
            path: '/',
            capabilities,
            logLevel: 'warn'
        }));
        usingWdioSession = false;
        return extraDriver;
    }
    static getDriver() {
        if (usingWdioSession)
            return globals_1.browser;
        return extraDriver;
    }
    static async quitDriver() {
        if (extraDriver && !usingWdioSession) {
            await extraDriver.deleteSession();
            extraDriver = undefined;
        }
    }
    static getScreenshotRoot() {
        return path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'screenshots');
    }
}
exports.DriverManager = DriverManager;
