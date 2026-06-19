import { adbShell } from '../utils/adb';
import { reportSMSProgress } from '../utils/progressReporter';
import { getRunContext } from '../utils/env';
import { addSmsResult } from '../reporting/resultStore';
import { getOrPerformPreTestUSSD, performPostTestUSSD, USSDResult } from '../utils/ussdService';
import { DriverManager } from '../driver/DriverManager';
import { MessagingPage } from '../pages/MessagingPage';

//  Constants () ─
const MAX_USSD_RETRIES      = 2;
const MAX_DELIVERY_TIME_MS  = 120_000;  // 2 min SLA
const MESSAGE_POLL_INTERVAL = 2_000;

//  Types 

export interface SMSResult {
  sent: boolean;
  received: boolean;
  deliveryTimeSec: number;
  finalStatus: string;
}

export interface SMSOptions {
  testName?: string;
  testType?: string;
  messageType?: 'text' | 'voice';
  direction?: 'OUTGOING' | 'INCOMING';
  message?: string;
  recipient?: string;
  aPartyNumber?: string;
  bPartyNumber?: string;
  isIndividual?: boolean;
  isGroup?: boolean;
  groupName?: string;
  smsCount?: number;
}

//  Device validation ( DeviceValidationResult) 

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
    return (await adbShell(deviceId, 'echo ok')).trim() === 'ok';
  } catch {
    return false;
  }
}

/**  validateDeviceConnectivityEnhanced() for SMS */
async function validateDeviceConnectivity(
  senderDevice: string | undefined,
  receiverDevice: string | undefined,
  isIndividual: boolean,
  senderNumber: string,
  direction: string
): Promise<DeviceValidationResult> {
  console.log('\n🔌 VALIDATING DEVICE CONNECTIVITY...');

  if (!senderDevice) {
    const reason = `Sender device not mapped for number: ${senderNumber}`;
    console.log(`${reason}`);
    return { isValid: false, reason };
  }

  if (!await isDeviceConnected(senderDevice)) {
    const reason = `Sender device disconnected: ${senderDevice}. Please reconnect and retry.`;
    console.log(`${reason}`);
    return { isValid: false, reason };
  }

  console.log(`    Sender device connected: ${senderDevice}`);

  if (direction === 'INCOMING' && isIndividual) {
    if (!receiverDevice) {
      const reason = 'Receiver (A-Party) device not mapped. Required for INCOMING tests.';
      console.log(`${reason}`);
      return { isValid: false, reason };
    }
    if (!await isDeviceConnected(receiverDevice)) {
      const reason = `Receiver (A-Party) device disconnected: ${receiverDevice}. Required for INCOMING tests.`;
      console.log(`${reason}`);
      return { isValid: false, reason };
    }
    console.log(`    Receiver device connected: ${receiverDevice}`);
  }

  return { isValid: true, reason: 'Device validation passed' };
}

/**  resetDriverAfterUSSD() for messaging app */
async function resetDriverAfterUSSD(deviceId: string): Promise<void> {
  console.log('   Resetting messaging app state after USSD...');
  const pkgs = [
    'com.google.android.apps.messaging',
    'com.android.mms',
    'com.samsung.android.messaging'
  ];
  for (const pkg of pkgs) {
    try {
      await adbShell(deviceId, `am force-stop ${pkg}`);
    } catch {
      /* ignore */
    }
  }
  await new Promise(r => setTimeout(r, 1500));
  try {
    await adbShell(deviceId, 'input keyevent 3');
    await new Promise(r => setTimeout(r, 1000));
  } catch {
    /* ignore */
  }
}

async function prepareForUSSD(deviceId: string): Promise<void> {
  await adbShell(deviceId, 'am force-stop com.android.dialer').catch(() => {});
  await adbShell(deviceId, 'am force-stop com.google.android.dialer').catch(() => {});
  await adbShell(deviceId, 'input keyevent 3').catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
}

