import { DialerPage } from '../pages/dialer.page';
import { ImprovedDialerPage } from '../pages/ImprovedDialerPage';
import { WorkingVideoCallDialer } from '../pages/WorkingVideoCallDialer';
import { DriverManager } from '../driver/DriverManager';
import { DeviceManager } from '../utils/DeviceManager';
import { detectCallScenario } from '../utils/CallScenarioDetector';
import { adbShell } from '../utils/adb';
import { reportCallingProgress } from '../utils/progressReporter';
import { getRunContext } from '../utils/env';
import { addCallingResult } from '../reporting/resultStore';
import { getOrPerformPreTestUSSD, performPostTestUSSD, USSDResult } from '../utils/ussdService';

//  Constants () ─
const USSD_CODE             = '*199#';
const USSD_WAIT_BEFORE_CALL = 5_000;   // ms
const USSD_WAIT_AFTER_CALL  = 8_000;   // ms
const MAX_USSD_RETRIES      = 2;

//  Types 

export interface CallResult {
  connected: boolean;
  ringingSec: number;
  activeSec: number;
  target: string;
  finalStatus: string;
}

export interface CallOptions {
  testName?: string;
  callType?: 'VOICE' | 'VOLTE' | 'VIDEO' | 'CONFERENCE';
  direction?: 'OUTGOING' | 'INCOMING';
  duration?: number;
  attempts?: number;
  preferredNetwork?: string;
  bPartyNumber?: string;
  aPartyNumber?: string;
  cPartyNumber?: string;
  bPartyDevice?: string;
  volteSupported?: boolean;
}

//  Device validation result ( inner class) 

interface DeviceValidationResult {
  isValid: boolean;
  reason: string;
}

//  Helpers 

