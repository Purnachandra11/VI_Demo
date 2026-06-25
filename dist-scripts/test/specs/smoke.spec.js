"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const adb_1 = require("../utils/adb");
const env_1 = require("../utils/env");
describe('Smoke — WDIO + Appium stack', () => {
    it('should see at least one ADB device', async () => {
        const devices = await (0, adb_1.listDevices)();
        expect(devices.length).toBeGreaterThan(0);
    });
    it('should load run context from environment', async () => {
        const ctx = (0, env_1.getRunContext)();
        expect(ctx.aPartyDevice || process.env.APARTY_DEVICE).toBeTruthy();
    });
});
