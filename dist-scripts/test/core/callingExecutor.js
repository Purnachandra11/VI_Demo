"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeIncomingCall = exports.executeOutgoingCall = exports.executeCall = exports.CompleteCallingTestExecutor = void 0;
const excelReader_1 = require("../utils/excelReader");
const callExecutor_1 = require("./callExecutor");
const env_1 = require("../utils/env");
const progressReporter_1 = require("../utils/progressReporter");
const ADBHelper_1 = require("../utils/ADBHelper");
const reporting_1 = require("../reporting");
/**  CompleteCallingTestExecutor — Excel-driven calling suite */
class CompleteCallingTestExecutor {
    constructor(_driver, aPartyDeviceId) {
        this.deviceId = aPartyDeviceId;
    }
    async executeAllCallingTests(excelFilePath) {
        var _a, _b;
        const ctx = (0, env_1.getRunContext)();
        const rows = await (0, excelReader_1.readCallingRows)(excelFilePath);
        const results = [];
        if (!rows.length) {
            console.log(' No calling test data found');
            return results;
        }
        await progressReporter_1.ProgressReporter.initializeTestSuite(this.deviceId, rows.length);
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            console.log(`\n📞 TEST ${i + 1}/${rows.length}: ${row.name}`);
            const options = {
                testName: row.name,
                callType: (((_a = row.callType) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'VOICE'),
                direction: (((_b = row.direction) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || 'OUTGOING'),
                duration: row.duration,
                attempts: row.attempts,
                preferredNetwork: row.preferredNetwork,
                aPartyNumber: row.aPartyNumber || ctx.aPartyNumber,
                bPartyNumber: row.bPartyNumber,
                cPartyNumber: row.cPartyNumber,
                bPartyDevice: ctx.bPartyDevice,
                volteSupported: row.volteSupported
            };
            if (row.preferredNetwork && row.preferredNetwork !== 'AUTO') {
                await this.setNetworkType(this.deviceId, row.preferredNetwork);
                await new Promise((r) => setTimeout(r, 3000));
            }
            const callResult = await (0, callExecutor_1.executeCall)({
                ...options,
                attempts: row.attempts || options.attempts || 1
            });
            results.push({
                name: row.name,
                callType: row.callType,
                direction: row.direction,
                preferredNetwork: row.preferredNetwork,
                callerNumber: options.aPartyNumber,
                receiverNumber: row.bPartyNumber,
                finalStatus: callResult.finalStatus,
                actualDuration: callResult.activeSec,
                ringTime: callResult.ringingSec,
                connected: callResult.connected,
                attemptNumber: row.attempts,
                volteSupported: row.volteSupported,
                testTimestamp: new Date().toISOString()
            });
            await new Promise((r) => setTimeout(r, 3000));
        }
        try {
            await (0, reporting_1.flushReports)();
        }
        catch (e) {
            console.warn('[Calling] Report flush:', e.message);
        }
        await progressReporter_1.ProgressReporter.reportTestComplete(this.deviceId, 'calling', results.every((r) => r.finalStatus === 'SUCCESS'), `Completed ${results.length} calling tests`);
        return results;
    }
    async setNetworkType(deviceId, type) {
        var _a;
        const modeMap = {
            '2G': 1,
            '3G': 3,
            '4G': 11,
            LTE: 11,
            '5G': 33
        };
        const mode = (_a = modeMap[type.toUpperCase()]) !== null && _a !== void 0 ? _a : 33;
        for (const cmd of [
            `settings put global preferred_network_mode ${mode}`,
            `cmd phone set-preferred-network-type-for-slot -s 0 ${mode}`
        ]) {
            await ADBHelper_1.ADBHelper.adbShell(deviceId, cmd).catch(() => { });
        }
    }
}
exports.CompleteCallingTestExecutor = CompleteCallingTestExecutor;
var callExecutor_2 = require("./callExecutor");
Object.defineProperty(exports, "executeCall", { enumerable: true, get: function () { return callExecutor_2.executeCall; } });
Object.defineProperty(exports, "executeOutgoingCall", { enumerable: true, get: function () { return callExecutor_2.executeOutgoingCall; } });
Object.defineProperty(exports, "executeIncomingCall", { enumerable: true, get: function () { return callExecutor_2.executeIncomingCall; } });