function cleanNumber(num: string): string {
  const digits = num.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

async function isDeviceConnected(deviceId: string): Promise<boolean> {
  try {
    const out = await adbShell(deviceId, 'echo ok');
    return out.trim() === 'ok';
  } catch {
    return false;
  }
}

/**  validateDeviceConnectivityEnhanced() */
async function validateDeviceConnectivity(
  callerDevice: string | undefined,
  receiverDevice: string | undefined,
  direction: string,
  callerNumber: string,
  receiverNumber: string
): Promise<DeviceValidationResult> {
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
      } else {
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
async function setNetworkType(deviceId: string, type: string): Promise<void> {
  const modeMap: Record<string, number> = {
    '2G': 1, '3G': 3, '4G': 11, 'LTE': 11, '5G': 33,
  };
  const mode = modeMap[type.toUpperCase()] ?? 33;

  const cmds = [
    `settings put global preferred_network_mode ${mode}`,
    `settings put global preferred_network_mode1 ${mode}`,
    `cmd phone set-preferred-network-type-for-slot -s 0 ${mode}`,
  ];

  for (const cmd of cmds) {
    try { await adbShell(deviceId, cmd); } catch { /* per-slot commands may fail */ }
  }
}

/**  resetDriverAfterUSSD() */
async function resetDriverAfterUSSD(deviceId: string): Promise<void> {
  console.log('    Resetting app state after USSD...');
  try {
    await adbShell(deviceId, 'am force-stop com.google.android.dialer');
    await new Promise(r => setTimeout(r, 2000));
    console.log('    Dialer force-stopped');
  } catch (e) {
    console.warn(`     Force-stop failed: ${(e as Error).message}`);
  }
  try {
    await adbShell(deviceId, 'input keyevent 3'); // HOME
    await new Promise(r => setTimeout(r, 1000));
  } catch { /* ignore */ }
}

/**  closeDialerAppCompletely() + returnToHomeScreen() */
async function prepareForUSSD(deviceId: string): Promise<void> {
  await adbShell(deviceId, 'am force-stop com.android.dialer').catch(() => {});
  await adbShell(deviceId, 'am force-stop com.google.android.dialer').catch(() => {});
  await adbShell(deviceId, 'input keyevent 3').catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
}

/**
 *  performUSSDCheckWithRetry()
 * Performs USSD with retry + device connectivity guard.
 */
async function performUSSDCheckWithRetry(
  deviceId: string,
  checkType: 'BEFORE' | 'AFTER',
  phoneNumber: string
): Promise<USSDResult> {
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
        ? await getOrPerformPreTestUSSD(deviceId, phoneNumber)
        : await performPostTestUSSD(deviceId, phoneNumber);

      await resetDriverAfterUSSD(deviceId);

      if (result.success) {
        console.log('    USSD SUCCESS');
        console.log(`      Phone   : ${result.phoneNumber}`);
        console.log(`      Balance : ${result.balance}`);
        if (result.validity) console.log(`      Validity: ${result.validity}`);
        return result;
      }

      console.log(`    USSD returned error: ${result.error}`);
    } catch (e) {
      console.error(`    USSD attempt failed: ${(e as Error).message}`);
      try { await resetDriverAfterUSSD(deviceId); } catch { /* ignore */ }
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

export async function executeCall(options: CallOptions = {}): Promise<CallResult> {
  const ctx           = getRunContext();
  const direction     = options.direction     || 'OUTGOING';
  const callType      = options.callType      || 'VOICE';
  const duration      = options.duration      ?? ctx.callDuration;
  const preferredNetwork = options.preferredNetwork || ctx.networkType;

  //  Build number→device map ( buildDeviceMapping) 
  const numberToDeviceMap = new Map<string, string>();
  const aPartyNumber  = options.aPartyNumber  || ctx.aPartyNumber;
  const bPartyNumber  = options.bPartyNumber  || ctx.bPartyNumber;
  const aPartyDevice  = ctx.aPartyDevice;
  const bPartyDevice  = options.bPartyDevice  || ctx.bPartyDevice;

  if (aPartyNumber && aPartyDevice) {
    numberToDeviceMap.set(cleanNumber(aPartyNumber), aPartyDevice);
    console.log(`    A-Party mapped: ${aPartyNumber} -> ${aPartyDevice}`);
  }
  if (bPartyNumber && bPartyDevice) {
    numberToDeviceMap.set(cleanNumber(bPartyNumber), bPartyDevice);
    console.log(`    B-Party mapped: ${bPartyNumber} -> ${bPartyDevice}`);
  }

  //  Determine caller / receiver ( direction logic) 
  let callerDeviceId: string | undefined;
  let callerNumber: string;
  let receiverDeviceId: string | undefined;
  let receiverNumber: string;

  if (direction === 'INCOMING') {
    callerNumber     = bPartyNumber;
    receiverNumber   = aPartyNumber;
    callerDeviceId   = numberToDeviceMap.get(cleanNumber(callerNumber));
    receiverDeviceId = numberToDeviceMap.get(cleanNumber(receiverNumber));
    console.log('\n INCOMING call mode');
  } else {
    callerNumber     = aPartyNumber;
    receiverNumber   = bPartyNumber;
    callerDeviceId   = numberToDeviceMap.get(cleanNumber(callerNumber));
    receiverDeviceId = numberToDeviceMap.get(cleanNumber(receiverNumber));
    console.log('\n📤 OUTGOING call mode');
  }

  console.log(`   Caller   : ${callerNumber} -> ${callerDeviceId ?? 'NOT MAPPED'}`);
  console.log(`   Receiver : ${receiverNumber} -> ${receiverDeviceId ?? 'NOT MAPPED'}`);

  //  Device validation 
  const validation = await validateDeviceConnectivity(
    callerDeviceId, receiverDeviceId, direction, callerNumber, receiverNumber
  );

  if (!validation.isValid) {
    console.log(`\n  SKIPPING TEST: ${validation.reason}`);
    addCallingResult({
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
  let beforeUSSD: USSDResult = { success: false, balance: 'N/A' };
  let receiverBeforeUSSD: USSDResult = { success: false, balance: 'N/A' };

  if (ctx.ussdEnabled && callerDeviceId) {
    await reportCallingProgress(callerDeviceId, callerNumber, 'Pre-call Balance Check', 'USSD_CHECK', 0, 10);
    await new Promise(r => setTimeout(r, USSD_WAIT_BEFORE_CALL));
    beforeUSSD = await performUSSDCheckWithRetry(callerDeviceId, 'BEFORE', callerNumber);

    if (beforeUSSD.deviceDisconnected) {
      return { connected: false, ringingSec: 0, activeSec: 0, target: receiverNumber, finalStatus: 'SKIPPED' };
    }

    if (direction === 'INCOMING' && receiverDeviceId) {
      receiverBeforeUSSD = await performUSSDCheckWithRetry(receiverDeviceId, 'BEFORE', receiverNumber);
    }

    await reportCallingProgress(callerDeviceId, callerNumber,
      `Pre-balance: Rs ${beforeUSSD.balance ?? 'N/A'}`, 'USSD_CHECK', 0, 20);
  }

  //  STEP 2: Network switch 
  if (preferredNetwork && preferredNetwork !== 'AUTO' && callerDeviceId) {
    await reportCallingProgress(callerDeviceId, callerNumber, `Setting Network: ${preferredNetwork}`, 'NETWORK_SWITCH', 0, 25);
    await setNetworkType(callerDeviceId, preferredNetwork);
    await new Promise(r => setTimeout(r, 5000));
  }

  //  STEP 3: Execute call with retries ( attempts loop) 
  const maxAttempts = options.attempts ?? 1;
  const driver = DriverManager.getDriver();
  let connected = false;
  let ringingSec = 0;
  let activeSec = 0;
  let attemptUsed = 0;
  let callStatus = 'NOT_CONNECTED';
  let scenarioComment = '';

  if (receiverDeviceId) {
    await DeviceManager.setupAutoAnswer(receiverDeviceId, callerNumber);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attemptUsed = attempt;
    const dialingStart = Date.now();

    await reportCallingProgress(callerDeviceId!, callerNumber,
      `Dialing ${receiverNumber} (attempt ${attempt})`, 'IN_PROGRESS', 0, 40);

    if (callType === 'VIDEO' && driver) {
      const videoDialer = new WorkingVideoCallDialer(driver, callerDeviceId);
      const vr = await videoDialer.makeVideoCall(receiverNumber, duration, 1);
      connected = vr.connected;
      ringingSec = vr.ringTime ?? 0;
      activeSec = vr.actualDuration;
      callStatus = vr.callStatus;
      if (connected) break;
      continue;
    }

    if ((callType === 'CONFERENCE' || options.cPartyNumber) && driver) {
      const dialerPage = new ImprovedDialerPage(driver, callerDeviceId);
      const cr = await dialerPage.makeCompleteCall(
        receiverNumber,
        duration,
        1,
        options.cPartyNumber
      );
      connected = cr.connected;
      activeSec = cr.actualDuration;
      ringingSec = (Date.now() - dialingStart) / 1000;
      callStatus = cr.callStatus;
      if (connected) break;
      continue;
    }

    const dialer = new DialerPage(callerDeviceId!, receiverDeviceId);
    await dialer.dial(receiverNumber);

    if (receiverDeviceId) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        await adbShell(receiverDeviceId, 'input keyevent 5');
        await dialer.answerOnBParty();
      } catch (e) {
        console.warn(`[Call] Auto-answer failed: ${(e as Error).message}`);
      }
    }

    connected = await dialer.waitForCallTimer();
    ringingSec = (Date.now() - dialingStart) / 1000;

    if (connected) {
      if (driver) {
        try {
          const src = await driver.getPageSource();
          const scenario = detectCallScenario(src, true, Math.round(activeSec || duration), duration);
          scenarioComment = scenario.comment;
        } catch {
          /* optional */
        }
      }

      await reportCallingProgress(callerDeviceId!, callerNumber, 'Call Connected', 'IN_PROGRESS', Math.round(ringingSec), 60);
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
    await DeviceManager.stopAutoAnswer(receiverDeviceId);
  }

  if (connected) {
    await reportCallingProgress(callerDeviceId!, callerNumber, 'Call Ended', 'IN_PROGRESS', Math.round(activeSec), 80);
    console.log(`Call connected — active ${activeSec.toFixed(1)}s`);

    //  STEP 6: Post-call USSD 
    let afterUSSD: USSDResult         = { success: false, balance: 'N/A' };
    let receiverAfterUSSD: USSDResult = { success: false, balance: 'N/A' };

    if (ctx.ussdEnabled) {
      await new Promise(r => setTimeout(r, USSD_WAIT_AFTER_CALL));

      if (direction === 'INCOMING' && receiverDeviceId) {
        await reportCallingProgress(receiverDeviceId, receiverNumber, 'Checking Receiver Post-Call Balance', 'USSD_CHECK', 0, 87);
        receiverAfterUSSD = await performUSSDCheckWithRetry(receiverDeviceId, 'AFTER', receiverNumber);
        if (receiverAfterUSSD.success) {
          console.log(`   Receiver After Balance: Rs ${receiverAfterUSSD.balance}`);
        }
      } else {
        await reportCallingProgress(callerDeviceId!, callerNumber, 'Post-call Balance Check', 'USSD_CHECK', 0, 90);
        afterUSSD = await performUSSDCheckWithRetry(callerDeviceId!, 'AFTER', callerNumber);
        if (afterUSSD.success) {
          console.log(`   After Balance: Rs ${afterUSSD.balance}`);
        }
      }
    }

    const relevantAfter = direction === 'INCOMING' ? receiverAfterUSSD : afterUSSD;
    const relevantBefore = direction === 'INCOMING' ? receiverBeforeUSSD : beforeUSSD;
    const deduction =
      relevantBefore.balanceNumeric != null && relevantAfter.balanceNumeric != null
        ? relevantBefore.balanceNumeric - relevantAfter.balanceNumeric
        : 0;

    const finalStatus = activeSec >= duration * 0.8 ? 'SUCCESS' : 'PARTIAL_SUCCESS';
    const volteLabel = callType === 'VOLTE' || options.volteSupported ? 'true' : 'false';

    addCallingResult({
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

    await reportCallingProgress(callerDeviceId!, callerNumber, 'Test Completed', 'COMPLETED', Math.round(activeSec), 100);
    return { connected: true, ringingSec, activeSec, target: receiverNumber, finalStatus };
  }

  console.log('Call did not connect');

  addCallingResult({
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

  await reportCallingProgress(callerDeviceId!, callerNumber, 'Call Failed', 'COMPLETED', 0, 100);
  return { connected: false, ringingSec, activeSec: 0, target: receiverNumber, finalStatus: 'FAILED' };
}

//  Convenience wrappers 

export async function executeOutgoingCall(
  targetNumber: string, duration: number, options: CallOptions = {}
): Promise<CallResult> {
  return executeCall({ ...options, direction: 'OUTGOING', bPartyNumber: targetNumber, duration });
}

export async function executeIncomingCall(
  callerNumber: string, duration: number, options: CallOptions = {}
): Promise<CallResult> {
  return executeCall({ ...options, direction: 'INCOMING', bPartyNumber: callerNumber, duration });
}