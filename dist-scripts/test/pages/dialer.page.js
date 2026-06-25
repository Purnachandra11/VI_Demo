"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialerPage = void 0;
const adb_1 = require("../utils/adb");
class DialerPage {
    constructor(deviceId, receiveDeviceId) {
        this.deviceId = deviceId;
        this.receiveDeviceId = receiveDeviceId;
    }
    async dial(number) {
        await (0, adb_1.startCall)(this.deviceId, number);
    }
    async waitForCallTimer(timeoutMs = 20000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const el = await $('//android.widget.TextView[contains(@text, ":")]');
                const text = await el.getText();
                if (/^\d{1,2}:\d{2}$/.test(text))
                    return true;
            }
            catch {
                /* retry */
            }
            await browser.pause(500);
        }
        return false;
    }
    async holdActiveCall(durationSec) {
        await browser.pause(durationSec * 1000);
    }
    async endCall() {
        try {
            await browser.pressKeyCode(6);
        }
        catch {
            await (0, adb_1.endCallKey)(this.deviceId);
        }
    }
    async answerOnBParty() {
        if (!this.receiveDeviceId)
            return;
        const answerKeywords = ['answer', 'accept', 'receive', 'उत्तर', 'स्वीकार'];
        const buttons = await $$('//android.widget.Button | //android.widget.TextView | //android.widget.ImageButton');
        for (const el of buttons) {
            const text = ((await el.getText()) || '').toLowerCase();
            if (answerKeywords.some((k) => text.includes(k))) {
                await el.click();
                return;
            }
        }
        await browser.pressKeyCode(5);
    }
}
exports.DialerPage = DialerPage;
