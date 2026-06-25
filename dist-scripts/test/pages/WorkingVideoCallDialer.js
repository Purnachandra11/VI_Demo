"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkingVideoCallDialer = void 0;
const adb_1 = require("../utils/adb");
const ElementConfig_1 = require("../config/ElementConfig");
/**  WorkingVideoCallDialer — video intent + timer detection */
class WorkingVideoCallDialer {
    constructor(driver, deviceId) {
        this.driver = driver;
        this.deviceId = deviceId;
    }
    async makeVideoCall(phoneNumber, targetDurationSeconds, maxAttempts = 1) {
        const result = {
            phoneNumber,
            connected: false,
            targetDuration: targetDurationSeconds,
            actualDuration: 0,
            callStatus: 'NOT_CONNECTED',
            attemptNumber: 0
        };
        console.log('\n' + '='.repeat(80));
        console.log('INITIATING VIDEO CALL');
        console.log(`Number: ${phoneNumber} | Target: ${targetDurationSeconds}s`);
        console.log('='.repeat(80));
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            result.attemptNumber = attempt;
            console.log(`\nAttempt ${attempt}/${maxAttempts}`);
            const initiated = await this.dialVideoCallIntent(phoneNumber);
            if (!initiated) {
                result.callStatus = 'FAILED_TO_INITIATE';
                continue;
            }
            const conn = await this.waitForVideoConnection(targetDurationSeconds);
            result.ringTime = conn.ringTimeSec;
            if (conn.connected) {
                result.connected = true;
                result.actualDuration = conn.actualDuration;
                result.callStatus = 'CONNECTED';
                result.videoQuality = conn.videoQuality;
                await this.endVideoCall();
                break;
            }
            result.callStatus = conn.failureReason || 'TIMEOUT';
            result.failureReason = conn.failureReason;
            await this.endVideoCall().catch(() => { });
            if (attempt < maxAttempts) {
                await this.driver.pause(5000);
            }
        }
        return result;
    }
    async dialVideoCallIntent(phoneNumber) {
        try {
            const id = this.deviceId || String(this.driver.capabilities['appium:udid']);
            const cmd = `am start -a android.intent.action.CALL -d tel:${phoneNumber} --ei android.telecom.extra.START_CALL_WITH_VIDEO_STATE 3`;
            await (0, adb_1.adbShell)(id, cmd);
            await this.driver.pause(2000);
            const src = await this.driver.getPageSource();
            return (/video|camera|calling|dialing|00:/i.test(src) ||
                /end call|mute|speaker/i.test(src));
        }
        catch (e) {
            console.error(`Video call intent failed: ${e.message}`);
            return false;
        }
    }
    async waitForVideoConnection(targetDurationSeconds) {
        const ringStart = Date.now();
        let connected = false;
        while (Date.now() - ringStart < 30000) {
            try {
                const timer = await this.driver.$('//android.widget.TextView[contains(@text, ":")]');
                if (await timer.isDisplayed()) {
                    const text = await timer.getText();
                    if (/^\d{1,2}:\d{2}$/.test(text) || text.startsWith('00:')) {
                        connected = true;
                        break;
                    }
                }
            }
            catch {
                /* retry */
            }
            await this.driver.pause(500);
        }
        const ringTimeSec = (Date.now() - ringStart) / 1000;
        if (!connected) {
            return {
                connected: false,
                actualDuration: 0,
                ringTimeSec,
                videoQuality: 'N/A',
                failureReason: 'TIMEOUT'
            };
        }
        const holdStart = Date.now();
        await this.driver.pause(targetDurationSeconds * 1000);
        return {
            connected: true,
            actualDuration: (Date.now() - holdStart) / 1000,
            ringTimeSec,
            videoQuality: 'STANDARD'
        };
    }
    async endVideoCall() {
        for (const sel of (0, ElementConfig_1.getEndCallButtonOptions)()) {
            try {
                const el = await this.driver.$(sel);
                if (await el.isDisplayed()) {
                    await el.click();
                    return;
                }
            }
            catch {
                /* next */
            }
        }
        await this.driver.pressKeyCode(6);
    }
}
exports.WorkingVideoCallDialer = WorkingVideoCallDialer;