/**  performUSSDCheckWithRetry() */
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

        // Phone number mismatch warning ()
        if (result.phoneNumber && phoneNumber) {
          const expected = cleanNumber(phoneNumber);
          const detected = cleanNumber(result.phoneNumber);
          if (expected !== detected) {
            console.log(`     Phone number mismatch! Expected: ${expected} Detected: ${detected}`);
          } else {
            console.log(`    Phone number verified: ${detected}`);
          }
        }

        if (result.cachedFromPreviousTest) {
          console.log('   ♻️  Balance reused from previous test');
        }

        return result;
      }

      console.log(`    USSD error: ${result.error}`);
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

export async function executeSms(options: SMSOptions = {}): Promise<SMSResult> {
  const ctx         = getRunContext();
  const direction   = options.direction   || 'OUTGOING';
  const messageType = options.messageType || 'text';
  const message     = options.message     || ctx.smsMessage || 'Test SMS';
  const isIndividual = options.isIndividual ?? true;
  const isGroup      = options.isGroup     ?? false;
  const groupName    = options.groupName   ?? '';

  const aPartyNumber = options.aPartyNumber || ctx.aPartyNumber;
  const bPartyNumber = options.bPartyNumber || ctx.bPartyNumber;
  const aPartyDevice = ctx.aPartyDevice;
  const bPartyDevice = ctx.bPartyDevice;

  //  Build number→device map ( buildDeviceMapping) 
  const numberToDeviceMap = new Map<string, string>();
  if (aPartyNumber && aPartyDevice) {
    numberToDeviceMap.set(cleanNumber(aPartyNumber), aPartyDevice);
    console.log(`    A-Party: ${aPartyNumber} -> ${aPartyDevice}`);
  }
  if (bPartyNumber && bPartyDevice) {
    numberToDeviceMap.set(cleanNumber(bPartyNumber), bPartyDevice);
    console.log(`    B-Party: ${bPartyNumber} -> ${bPartyDevice}`);
  }

  //  STEP 1: Determine sender/receiver ( direction logic) 
  let senderNumber: string;
  let receiverNumber: string | undefined;
  let senderDevice: string | undefined;
  let receiverDevice: string | undefined;

  if (direction === 'OUTGOING') {
    senderNumber   = aPartyNumber;
    receiverNumber = isIndividual ? (options.recipient || bPartyNumber) : undefined;
    senderDevice   = numberToDeviceMap.get(cleanNumber(senderNumber));
    receiverDevice = receiverNumber ? numberToDeviceMap.get(cleanNumber(receiverNumber)) : undefined;
  } else {
    senderNumber   = isIndividual ? (options.recipient || bPartyNumber) : bPartyNumber;
    receiverNumber = aPartyNumber;
    senderDevice   = numberToDeviceMap.get(cleanNumber(senderNumber));
    receiverDevice = receiverNumber ? numberToDeviceMap.get(cleanNumber(receiverNumber)) : undefined;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(` ${messageType.toUpperCase()} SMS | ${direction} | ${options.testName ?? ''}`);
  console.log(`Sender  : ${senderNumber} (${senderDevice ?? 'N/A'})`);
  if (receiverNumber) console.log(`    Receiver: ${receiverNumber} (${receiverDevice ?? 'N/A'})`);
  console.log('='.repeat(80));

  //  STEP 2: Device validation ─
  const validation = await validateDeviceConnectivity(
    senderDevice, receiverDevice, isIndividual, senderNumber, direction
  );

  if (!validation.isValid) {
    console.log(`\n  SKIPPING TEST: ${validation.reason}`);
    await reportSMSProgress(ctx.aPartyDevice, senderNumber, 'TEST_SKIPPED', `Skipped: ${validation.reason}`, 0);
    addSmsResult({
      name: options.testName || `${messageType} SMS`, direction,
      aPartyNumber, bPartyNumber, recipient: receiverNumber ?? 'N/A',
      messageType, message, finalStatus: 'SKIPPED',
      beforeBalance: 'N/A', afterBalance: 'N/A', balanceDeduction: 0,
      deliveryTimeSec: 0, comments: validation.reason,
      testTimestamp: new Date().toISOString()
    });
    return { sent: false, received: false, deliveryTimeSec: 0, finalStatus: 'SKIPPED' };
  }

  //  STEP 3: Pre-test USSD (sender balance) 
  let beforeUSSD_Sender: USSDResult  = { success: false, balance: 'N/A' };
  let beforeUSSD_Receiver: USSDResult = { success: false, balance: 'N/A' };

  if (ctx.ussdEnabled && senderDevice) {
    await reportSMSProgress(ctx.aPartyDevice, senderNumber, 'BALANCE_CHECK', 'Checking sender pre-SMS balance...', 20);
    beforeUSSD_Sender = await performUSSDCheckWithRetry(senderDevice, 'BEFORE', senderNumber);

    if (beforeUSSD_Sender.deviceDisconnected) {
      console.log(`\n SKIPPING TEST: Sender device disconnected during USSD check`);
      return { sent: false, received: false, deliveryTimeSec: 0, finalStatus: 'SKIPPED' };
    }

    if (beforeUSSD_Sender.success) {
      await reportSMSProgress(ctx.aPartyDevice, senderNumber, 'BALANCE_CHECK',
        `Sender pre-balance: ₹${beforeUSSD_Sender.balance}`, 30);
      console.log(`    Sender Before Balance: ₹${beforeUSSD_Sender.balance}`);
    } else {
      console.log('     Sender USSD check failed (continuing)');
    }

    // Receiver balance (only if device is available)
    if (receiverDevice && await isDeviceConnected(receiverDevice)) {
      await reportSMSProgress(ctx.aPartyDevice, receiverNumber ?? '', 'BALANCE_CHECK', 'Checking receiver pre-SMS balance...', 35);
      beforeUSSD_Receiver = await performUSSDCheckWithRetry(receiverDevice, 'BEFORE', receiverNumber ?? '');

      if (beforeUSSD_Receiver.success) {
        console.log(`    Receiver Before Balance: ₹${beforeUSSD_Receiver.balance}`);
      }
    }
  }

  //  STEP 4: Send message 
  await reportSMSProgress(ctx.aPartyDevice, senderNumber, 'SENDING_MESSAGE', `Sending ${messageType} message...`, 50);
  const sendStart = Date.now();
  let sendSuccess = false;
  

  const driver = DriverManager.getDriver();
  const messaging = driver ? new MessagingPage(driver, senderDevice!) : null;
  
  

  try {
    if (messageType === 'text') {
      if (isGroup && groupName && messaging) {
      const groupResult = await messaging.sendGroupSMS(groupName, message);

      sendSuccess = groupResult.success;

      console.log(`Participants: ${groupResult.participantCount}`);
      } else if (messaging && receiverNumber) {
        sendSuccess = await messaging.sendIndividualSMS(receiverNumber, message);
      } else if (receiverNumber) {
        await adbShell(senderDevice!, `am start -a android.intent.action.SENDTO -d sms:${receiverNumber} --es sms_body "${message}" --ez exit_on_sent true`);
        await new Promise(r => setTimeout(r, 2000));
        await adbShell(senderDevice!, 'input keyevent 22');
        await adbShell(senderDevice!, 'input keyevent 66');
        sendSuccess = true;
      }
      if (sendSuccess) console.log(`   Text message sent to ${receiverNumber ?? groupName}`);
    } else {
      if (isGroup && groupName && messaging) {
        const voiceResult = await messaging.sendGroupVoiceMessage(groupName);

        sendSuccess = voiceResult.success;

        console.log(`Participants: ${voiceResult.participantCount}`);
      } else if (messaging && receiverNumber) {
        sendSuccess =
          await messaging.sendIndividualVoiceMessage(receiverNumber);
      } else if (receiverNumber) {
        await adbShell(
          senderDevice!,
          `am start -a android.intent.action.CALL -d tel:${receiverNumber}`,
        );
        await new Promise((r) => setTimeout(r, 5000));
        await adbShell(senderDevice!, "input keyevent 6");
        sendSuccess = true;
      }
      if (sendSuccess) console.log(`   Voice message sent to ${receiverNumber ?? groupName}`);
    }
  } catch (e) {
    console.error(`[SMS] Send failed: ${(e as Error).message}`);
  }

  if (sendSuccess) {
    await reportSMSProgress(ctx.aPartyDevice, senderNumber, 'MESSAGE_SENT', `${messageType} message sent`, 60);
  } else {
    await reportSMSProgress(ctx.aPartyDevice, senderNumber, 'MESSAGE_FAILED', `Failed to send ${messageType} message`, 60);
  }

  //  STEP 5: Verify receipt 
  let received         = false;
  let deliveryTimeSec  = 0;
  let deliveryStatus   = 'UNVERIFIED';

  if (sendSuccess && isIndividual) {
    const actualReceiverDevice = direction === 'OUTGOING'
      ? receiverDevice
      : (aPartyNumber ? numberToDeviceMap.get(cleanNumber(aPartyNumber)) : undefined);
    const actualReceiverNumber = direction === 'OUTGOING' ? receiverNumber : aPartyNumber;

    if (actualReceiverDevice && await isDeviceConnected(actualReceiverDevice)) {
      await reportSMSProgress(ctx.aPartyDevice, actualReceiverNumber ?? '', 'VERIFYING_DELIVERY', 'Verifying message delivery...', 70);
      console.log(`\n VERIFYING MESSAGE RECEIPT ON RECEIVER (${actualReceiverDevice})...`);

      const timeout = Date.now() + MAX_DELIVERY_TIME_MS;

      while (Date.now() < timeout) {
        try {
          const output = await adbShell(actualReceiverDevice,
            `content query --uri content://sms/inbox --projection address,body,date --where "address='${senderNumber}'"` );
          if (output?.includes(senderNumber)) {
            received        = true;
            deliveryTimeSec = (Date.now() - sendStart) / 1000;
            break;
          }
        } catch { /* poll */ }
        await new Promise(r => setTimeout(r, MESSAGE_POLL_INTERVAL));
      }

      if (received) {
        deliveryStatus = deliveryTimeSec * 1000 <= MAX_DELIVERY_TIME_MS ? 'SUCCESS' : 'FAILED_SLA';
        console.log(`   ⏱️  Delivery: ${deliveryTimeSec.toFixed(1)}s — ${deliveryStatus}`);
        await reportSMSProgress(ctx.aPartyDevice, actualReceiverNumber ?? '',
          deliveryStatus === 'SUCCESS' ? 'DELIVERY_SUCCESS' : 'DELIVERY_FAILED_SLA',
          `Delivered in ${deliveryTimeSec.toFixed(1)}s`, 80);
      } else {
        console.log('     Could not verify receipt within SLA window');
        await reportSMSProgress(ctx.aPartyDevice, actualReceiverNumber ?? '', 'DELIVERY_TIMEOUT', 'Delivery not verified', 80);
      }
    }
  }

  //  STEP 6: Post-test USSD (sender balance) ─
  let afterUSSD_Sender: USSDResult   = { success: false, balance: 'N/A' };
  let afterUSSD_Receiver: USSDResult = { success: false, balance: 'N/A' };

  if (ctx.ussdEnabled && senderDevice) {
    await reportSMSProgress(ctx.aPartyDevice, senderNumber, 'BALANCE_CHECK', 'Checking post-SMS balance...', 90);
    afterUSSD_Sender = await performUSSDCheckWithRetry(senderDevice, 'AFTER', senderNumber);

    if (afterUSSD_Sender.success) {
      console.log(`    Sender After Balance: ₹${afterUSSD_Sender.balance}`);
    }

    if (receiverDevice && await isDeviceConnected(receiverDevice)) {
      afterUSSD_Receiver = await performUSSDCheckWithRetry(receiverDevice, 'AFTER', receiverNumber ?? '');
      if (afterUSSD_Receiver.success) {
        console.log(`    Receiver After Balance: ₹${afterUSSD_Receiver.balance}`);
      }
    }
  }

  //  STEP 7: Calculate deduction + log result 
  const deduction = (beforeUSSD_Sender.balanceNumeric != null && afterUSSD_Sender.balanceNumeric != null)
    ? beforeUSSD_Sender.balanceNumeric - afterUSSD_Sender.balanceNumeric
    : 0;

  if (deduction > 0) console.log(`   💸 Balance Deduction: ₹${deduction.toFixed(2)}`);

  const finalStatus = sendSuccess
    ? (received || !receiverDevice ? 'SUCCESS' : 'FAILED_RECEIPT')
    : 'FAILED_SEND';

  addSmsResult({
    name: options.testName || `${messageType} SMS to ${receiverNumber ?? 'N/A'}`,
    direction,
    aPartyNumber,
    bPartyNumber,
    recipient: receiverNumber ?? 'N/A',
    messageType,
    message,
    finalStatus,
    beforeBalance: beforeUSSD_Sender.balance || 'N/A',
    afterBalance: afterUSSD_Sender.balance || 'N/A',
    balanceDeduction: deduction,
    deliveryTimeSec,
    comments: [
      `Deduction: ₹${deduction.toFixed(2)}`,
      received ? `Delivered in ${deliveryTimeSec.toFixed(1)}s` : '',
      deliveryStatus !== 'UNVERIFIED' ? `Delivery: ${deliveryStatus}` : ''
    ].filter(Boolean).join(' | '),
    testTimestamp: new Date().toISOString()
  });

  await reportSMSProgress(ctx.aPartyDevice, senderNumber, 'TEST_COMPLETED', 'Test Completed', 100);
  console.log(`${finalStatus === 'SUCCESS' ? '' : ''} SMS Test Status: ${finalStatus}`);

  return { sent: sendSuccess, received, deliveryTimeSec, finalStatus };
}

//  Convenience wrappers 

export async function sendSms(
  targetNumber: string, message: string, count = 1, options: SMSOptions = {}
): Promise<SMSResult> {
  return executeSms({ ...options, direction: 'OUTGOING', bPartyNumber: targetNumber, message, smsCount: count });
}

export async function receiveSms(senderNumber: string, options: SMSOptions = {}): Promise<SMSResult> {
  return executeSms({ ...options, direction: 'INCOMING', bPartyNumber: senderNumber });
}

//  Excel batch executor ( CompleteSMSTestExecutor) ─

export type SMSTestResult = Record<string, unknown>;

function inferMessageType(testType: string): 'text' | 'voice' {
  return /voice/i.test(testType) ? 'voice' : 'text';
}

function inferIsGroup(testType: string): boolean {
  return /group/i.test(testType);
}

export class CompleteSMSTestExecutor {
  private readonly deviceId: string;

  constructor(_driver: import('../types/driver').AndroidDriver, primaryDeviceId: string) {
    this.deviceId = primaryDeviceId;
  }

  async executeAllSMSTests(excelFilePath: string): Promise<SMSTestResult[]> {
    const ctx = getRunContext();
    const { readSmsRows } = await import('../utils/excelReader');
    const { flushReports } = await import('../reporting');
    const { ProgressReporter } = await import('../utils/progressReporter');

    const rows = await readSmsRows(excelFilePath);
    const results: SMSTestResult[] = [];

    if (!rows.length) {
      console.log(' No SMS test data found');
      return results;
    }

    await ProgressReporter.initializeTestSuite(this.deviceId, rows.length);

    for (const row of rows) {
      const isGroup = inferIsGroup(row.testType);
      const messageType = inferMessageType(row.testType);

      const smsResult = await executeSms({
        testName: row.testType,
        testType: row.testType,
        messageType,
        direction: (row.direction?.toUpperCase() || 'OUTGOING') as SMSOptions['direction'],
        message: row.message || ctx.smsMessage,
        aPartyNumber: row.aPartyNumber || ctx.aPartyNumber,
        bPartyNumber: row.bPartyNumber || ctx.bPartyNumber,
        recipient: isGroup ? undefined : row.bPartyNumber || ctx.bPartyNumber,
        isIndividual: !isGroup,
        isGroup,
        groupName: row.groupName,
        smsCount: row.smsCount
      });

      results.push({
        name: row.testType,
        direction: row.direction,
        messageType,
        isIndividual: !isGroup,
        isGroup,
        totalSMS: row.smsCount,
        successfulSMS: smsResult.sent ? row.smsCount : 0,
        deliveryTimeMs: Math.round(smsResult.deliveryTimeSec * 1000),
        finalStatus: smsResult.finalStatus,
        comments: smsResult.finalStatus,
        testTimestamp: new Date().toISOString()
      });

      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
      await flushReports();
    } catch (e) {
      console.warn('[SMS] Report flush:', (e as Error).message);
    }

    return results;
  }

  async cleanup(): Promise<void> {
    try {
      await DriverManager.quitDriver();
    } catch {
      /* ignore */
    }
    console.log('[CompleteSMSTestExecutor] cleanup complete');
  }
}