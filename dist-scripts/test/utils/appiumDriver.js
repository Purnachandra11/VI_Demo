"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDriver = createDriver;
exports.quitDriver = quitDriver;
exports.closeExistingSession = closeExistingSession;
const webdriverio_1 = require("webdriverio");
/** Per-device UiAutomator2 port — aligned with DriverManager (8300–8999) */
function getSystemPort(deviceId, attempt = 0) {
    const hash = deviceId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return 8300 + ((hash + attempt * 31) % 699);
}
const activeSessions = new Map();
async function closeExistingSession(deviceId) {
    const existing = activeSessions.get(deviceId);
    if (!existing)
        return;
    try {
        await existing.deleteSession();
    }
    catch {
        /* session may already be gone */
    }
    activeSessions.delete(deviceId);
}
async function createDriver(deviceId) {
    await closeExistingSession(deviceId);
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        const systemPort = getSystemPort(deviceId, attempt);
        const params = {
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
            const driver = await (0, webdriverio_1.remote)(params);
            activeSessions.set(deviceId, driver);
            return driver;
        }
        catch (e) {
            lastError = e;
            const msg = lastError.message || '';
            if (msg.includes('port') && msg.includes('busy') && attempt < 2) {
                console.warn(`[USSD] systemPort ${systemPort} busy — retrying (${attempt + 2}/3)...`);
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }
            throw lastError;
        }
    }
    throw lastError !== null && lastError !== void 0 ? lastError : new Error('Failed to create Appium session for USSD');
}
async function quitDriver(deviceId, driver) {
    const session = driver !== null && driver !== void 0 ? driver : activeSessions.get(deviceId);
    if (!session)
        return;
    try {
        await session.deleteSession();
    }
    catch {
        /* ignore */
    }
    activeSessions.delete(deviceId);
}
