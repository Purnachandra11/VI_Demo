import { adbShell } from '../utils/adb';
import { reportDataProgress } from '../utils/progressReporter';
import { getRunContext } from '../utils/env';
import { addDataUsageResult } from '../reporting/resultStore';
import { getOrPerformPreTestUSSD, performPostTestUSSD, USSDResult } from '../utils/ussdService';

//  Constants () ─
const MAX_USSD_RETRIES       = 2;
const USSD_WAIT_BEFORE_DATA  = 5_000;   // ms
const USSD_WAIT_AFTER_DATA   = 8_000;   // ms

// Mobile interfaces to check —  getMobileDataBytes()
const MOBILE_INTERFACES = ['ccmni1', 'rmnet_data0', 'rmnet_data1', 'rmnet0'];

//  Types 

export interface DataResult {
  consumedMB: number;
  success: boolean;
  finalStatus: string;
}

export interface DataOptions {
  testName?: string;
  scenario?: string;
  targetDataGb?: number;
  durationMin?: number;
  appsToUse?: string;
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

/**  resetDriverAfterUSSD() */
async function resetDriverAfterUSSD(deviceId: string): Promise<void> {
  try {
    await adbShell(deviceId, 'am force-stop com.google.android.dialer');
    await new Promise(r => setTimeout(r, 2000));
  } catch { /* ignore */ }
  try {
    await adbShell(deviceId, 'input keyevent 3');
    await new Promise(r => setTimeout(r, 1000));
  } catch { /* ignore */ }
}

async function prepareForUSSD(deviceId: string): Promise<void> {
  await adbShell(deviceId, 'am force-stop com.android.dialer').catch(() => {});
  await adbShell(deviceId, 'am force-stop com.google.android.dialer').catch(() => {});
  await adbShell(deviceId, 'input keyevent 3').catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
}

/**
 *  performUSSDCheckWithRetry() — with device connectivity guard.
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
      console.log(`   ❌ Device disconnected: ${deviceId}`);
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
            console.log(`     Phone mismatch! Expected: ${expected} | Detected: ${detected}`);
          } else {
            console.log(`    Phone verified: ${detected}`);
          }
        }

        if (result.cachedFromPreviousTest) {
          console.log('   ♻️  Balance reused from previous test (preDataUSSDSource: CACHED)');
        } else {
          console.log('   🔄 Fresh USSD check (preDataUSSDSource: NEW_CHECK)');
        }

        return result;
      }

      console.log(`   ❌ USSD error: ${result.error}`);
    } catch (e) {
      console.error(`   ❌ USSD attempt failed: ${(e as Error).message}`);
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

/**
 *  getMobileDataBytes() — reads /proc/net/dev for mobile interface rx+tx bytes.
 */
async function getMobileDataBytes(deviceId: string): Promise<number> {
  try {
    const output = await adbShell(deviceId, 'cat /proc/net/dev');
    const lines  = output.split('\n');

    for (const iface of MOBILE_INTERFACES) {
      const line = lines.find(l => l.includes(iface));
      if (line) {
        const parts = line.trim().split(/\s+/);
        const rx    = parseInt(parts[1], 10);
        const tx    = parseInt(parts[9], 10);
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
        const rx    = parseInt(parts[1], 10);
        const tx    = parseInt(parts[9], 10);
        if (!isNaN(rx) && !isNaN(tx) && (rx + tx) > 0) {
          return rx + tx;
        }
      }
    }
  } catch (e) {
    console.error(`[Data] Failed to read /proc/net/dev: ${(e as Error).message}`);
  }
  return 0;
}

//  Main executor 

export async function executeDataUsage(options: DataOptions = {}): Promise<DataResult> {
  const ctx         = getRunContext();
  const deviceId    = ctx.aPartyDevice;
  const phoneNumber = ctx.aPartyNumber;
  const scenario    = options.scenario    || 'Default Data Test';
  const targetGb    = options.targetDataGb ?? ctx.targetDataGb;
  const durationMin = options.durationMin  ?? ctx.durationMin;
  const apps        = options.appsToUse   || 'Chrome, YouTube';

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
  let beforeUSSD: USSDResult = { success: false, balance: 'N/A' };

  if (ctx.ussdEnabled) {
    await reportDataProgress(deviceId, phoneNumber, 'Checking pre-data balance...', 'USSD_CHECK', 20);
    await new Promise(r => setTimeout(r, USSD_WAIT_BEFORE_DATA));
    beforeUSSD = await performUSSDCheckWithRetry(deviceId, 'BEFORE', phoneNumber);

    if (beforeUSSD.deviceDisconnected) {
      return { consumedMB: 0, success: false, finalStatus: 'DEVICE_DISCONNECTED' };
    }

    if (beforeUSSD.success) {
      await reportDataProgress(deviceId, phoneNumber, `Pre-balance: ₹${beforeUSSD.balance}`, 'USSD_CHECK', 30);
      console.log(`    Before Balance: ₹${beforeUSSD.balance}`);
      if (beforeUSSD.validity) console.log(`   📅 Validity: ${beforeUSSD.validity}`);
    } else {
      console.log('     USSD check failed after retries (continuing)');
      await reportDataProgress(deviceId, phoneNumber, 'USSD check failed (continuing)', 'USSD_CHECK_FAILED', 30);
    }
  }

  //  STEP 3: Baseline + consumption via DataUsagePage 
  const driver = (await import('../driver/DriverManager')).DriverManager.getDriver();
  let consumedMB = 0;
  let consumedGB = 0;
  let consumedRxMB = 0;
  let consumedTxMB = 0;
  let dataSource = 'ccmni1';
  let scenarioStatus = 'FAIL';

  if (driver) {
    const { DataUsagePage } = await import('../pages/DataUsagePage');
    const page = new DataUsagePage(driver, deviceId);
    const scenarioResult = await page.executeDataUsageScenario(
      scenario,
      targetGb,
      durationMin,
      apps,
      phoneNumber
    );
    consumedMB = scenarioResult.consumedMB;
    consumedGB = scenarioResult.consumedGB;
    consumedRxMB = scenarioResult.consumedRxMB ?? 0;
    consumedTxMB = scenarioResult.consumedTxMB ?? 0;
    dataSource = scenarioResult.dataSource ?? dataSource;
    scenarioStatus = scenarioResult.status;
  } else {
    const initialBytes = await getMobileDataBytes(deviceId);
    await reportDataProgress(deviceId, phoneNumber, 'Starting data consumption...', 'IN_PROGRESS', 40);
    try {
      await adbShell(deviceId, 'am start -a android.intent.action.VIEW -d https://speedtest.tele2.net/10MB.zip');
      await new Promise(r => setTimeout(r, durationMin * 60 * 1000));
    } catch (e) {
      console.error(`[Data] Consumption error: ${(e as Error).message}`);
    }
    const finalBytes = await getMobileDataBytes(deviceId);
    const consumedBytes = Math.max(0, finalBytes - initialBytes);
    consumedMB = consumedBytes / (1024 * 1024);
    consumedGB = consumedMB / 1024;
    scenarioStatus = consumedGB >= targetGb * 0.8 ? 'SUCCESS' : consumedMB > 0 ? 'PARTIAL_SUCCESS' : 'FAIL';
  }

  console.log(`\n   Consumed: ${consumedMB.toFixed(2)} MB (${consumedGB.toFixed(4)} GB)`);
  await reportDataProgress(deviceId, phoneNumber, `Consumed: ${consumedMB.toFixed(2)} MB`, 'IN_PROGRESS', 75);

  //  STEP 6: Post-data USSD balance check ─
  let afterUSSD: USSDResult = { success: false, balance: 'N/A' };

  if (ctx.ussdEnabled) {
    await reportDataProgress(deviceId, phoneNumber, 'Checking post-data balance...', 'USSD_CHECK', 90);
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

  if (deduction > 0) console.log(`   💸 Balance Deduction: ₹${deduction.toFixed(2)}`);

  const targetAchieved = consumedGB >= targetGb * 0.8;
  const finalStatus    = scenarioStatus || (targetAchieved ? 'SUCCESS' : consumedMB > 0 ? 'PARTIAL_SUCCESS' : 'FAIL');

  addDataUsageResult({
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
    afterBalance: afterUSSD.balance   || 'N/A',
    balanceDeduction: deduction,
    finalStatus,
    timestamp: new Date().toISOString(),
    comments: `Deduction: Rs ${deduction.toFixed(2)}, Consumed: ${consumedMB.toFixed(2)} MB via ${dataSource}`
  });

  await reportDataProgress(deviceId, phoneNumber, 'Test Completed', 'TEST_COMPLETE', 100);
  console.log(`${finalStatus === 'SUCCESS' ? '' : finalStatus === 'PARTIAL_SUCCESS' ? '' : '❌'} Data Test: ${finalStatus}`);

  return { consumedMB, success: targetAchieved, finalStatus };
}

export async function executeDataUsageTest(options: DataOptions = {}): Promise<DataResult> {
  return executeDataUsage({
    ...options,
    targetDataGb: options.targetDataGb ?? (process.env.TARGET_DATA_GB ? parseFloat(process.env.TARGET_DATA_GB) : undefined),
    durationMin:  options.durationMin  ?? (process.env.DURATION_MIN  ? parseInt(process.env.DURATION_MIN)      : undefined),
  });
}

//  Excel batch executor ( DataUsageTestExecutor) 

export type DataUsageTestResult = Record<string, unknown>;

export class DataUsageTestExecutor {
  private readonly deviceId: string;

  constructor(_driver: import('../types/driver').AndroidDriver, deviceId: string) {
    this.deviceId = deviceId;
  }

  async executeDataUsageTests(excelFilePath: string): Promise<DataUsageTestResult[]> {
    const { readDataUsageRows } = await import('../utils/excelReader');
    const { flushReports } = await import('../reporting');
    const { ProgressReporter } = await import('../utils/progressReporter');

    const rows = await readDataUsageRows(excelFilePath);
    const results: DataUsageTestResult[] = [];

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
    } catch (e) {
      console.warn('[Data] Report flush:', (e as Error).message);
    }

    return results;
  }
}