"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataUsageTestExecutor = void 0;
exports.executeDataUsage = executeDataUsage;
exports.executeDataUsageTest = executeDataUsageTest;
const adb_1 = require("../utils/adb");
const progressReporter_1 = require("../utils/progressReporter");
const env_1 = require("../utils/env");
const resultStore_1 = require("../reporting/resultStore");
const ussdService_1 = require("../utils/ussdService");
//  Constants () ─
const MAX_USSD_RETRIES = 2;
const USSD_WAIT_BEFORE_DATA = 5000; // ms
const USSD_WAIT_AFTER_DATA = 8000; // ms
// Mobile interfaces to check —  getMobileDataBytes()
const MOBILE_INTERFACES = ['ccmni1', 'rmnet_data0', 'rmnet_data1', 'rmnet0'];
//  Helpers 
function cleanNumber(num) {
    const digits = num.replace(/[^0-9]/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
}
async function isDeviceConnected(deviceId) {
    try {
        return (await (0, adb_1.adbShell)(deviceId, 'echo ok')).trim() === 'ok';
    }
    catch {
        return false;
    }
}
/**  resetDriverAfterUSSD() */
async function resetDriverAfterUSSD(deviceId) {
    try {
        await (0, adb_1.adbShell)(deviceId, 'am force-stop com.google.android.dialer');
        await new Promise(r => setTimeout(r, 2000));
    }
    catch { /* ignore */ }
    try {
        await (0, adb_1.adbShell)(deviceId, 'input keyevent 3');
        await new Promise(r => setTimeout(r, 1000));
    }
    catch { /* ignore */ }
}
async function prepareForUSSD(deviceId) {
    await (0, adb_1.adbShell)(deviceId, 'am force-stop com.android.dialer').catch(() => { });
    await (0, adb_1.adbShell)(deviceId, 'am force-stop com.google.android.dialer').catch(() => { });
    await (0, adb_1.adbShell)(deviceId, 'input keyevent 3').catch(() => { });
    await new Promise(r => setTimeout(r, 1000));
}
/**
 *  performUSSDCheckWithRetry() — with device connectivity guard.
 */
async function performUSSDCheckWithRetry(deviceId, checkType, phoneNumber) {
    console.log(`\n💰 ${checkType} BALANCE CHECK...`);
    for (let attempt = 1; attempt <= MAX_USSD_RETRIES; attempt++) {
        console.log(`   🔄 Attempt ${attempt}/${MAX_USSD_RETRIES}`);
        if (!await isDeviceConnected(deviceId)) {
            console.log(`   ❌ Device disconnected: ${deviceId}`);
            return { success: false, error: 'Device disconnected', deviceDisconnected: true };
        }
        try {
            await prepareForUSSD(deviceId);
            const result = checkType === 'BEFORE'
                ? await (0, ussdService_1.getOrPerformPreTestUSSD)(deviceId, phoneNumber)
                : await (0, ussdService_1.performPostTestUSSD)(deviceId, phoneNumber);
            await resetDriverAfterUSSD(deviceId);
            if (result.success) {
                console.log('    USSD SUCCESS');
                console.log(`      Phone   : ${result.phoneNumber}`);
                console.log(`      Balance : ${result.balance}`);
                if (result.validity)
                    console.log(`      Validity: ${result.validity}`);
                // Phone number mismatch warning ()
                if (result.phoneNumber && phoneNumber) {
                    const expected = cleanNumber(phoneNumber);
                    const detected = cleanNumber(result.phoneNumber);
                    if (expected !== detected) {
                        console.log(`     Phone mismatch! Expected: ${expected} | Detected: ${detected}`);
                    }
                    else {
                        console.log(`    Phone verified: ${detected}`);
                    }
                }
                if (result.cachedFromPreviousTest) {
                    console.log('   ♻️  Balance reused from previous test (preDataUSSDSource: CACHED)');
                }
                else {
                    console.log('   🔄 Fresh USSD check (preDataUSSDSource: NEW_CHECK)');
                }
                return result;
            }
            console.log(`   ❌ USSD error: ${result.error}`);
        }
        catch (e) {
            console.error(`   ❌ USSD attempt failed: ${e.message}`);
            try {
                await resetDriverAfterUSSD(deviceId);
            }
            catch { /* ignore */ }
        }
        if (attempt < MAX_USSD_RETRIES) {
            console.log('   ⏳ Waiting 3s before retry...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    console.log(`     USSD check failed after ${MAX_USSD_RETRIES} attempts`);
    if (!await isDeviceConnected(deviceId)) {
        return { success: false, error: `USSD failed after ${MAX_USSD_RETRIES} attempts`, deviceDisconnected: true };
    }
    return { success: false, error: `USSD check failed after ${MAX_USSD_RETRIES} attempts` };
}
/**
 *  getMobileDataBytes() — reads /proc/net/dev for mobile interface rx+tx bytes.
 */
async function getMobileDataBytes(deviceId) {
    try {
        const output = await (0, adb_1.adbShell)(deviceId, 'cat /proc/net/dev');
        const lines = output.split('\n');
        for (const iface of MOBILE_INTERFACES) {
            const line = lines.find(l => l.includes(iface));
            if (line) {
                const parts = line.trim().split(/\s+/);
                const rx = parseInt(parts[1], 10);
                const tx = parseInt(parts[9], 10);
                if (!isNaN(rx) && !isNaN(tx)) {
                    console.log(`   📊 Interface ${iface}: RX=${rx} TX=${tx}`);
                    return rx + tx;
                }
            }
        }
        // Fallback: any interface with traffic excluding loopback
        for (const line of lines) {
            if (line.includes(':') && !line.includes('lo:')) {
                const parts = line.trim().split(/\s+/);
                const rx = parseInt(parts[1], 10);
                const tx = parseInt(parts[9], 10);
                if (!isNaN(rx) && !isNaN(tx) && (rx + tx) > 0) {
                    return rx + tx;
                }
            }
        }
    }
    catch (e) {
        console.error(`[Data] Failed to read /proc/net/dev: ${e.message}`);
    }
    return 0;
}
//  Main executor 
async function executeDataUsage(options = {}) {
    var _a, _b, _c, _d, _e;
    const ctx = (0, env_1.getRunContext)();
    const deviceId = ctx.aPartyDevice;
    const phoneNumber = ctx.aPartyNumber;
    const scenario = options.scenario || 'Default Data Test';
    const targetGb = (_a = options.targetDataGb) !== null && _a !== void 0 ? _a : ctx.targetDataGb;
    const durationMin = (_b = options.durationMin) !== null && _b !== void 0 ? _b : ctx.durationMin;
    const apps = options.appsToUse || 'Chrome, YouTube';
    console.log(`\n${'='.repeat(80)}`);
    console.log('🌐 DATA USAGE TEST');
    console.log(`   Scenario : ${scenario}`);
    console.log(`   Target   : ${targetGb} GB | Duration: ${durationMin} min`);
    console.log(`   Apps     : ${apps}`);
    console.log(`   Device   : ${deviceId} | Number: ${phoneNumber}`);
    console.log('='.repeat(80));
    //  STEP 1: Device connectivity guard 
    if (!await isDeviceConnected(deviceId)) {
        console.log(`❌ Device not connected: ${deviceId}`);
        return { consumedMB: 0, success: false, finalStatus: 'DEVICE_DISCONNECTED' };
    }
    //  STEP 2: Pre-data USSD balance check 
    let beforeUSSD = { success: false, balance: 'N/A' };
    if (ctx.ussdEnabled) {
        await (0, progressReporter_1.reportDataProgress)(deviceId, phoneNumber, 'Checking pre-data balance...', 'USSD_CHECK', 20);
        await new Promise(r => setTimeout(r, USSD_WAIT_BEFORE_DATA));
        beforeUSSD = await performUSSDCheckWithRetry(deviceId, 'BEFORE', phoneNumber);
        if (beforeUSSD.deviceDisconnected) {
            return { consumedMB: 0, success: false, finalStatus: 'DEVICE_DISCONNECTED' };
        }
        if (beforeUSSD.success) {
            await (0, progressReporter_1.reportDataProgress)(deviceId, phoneNumber, `Pre-balance: ₹${beforeUSSD.balance}`, 'USSD_CHECK', 30);
            console.log(`    Before Balance: ₹${beforeUSSD.balance}`);
            if (beforeUSSD.validity)
                console.log(`   📅 Validity: ${beforeUSSD.validity}`);
        }
        else {
            console.log('     USSD check failed after retries (continuing)');
            await (0, progressReporter_1.reportDataProgress)(deviceId, phoneNumber, 'USSD check failed (continuing)', 'USSD_CHECK_FAILED', 30);
        }
    }
    //  STEP 3: Baseline + consumption via DataUsagePage 
    const driver = (await Promise.resolve().then(() => __importStar(require('../driver/DriverManager')))).DriverManager.getDriver();
    let consumedMB = 0;
    let consumedGB = 0;
    let consumedRxMB = 0;
    let consumedTxMB = 0;
    let dataSource = 'ccmni1';
    let scenarioStatus = 'FAIL';
    if (driver) {
        const { DataUsagePage } = await Promise.resolve().then(() => __importStar(require('../pages/DataUsagePage')));
        const page = new DataUsagePage(driver, deviceId);
        const scenarioResult = await page.executeDataUsageScenario(scenario, targetGb, durationMin, apps, phoneNumber);
        consumedMB = scenarioResult.consumedMB;
        consumedGB = scenarioResult.consumedGB;
        consumedRxMB = (_c = scenarioResult.consumedRxMB) !== null && _c !== void 0 ? _c : 0;
        consumedTxMB = (_d = scenarioResult.consumedTxMB) !== null && _d !== void 0 ? _d : 0;
        dataSource = (_e = scenarioResult.dataSource) !== null && _e !== void 0 ? _e : dataSource;
        scenarioStatus = scenarioResult.status;
    }
    else {
        const initialBytes = await getMobileDataBytes(deviceId);
        await (0, progressReporter_1.reportDataProgress)(deviceId, phoneNumber, 'Starting data consumption...', 'IN_PROGRESS', 40);
        try {
            await (0, adb_1.adbShell)(deviceId, 'am start -a android.intent.action.VIEW -d https://speedtest.tele2.net/10MB.zip');
            await new Promise(r => setTimeout(r, durationMin * 60 * 1000));
        }
        catch (e) {
            console.error(`[Data] Consumption error: ${e.message}`);
        }
        const finalBytes = await getMobileDataBytes(deviceId);
        const consumedBytes = Math.max(0, finalBytes - initialBytes);
        consumedMB = consumedBytes / (1024 * 1024);
        consumedGB = consumedMB / 1024;
        scenarioStatus = consumedGB >= targetGb * 0.8 ? 'SUCCESS' : consumedMB > 0 ? 'PARTIAL_SUCCESS' : 'FAIL';
    }
    console.log(`\n   Consumed: ${consumedMB.toFixed(2)} MB (${consumedGB.toFixed(4)} GB)`);
    await (0, progressReporter_1.reportDataProgress)(deviceId, phoneNumber, `Consumed: ${consumedMB.toFixed(2)} MB`, 'IN_PROGRESS', 75);
    //  STEP 6: Post-data USSD balance check ─
    let afterUSSD = { success: false, balance: 'N/A' };
    if (ctx.ussdEnabled) {
        await (0, progressReporter_1.reportDataProgress)(deviceId, phoneNumber, 'Checking post-data balance...', 'USSD_CHECK', 90);
        await new Promise(r => setTimeout(r, USSD_WAIT_AFTER_DATA));
        afterUSSD = await performUSSDCheckWithRetry(deviceId, 'AFTER', phoneNumber);
        if (afterUSSD.success) {
            console.log(`    After Balance: ₹${afterUSSD.balance}`);
        }
    }
    //  STEP 7: Calculate deduction + log result 
    const deduction = (beforeUSSD.balanceNumeric != null && afterUSSD.balanceNumeric != null)
        ? beforeUSSD.balanceNumeric - afterUSSD.balanceNumeric
        : 0;
    if (deduction > 0)
        console.log(`   💸 Balance Deduction: ₹${deduction.toFixed(2)}`);
    const targetAchieved = consumedGB >= targetGb * 0.8;
    const finalStatus = scenarioStatus || (targetAchieved ? 'SUCCESS' : consumedMB > 0 ? 'PARTIAL_SUCCESS' : 'FAIL');
    (0, resultStore_1.addDataUsageResult)({
        scenario,
        targetData: targetGb,
        duration: durationMin,
        apps,
        consumedData: `${consumedMB.toFixed(2)} MB (${consumedGB.toFixed(4)} GB)`,
        consumedRxMB: consumedRxMB.toFixed(2),
        consumedTxMB: consumedTxMB.toFixed(2),
        dataSource,
        targetAchieved,
        beforeBalance: beforeUSSD.balance || 'N/A',
        afterBalance: afterUSSD.balance || 'N/A',
        balanceDeduction: deduction,
        finalStatus,
        timestamp: new Date().toISOString(),
        comments: `Deduction: Rs ${deduction.toFixed(2)}, Consumed: ${consumedMB.toFixed(2)} MB via ${dataSource}`
    });
    await (0, progressReporter_1.reportDataProgress)(deviceId, phoneNumber, 'Test Completed', 'TEST_COMPLETE', 100);
    console.log(`${finalStatus === 'SUCCESS' ? '' : finalStatus === 'PARTIAL_SUCCESS' ? '' : '❌'} Data Test: ${finalStatus}`);
    return { consumedMB, success: targetAchieved, finalStatus };
}
async function executeDataUsageTest(options = {}) {
    var _a, _b;
    return executeDataUsage({
        ...options,
        targetDataGb: (_a = options.targetDataGb) !== null && _a !== void 0 ? _a : (process.env.TARGET_DATA_GB ? parseFloat(process.env.TARGET_DATA_GB) : undefined),
        durationMin: (_b = options.durationMin) !== null && _b !== void 0 ? _b : (process.env.DURATION_MIN ? parseInt(process.env.DURATION_MIN) : undefined),
    });
}
class DataUsageTestExecutor {
    constructor(_driver, deviceId) {
        this.deviceId = deviceId;
    }
    async executeDataUsageTests(excelFilePath) {
        const { readDataUsageRows } = await Promise.resolve().then(() => __importStar(require('../utils/excelReader')));
        const { flushReports } = await Promise.resolve().then(() => __importStar(require('../reporting')));
        const { ProgressReporter } = await Promise.resolve().then(() => __importStar(require('../utils/progressReporter')));
        const rows = await readDataUsageRows(excelFilePath);
        const results = [];
        if (!rows.length) {
            console.log('❌ No data usage test data found');
            return results;
        }
        await ProgressReporter.initializeTestSuite(this.deviceId, rows.length);
        for (const row of rows) {
            const dataResult = await executeDataUsage({
                testName: row.scenario,
                scenario: row.scenario,
                targetDataGb: row.targetDataGB,
                durationMin: row.durationMin,
                appsToUse: row.appsToUse.join(', ')
            });
            results.push({
                scenario: row.scenario,
                targetDataGB: row.targetDataGB,
                durationMin: row.durationMin,
                consumedMB: dataResult.consumedMB,
                finalStatus: dataResult.finalStatus,
                testTimestamp: new Date().toISOString()
            });
        }
        try {
            await flushReports();
        }
        catch (e) {
            console.warn('[Data] Report flush:', e.message);
        }
        return results;
    }
}
exports.DataUsageTestExecutor = DataUsageTestExecutor;
