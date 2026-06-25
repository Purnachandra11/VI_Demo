"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCall = executeCall;
exports.executeOutgoingCall = executeOutgoingCall;
exports.executeIncomingCall = executeIncomingCall;
const dialer_page_1 = require("../pages/dialer.page");
const ImprovedDialerPage_1 = require("../pages/ImprovedDialerPage");
const WorkingVideoCallDialer_1 = require("../pages/WorkingVideoCallDialer");
const DriverManager_1 = require("../driver/DriverManager");
const DeviceManager_1 = require("../utils/DeviceManager");
const CallScenarioDetector_1 = require("../utils/CallScenarioDetector");
const adb_1 = require("../utils/adb");
const progressReporter_1 = require("../utils/progressReporter");
const env_1 = require("../utils/env");
const resultStore_1 = require("../reporting/resultStore");
const ussdService_1 = require("../utils/ussdService");
//  Constants () ─
const USSD_CODE = '*199#';
const USSD_WAIT_BEFORE_CALL = 5000; // ms
const USSD_WAIT_AFTER_CALL = 8000; // ms
const MAX_USSD_RETRIES = 2;
//  Helpers 
function cleanNumber(num) {
    const digits = num.replace(/[^0-9]/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
}
async function isDeviceConnected(deviceId) {
    try {
        const out = await (0, adb_1.adbShell)(deviceId, 'echo ok');
        return out.trim() === 'ok';
    }
    catch {
        return false;
    }
}
/**  validateDeviceConnectivityEnhanced() */
async function validateDeviceConnectivity(callerDevice, receiverDevice, direction, callerNumber, receiverNumber) {
    console.log('\n🔌 VALIDATING DEVICE CONNECTIVITY...');
    console.log(`   Direction: ${direction}`);
    if (direction === 'OUTGOING') {
        console.log('   📤 OUTGOING TEST VALIDATION');
        if (!callerDevice) {
            const reason = `Caller device not mapped for number: ${callerNumber}`;
            console.log(`    ${reason}`);
            return { isValid: false, reason };
        }
        if (!await isDeviceConnected(callerDevice)) {
            const reason = `Caller device disconnected: ${callerDevice}. Please reconnect and retry.`;
            console.log(`    ${reason}`);
            return { isValid: false, reason };
        }
        console.log(`    Caller device connected: ${callerDevice}`);
        if (receiverDevice) {
            if (!await isDeviceConnected(receiverDevice)) {
                console.log(`     Receiver device not connected: ${receiverDevice} — continuing (may be external)`);
            }
            else {
                console.log(`    Receiver device connected: ${receiverDevice}`);
            }
        }
        return { isValid: true, reason: 'Outgoing test validation passed' };
    }
    if (direction === 'INCOMING') {
        console.log('    INCOMING TEST VALIDATION');
        if (!callerDevice) {
            const reason = `Caller (B-Party) device not mapped for number: ${callerNumber}`;
            console.log(`    ${reason}`);
            return { isValid: false, reason };
        }
        if (!await isDeviceConnected(callerDevice)) {
            const reason = `Caller (B-Party) device disconnected: ${callerDevice}. Please reconnect.`;
            console.log(`    ${reason}`);
            return { isValid: false, reason };
        }
        console.log(`    Caller (B-Party) device connected: ${callerDevice}`);
        if (!receiverDevice) {
            const reason = 'Receiver (A-Party) device not mapped. Both devices required for INCOMING tests.';
            console.log(`    ${reason}`);
            return { isValid: false, reason };
        }
        if (!await isDeviceConnected(receiverDevice)) {
            const reason = `Receiver (A-Party) device disconnected: ${receiverDevice}. Required for INCOMING tests.`;
            console.log(`    ${reason}`);
            return { isValid: false, reason };
        }
        console.log(`    Receiver (A-Party) device connected: ${receiverDevice}`);
        return { isValid: true, reason: 'Incoming test validation passed' };
    }
    return { isValid: false, reason: `Unknown direction: ${direction}` };
}
/**  setNetworkType() */
async function setNetworkType(deviceId, type) {
    var _a;
    const modeMap = {
        '2G': 1, '3G': 3, '4G': 11, 'LTE': 11, '5G': 33,
    };
    const mode = (_a = modeMap[type.toUpperCase()]) !== null && _a !== void 0 ? _a : 33;
    const cmds = [
        `settings put global preferred_network_mode ${mode}`,
        `settings put global preferred_network_mode1 ${mode}`,
        `cmd phone set-preferred-network-type-for-slot -s 0 ${mode}`,
    ];
    for (const cmd of cmds) {
        try {
            await (0, adb_1.adbShell)(deviceId, cmd);
        }
        catch { /* per-slot commands may fail */ }
    }
}
/**  resetDriverAfterUSSD() */
async function resetDriverAfterUSSD(deviceId) {
    console.log('    Resetting app state after USSD...');
    try {
        await (0, adb_1.adbShell)(deviceId, 'am force-stop com.google.android.dialer');
        await new Promise(r => setTimeout(r, 2000));
        console.log('    Dialer force-stopped');
    }
    catch (e) {
        console.warn(`     Force-stop failed: ${e.message}`);
    }
    try {
        await (0, adb_1.adbShell)(deviceId, 'input keyevent 3'); // HOME
        await new Promise(r => setTimeout(r, 1000));
    }
    catch { /* ignore */ }
}
/**  closeDialerAppCompletely() + returnToHomeScreen() */
async function prepareForUSSD(deviceId) {
    await (0, adb_1.adbShell)(deviceId, 'am force-stop com.android.dialer').catch(() => { });
    await (0, adb_1.adbShell)(deviceId, 'am force-stop com.google.android.dialer').catch(() => { });
    await (0, adb_1.adbShell)(deviceId, 'input keyevent 3').catch(() => { });
    await new Promise(r => setTimeout(r, 1000));
}
/**
 *  performUSSDCheckWithRetry()
 * Performs USSD with retry + device connectivity guard.
 */
async function performUSSDCheckWithRetry(deviceId, checkType, phoneNumber) {
    console.log(`\n💰 ${checkType} BALANCE CHECK...`);
    for (let attempt = 1; attempt <= MAX_USSD_RETRIES; attempt++) {
        console.log(`   🔄 Attempt ${attempt}/${MAX_USSD_RETRIES}`);
        if (!await isDeviceConnected(deviceId)) {
            console.log(`    Device disconnected: ${deviceId}`);
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
                return result;
            }
            console.log(`    USSD returned error: ${result.error}`);
        }
        catch (e) {
            console.error(`    USSD attempt failed: ${e.message}`);
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
//  Main executor 
async function executeCall(options = {}) {
    var _a, _b, _c, _d;
    const ctx = (0, env_1.getRunContext)();
    const direction = options.direction || 'OUTGOING';
    const callType = options.callType || 'VOICE';
    const duration = (_a = options.duration) !== null && _a !== void 0 ? _a : ctx.callDuration;
    const preferredNetwork = options.preferredNetwork || ctx.networkType;
    //  Build number→device map ( buildDeviceMapping) 
    const numberToDeviceMap = new Map();
    const aPartyNumber = options.aPartyNumber || ctx.aPartyNumber;
    const bPartyNumber = options.bPartyNumber || ctx.bPartyNumber;
    const aPartyDevice = ctx.aPartyDevice;
    const bPartyDevice = options.bPartyDevice || ctx.bPartyDevice;
    if (aPartyNumber && aPartyDevice) {
        numberToDeviceMap.set(cleanNumber(aPartyNumber), aPartyDevice);
        console.log(`    A-Party mapped: ${aPartyNumber} -> ${aPartyDevice}`);
    }
    if (bPartyNumber && bPartyDevice) {
        numberToDeviceMap.set(cleanNumber(bPartyNumber), bPartyDevice);
        console.log(`    B-Party mapped: ${bPartyNumber} -> ${bPartyDevice}`);
    }
    //  Determine caller / receiver ( direction logic) 
    let callerDeviceId;
    let callerNumber;
    let receiverDeviceId;
    let receiverNumber;
    if (direction === 'INCOMING') {
        callerNumber = bPartyNumber;
        receiverNumber = aPartyNumber;
        callerDeviceId = numberToDeviceMap.get(cleanNumber(callerNumber));
        receiverDeviceId = numberToDeviceMap.get(cleanNumber(receiverNumber));
        console.log('\n INCOMING call mode');
    }
    else {
        callerNumber = aPartyNumber;
        receiverNumber = bPartyNumber;
        callerDeviceId = numberToDeviceMap.get(cleanNumber(callerNumber));
        receiverDeviceId = numberToDeviceMap.get(cleanNumber(receiverNumber));
        console.log('\n📤 OUTGOING call mode');
    }
    console.log(`   Caller   : ${callerNumber} -> ${callerDeviceId !== null && callerDeviceId !== void 0 ? callerDeviceId : 'NOT MAPPED'}`);
    console.log(`   Receiver : ${receiverNumber} -> ${receiverDeviceId !== null && receiverDeviceId !== void 0 ? receiverDeviceId : 'NOT MAPPED'}`);
    //  Device validation 
    const validation = await validateDeviceConnectivity(callerDeviceId, receiverDeviceId, direction, callerNumber, receiverNumber);
    if (!validation.isValid) {
        console.log(`\n  SKIPPING TEST: ${validation.reason}`);
        (0, resultStore_1.addCallingResult)({
            name: options.testName || `${callType} Call to ${receiverNumber}`,
            direction, callerNumber, receiverNumber,
            aPartyNetworkType: preferredNetwork, aPartyVolteEnabled: 'false',
            bPartyNetworkType: '', bPartyVolteEnabled: '',
            autoAnswerEnabled: false, ringTime: 0, duration, actualDuration: 0,
            attemptNumber: 1, callStatus: 'SKIPPED', callType, finalStatus: 'SKIPPED',
            callerMSISDN: callerNumber, beforeBalance: 'N/A', afterBalance: 'N/A',
            balanceDeduction: 0, comments: validation.reason,
            testTimestamp: new Date().toISOString()
        });
        return { connected: false, ringingSec: 0, activeSec: 0, target: receiverNumber, finalStatus: 'SKIPPED' };
    }
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📞 ${callType} ${direction} call | Caller: ${callerNumber} | Receiver: ${receiverNumber}`);
    console.log('='.repeat(80));
    //  STEP 1: Pre-call USSD balance check (dual-party for INCOMING) 
    let beforeUSSD = { success: false, balance: 'N/A' };
    let receiverBeforeUSSD = { success: false, balance: 'N/A' };
    if (ctx.ussdEnabled && callerDeviceId) {
        await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, 'Pre-call Balance Check', 'USSD_CHECK', 0, 10);
        await new Promise(r => setTimeout(r, USSD_WAIT_BEFORE_CALL));
        beforeUSSD = await performUSSDCheckWithRetry(callerDeviceId, 'BEFORE', callerNumber);
        if (beforeUSSD.deviceDisconnected) {
            return { connected: false, ringingSec: 0, activeSec: 0, target: receiverNumber, finalStatus: 'SKIPPED' };
        }
        if (direction === 'INCOMING' && receiverDeviceId) {
            receiverBeforeUSSD = await performUSSDCheckWithRetry(receiverDeviceId, 'BEFORE', receiverNumber);
        }
        await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, `Pre-balance: Rs ${(_b = beforeUSSD.balance) !== null && _b !== void 0 ? _b : 'N/A'}`, 'USSD_CHECK', 0, 20);
    }
    //  STEP 2: Network switch 
    if (preferredNetwork && preferredNetwork !== 'AUTO' && callerDeviceId) {
        await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, `Setting Network: ${preferredNetwork}`, 'NETWORK_SWITCH', 0, 25);
        await setNetworkType(callerDeviceId, preferredNetwork);
        await new Promise(r => setTimeout(r, 5000));
    }
    //  STEP 3: Execute call with retries ( attempts loop) 
    const maxAttempts = (_c = options.attempts) !== null && _c !== void 0 ? _c : 1;
    const driver = DriverManager_1.DriverManager.getDriver();
    let connected = false;
    let ringingSec = 0;
    let activeSec = 0;
    let attemptUsed = 0;
    let callStatus = 'NOT_CONNECTED';
    let scenarioComment = '';
    if (receiverDeviceId) {
        await DeviceManager_1.DeviceManager.setupAutoAnswer(receiverDeviceId, callerNumber);
    }
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attemptUsed = attempt;
        const dialingStart = Date.now();
        await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, `Dialing ${receiverNumber} (attempt ${attempt})`, 'IN_PROGRESS', 0, 40);
        if (callType === 'VIDEO' && driver) {
            const videoDialer = new WorkingVideoCallDialer_1.WorkingVideoCallDialer(driver, callerDeviceId);
            const vr = await videoDialer.makeVideoCall(receiverNumber, duration, 1);
            connected = vr.connected;
            ringingSec = (_d = vr.ringTime) !== null && _d !== void 0 ? _d : 0;
            activeSec = vr.actualDuration;
            callStatus = vr.callStatus;
            if (connected)
                break;
            continue;
        }
        if ((callType === 'CONFERENCE' || options.cPartyNumber) && driver) {
            const dialerPage = new ImprovedDialerPage_1.ImprovedDialerPage(driver, callerDeviceId);
            const cr = await dialerPage.makeCompleteCall(receiverNumber, duration, 1, options.cPartyNumber);
            connected = cr.connected;
            activeSec = cr.actualDuration;
            ringingSec = (Date.now() - dialingStart) / 1000;
            callStatus = cr.callStatus;
            if (connected)
                break;
            continue;
        }
        const dialer = new dialer_page_1.DialerPage(callerDeviceId, receiverDeviceId);
        await dialer.dial(receiverNumber);
        if (receiverDeviceId) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                await (0, adb_1.adbShell)(receiverDeviceId, 'input keyevent 5');
                await dialer.answerOnBParty();
            }
            catch (e) {
                console.warn(`[Call] Auto-answer failed: ${e.message}`);
            }
        }
        connected = await dialer.waitForCallTimer();
        ringingSec = (Date.now() - dialingStart) / 1000;
        if (connected) {
            if (driver) {
                try {
                    const src = await driver.getPageSource();
                    const scenario = (0, CallScenarioDetector_1.detectCallScenario)(src, true, Math.round(activeSec || duration), duration);
                    scenarioComment = scenario.comment;
                }
                catch {
                    /* optional */
                }
            }
            await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, 'Call Connected', 'IN_PROGRESS', Math.round(ringingSec), 60);
            const activeStart = Date.now();
            await dialer.holdActiveCall(duration);
            await dialer.endCall();
            activeSec = (Date.now() - activeStart) / 1000;
            callStatus = 'CONNECTED';
            break;
        }
        await dialer.endCall();
        callStatus = 'NOT_CONNECTED';
        if (attempt < maxAttempts) {
            console.log(`Attempt ${attempt} failed — retrying in 5s...`);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    if (receiverDeviceId) {
        await DeviceManager_1.DeviceManager.stopAutoAnswer(receiverDeviceId);
    }
    if (connected) {
        await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, 'Call Ended', 'IN_PROGRESS', Math.round(activeSec), 80);
        console.log(`Call connected — active ${activeSec.toFixed(1)}s`);
        //  STEP 6: Post-call USSD 
        let afterUSSD = { success: false, balance: 'N/A' };
        let receiverAfterUSSD = { success: false, balance: 'N/A' };
        if (ctx.ussdEnabled) {
            await new Promise(r => setTimeout(r, USSD_WAIT_AFTER_CALL));
            if (direction === 'INCOMING' && receiverDeviceId) {
                await (0, progressReporter_1.reportCallingProgress)(receiverDeviceId, receiverNumber, 'Checking Receiver Post-Call Balance', 'USSD_CHECK', 0, 87);
                receiverAfterUSSD = await performUSSDCheckWithRetry(receiverDeviceId, 'AFTER', receiverNumber);
                if (receiverAfterUSSD.success) {
                    console.log(`   Receiver After Balance: Rs ${receiverAfterUSSD.balance}`);
                }
            }
            else {
                await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, 'Post-call Balance Check', 'USSD_CHECK', 0, 90);
                afterUSSD = await performUSSDCheckWithRetry(callerDeviceId, 'AFTER', callerNumber);
                if (afterUSSD.success) {
                    console.log(`   After Balance: Rs ${afterUSSD.balance}`);
                }
            }
        }
        const relevantAfter = direction === 'INCOMING' ? receiverAfterUSSD : afterUSSD;
        const relevantBefore = direction === 'INCOMING' ? receiverBeforeUSSD : beforeUSSD;
        const deduction = relevantBefore.balanceNumeric != null && relevantAfter.balanceNumeric != null
            ? relevantBefore.balanceNumeric - relevantAfter.balanceNumeric
            : 0;
        const finalStatus = activeSec >= duration * 0.8 ? 'SUCCESS' : 'PARTIAL_SUCCESS';
        const volteLabel = callType === 'VOLTE' || options.volteSupported ? 'true' : 'false';
        (0, resultStore_1.addCallingResult)({
            name: options.testName || `${callType} Call to ${receiverNumber}`,
            direction, callerNumber, receiverNumber,
            aPartyNetworkType: preferredNetwork,
            aPartyVolteEnabled: volteLabel,
            bPartyNetworkType: preferredNetwork,
            bPartyVolteEnabled: volteLabel,
            autoAnswerEnabled: Boolean(receiverDeviceId),
            ringTime: Math.round(ringingSec), duration,
            actualDuration: Math.round(activeSec),
            attemptNumber: attemptUsed, callStatus, callType, finalStatus,
            callerMSISDN: beforeUSSD.phoneNumber || callerNumber,
            beforeBalance: relevantBefore.balance || 'N/A',
            afterBalance: relevantAfter.balance || 'N/A',
            bPartyBeforeBalance: beforeUSSD.balance,
            aPartyBeforeBalance: receiverBeforeUSSD.balance,
            balanceDeduction: deduction,
            comments: [scenarioComment, `Deduction: Rs ${deduction.toFixed(2)}`].filter(Boolean).join(' | '),
            testTimestamp: new Date().toISOString()
        });
        await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, 'Test Completed', 'COMPLETED', Math.round(activeSec), 100);
        return { connected: true, ringingSec, activeSec, target: receiverNumber, finalStatus };
    }
    console.log('Call did not connect');
    (0, resultStore_1.addCallingResult)({
        name: options.testName || `${callType} Call to ${receiverNumber}`,
        direction, callerNumber, receiverNumber,
        aPartyNetworkType: preferredNetwork,
        aPartyVolteEnabled: ctx.volteEnabled ? 'true' : 'false',
        bPartyNetworkType: '', bPartyVolteEnabled: '',
        autoAnswerEnabled: Boolean(receiverDeviceId),
        ringTime: Math.round(ringingSec), duration, actualDuration: 0,
        attemptNumber: attemptUsed, callStatus, callType, finalStatus: 'FAILED',
        callerMSISDN: callerNumber,
        beforeBalance: beforeUSSD.balance || 'N/A', afterBalance: 'N/A',
        balanceDeduction: 0, comments: scenarioComment || 'Call did not connect',
        testTimestamp: new Date().toISOString()
    });
    await (0, progressReporter_1.reportCallingProgress)(callerDeviceId, callerNumber, 'Call Failed', 'COMPLETED', 0, 100);
    return { connected: false, ringingSec, activeSec: 0, target: receiverNumber, finalStatus: 'FAILED' };
}
//  Convenience wrappers 
async function executeOutgoingCall(targetNumber, duration, options = {}) {
    return executeCall({ ...options, direction: 'OUTGOING', bPartyNumber: targetNumber, duration });
}
async function executeIncomingCall(callerNumber, duration, options = {}) {
    return executeCall({ ...options, direction: 'INCOMING', bPartyNumber: callerNumber, duration });
}
