"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const child_process_1 = require("child_process");
const wdio_shared_1 = require("./wdio.shared");
const wdio_hooks_1 = require("./wdio.hooks");
function detectFirstDevice() {
    try {
        const out = (0, child_process_1.execSync)('adb devices', { encoding: 'utf8' });
        const line = out
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l && l.endsWith('device') && !l.startsWith('List'));
        return line ? line.split(/\s+/)[0] : '';
    }
    catch {
        return '';
    }
}
const deviceId = process.env.APARTY_DEVICE ||
    process.env.deviceId ||
    process.env.DEVICE_ID ||
    detectFirstDevice();
if (!deviceId) {
    console.warn('[WDIO] No APARTY_DEVICE set and no adb device found. Connect a device or set APARTY_DEVICE in .env');
}
else if (!process.env.APARTY_DEVICE) {
    console.log(`[WDIO] Using detected device: ${deviceId}`);
}
exports.config = {
    ...wdio_shared_1.sharedConfig,
    specs: (0, wdio_shared_1.resolveSpecs)(),
    capabilities: deviceId ? [(0, wdio_shared_1.androidCapabilities)(deviceId)] : [],
    services: [],
    ...wdio_hooks_1.hooks,
    /**
     * expect-webdriverio soft assertions / auto-wait
     * @see https://webdriver.io/docs/api/expect-webdriverio
     */
    injectGlobals: true
};
