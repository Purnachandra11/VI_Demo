import { before, after, describe, it } from 'mocha';

import { DriverManager }             from '../driver/DriverManager';
import { ADBHelper }                 from '../utils/ADBHelper';
import { DeviceManager }             from '../utils/DeviceManager';
import { ProgressReporter }          from '../utils/progressReporter';
import { ConfigReader }              from '../config/ConfigReader';
import { CompleteSMSTestExecutor }   from '../core/smsExecutor';
import type { AndroidDriver }        from '../types/driver';

//  types ─
interface SMSResult {
  finalStatus:      string;
  direction?:       string;
  isIndividual?:    boolean;
  isGroup?:         boolean;
  messageType?:     string;
  totalSMS?:        number;
  successfulSMS?:   number;
  deliveryTimeMs?:  number;
  balanceDeduction?: number;
  name?:            string;
  comments?:        string;
}

//  helpers 
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s (${ms} ms)`;
}

//  suite ─
describe('SMS & Voice Message Tests', function () {
  let driver: AndroidDriver;
  let smsExecutor: CompleteSMSTestExecutor;
  let aPartyDeviceId: string;
  let aPartyNumber: string;
  let bPartyDeviceId: string | undefined;
  let bPartyNumber: string | undefined;

  //  @BeforeClass 
  before(async function () {
    this.timeout(120_000);

    console.log('\n' + '='.repeat(100));
    console.log('💬 SMS & VOICE MESSAGE TEST SETUP');
    console.log('='.repeat(100));

    //  STEP 1: resolve devices 
    aPartyDeviceId = process.env.APARTY_DEVICE ?? process.env.A_PARTY_DEVICE ?? process.env.DEVICE_ID ?? '';
    if (!aPartyDeviceId) {
      const devices = await ADBHelper.getConnectedDevices();
      if (!devices.length) {
        throw new Error('❌ No device connected. Please connect at least one device.');
      }
      aPartyDeviceId = devices[0];
      console.log(`🔍 Auto-detected A-Party device: ${aPartyDeviceId}`);
    }

    //  STEP 2: validate required params ─
    aPartyNumber   = process.env.APARTY_NUMBER ?? process.env.A_PARTY_NUMBER ?? '';
    bPartyDeviceId = process.env.BPARTY_DEVICE ?? process.env.B_PARTY_DEVICE;
    bPartyNumber   = process.env.BPARTY_NUMBER ?? process.env.B_PARTY_NUMBER;

    if (!aPartyNumber) {
      throw new Error('❌ A-Party number is required. Set env A_PARTY_NUMBER=XXXXXXXXXX');
    }

    let platformVersion = process.env.PLATFORM_VERSION ?? '';
    if (!platformVersion) {
      const raw = await ADBHelper.getAndroidVersion(aPartyDeviceId);
      platformVersion = raw.split('.')[0];
    }

    //  STEP 3: print configuration ─
    const aModel = await ADBHelper.getDeviceModel(aPartyDeviceId);
    console.log('\n DEVICE CONFIGURATION:');
    console.log('┌┐');
    console.log('│ A-Party (Primary):                                              │');
    console.log(`│   Device ID: ${aPartyDeviceId.padEnd(48)}│`);
    console.log(`│   Number:    ${aPartyNumber.padEnd(48)}│`);
    console.log(`│   Model:     ${aModel.padEnd(48)}│`);
    console.log(`│   Android:   ${platformVersion.padEnd(48)}│`);
    console.log('├┤');

    if (bPartyDeviceId && bPartyNumber) {
      const bModel = await ADBHelper.getDeviceModel(bPartyDeviceId);
      console.log('│ B-Party (Secondary):                                            │');
      console.log(`│   Device ID: ${bPartyDeviceId.padEnd(48)}│`);
      console.log(`│   Number:    ${bPartyNumber.padEnd(48)}│`);
      console.log(`│   Model:     ${bModel.padEnd(48)}│`);
      console.log('│   Status:     Full bidirectional SMS support                 │');
    } else {
      console.log('│ B-Party (Secondary):   NOT CONFIGURED                         │');
      console.log('│   Status:      INCOMING SMS tests will be SKIPPED            │');
    }
    console.log('└┘');

    //  STEP 4: progress report 
    ProgressReporter.reportSMSProgress(
      aPartyDeviceId, '', 'INITIALIZING', 'Setting up SMS test environment', 0.0
    );

    //  STEP 5: DeviceManager 
    console.log('\n INITIALIZING DEVICE MANAGER...');
    if (bPartyDeviceId && bPartyNumber) {
      await DeviceManager.initializeDevices(
        aPartyDeviceId, aPartyNumber, bPartyDeviceId, bPartyNumber
      );
      console.log(' Both devices configured - Full bidirectional SMS support enabled');
    } else {
      console.log('  Only A-Party configured');
      console.log('   📤 OUTGOING tests:  Supported');
      console.log('    INCOMING tests:   Will be SKIPPED');
      await DeviceManager.initializeDevices(aPartyDeviceId, aPartyNumber, null, null);
    }
    DeviceManager.printDeviceStatus();

    //  STEP 6: Appium ─
    console.log('\n STARTING APPIUM SERVICE...');
    await DriverManager.startAppiumService();
    console.log(' Appium service started');

    //  STEP 7: driver ─
    console.log('\n💬 INITIALIZING MESSAGING DRIVER FOR A-PARTY...');
    driver = await DriverManager.initializeDriverForMessaging(aPartyDeviceId, platformVersion);
    if (!driver) throw new Error('❌ Failed to initialize driver for A-Party');
    console.log(' Driver initialized successfully');

    //  STEP 8: executor 
    console.log('\n INITIALIZING SMS TEST EXECUTOR...');
    smsExecutor = new CompleteSMSTestExecutor(driver, aPartyDeviceId);
    console.log(' SMS Test Executor ready');

    //  STEP 9: ready 
    ProgressReporter.reportSMSProgress(
      aPartyDeviceId, '', 'READY', 'SMS test environment ready', 5.0
    );
    console.log('\n SMS TEST SETUP COMPLETED SUCCESSFULLY ');
    console.log('='.repeat(100) + '\n');
  });

  //  @Test testAllSMSAndVoiceScenarios ─
  it('executes all SMS and voice scenarios from Excel', async function () {
    this.timeout(600_000);

    console.log('\n' + '='.repeat(100));
    console.log('🚀 EXECUTING ALL SMS & VOICE MESSAGE TESTS');
    console.log('='.repeat(100));

    const excelFilePath = ConfigReader.getExcelFilePath();
    console.log(`📄 Excel File: ${excelFilePath}`);

    ProgressReporter.reportSMSProgress(
      aPartyDeviceId, '', 'LOADING', 'Reading SMS test data from Excel', 10.0
    );

    const results =
      await smsExecutor.executeAllSMSTests(excelFilePath);

    //  summary 
    printTestSummary(results);

    //  validation (soft-assert style) 
    const failures: string[] = [];
    for (const r of results) {
      if (r.finalStatus === 'FAILED' || r.finalStatus === 'ERROR') {
        failures.push(`${r.name ?? 'unknown'} — ${r.comments ?? 'no details'}`);
      }
    }

    //  progress complete 
    const totalTests      = results.length;
    const successfulTests = results.filter(r => r.finalStatus === 'SUCCESS').length;
    const successRate     = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;

    ProgressReporter.reportTestComplete(
      aPartyDeviceId,
      'sms',
      successfulTests === totalTests,
      `Completed ${totalTests} tests with ${successRate.toFixed(1)}% success rate`
    );

    // throw after reporting so ProgressReporter always gets called
    if (failures.length) {
      throw new Error(`SMS tests failed:\n  ${failures.join('\n  ')}`);
    }

    expect(results.length).toBeGreaterThan(0);
  });

  //  @AfterClass ─
  after(async function () {
    console.log('\n' + '='.repeat(100));
    console.log('🧹 CLEANUP & TEARDOWN');
    console.log('='.repeat(100));

    if (smsExecutor) {
      try {
        await smsExecutor.cleanup();
        console.log(' SMS Executor cleanup completed');
      } catch (e: unknown) {
        console.warn(`  SMS Executor cleanup issue: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (driver) {
      try {
        await DriverManager.quitDriver();
        console.log(' Main driver quit successfully');
      } catch (e: unknown) {
        console.warn(`  Main driver quit issue: ${e instanceof Error ? e.message : e}`);
      }
    }

    try {
      await DriverManager.stopAppiumService();
      console.log(' Appium service stopped');
    } catch (e: unknown) {
      console.warn(`  Appium service stop issue: ${e instanceof Error ? e.message : e}`);
    }

    console.log('='.repeat(100));
    console.log(' TEARDOWN COMPLETE');
  });

  //  private helpers 
  function printTestSummary(results: Array<{
    finalStatus?: string;
    direction?: string;
    isIndividual?: boolean;
    isGroup?: boolean;
    messageType?: string;
    totalSMS?: number;
    successfulSMS?: number;
    deliveryTimeMs?: number;
    balanceDeduction?: number;
  }>): void {
    console.log('\n' + '='.repeat(100));
    console.log('📈 TEST EXECUTION SUMMARY');
    console.log('='.repeat(100));

    if (!results.length) {
      console.log('  No tests were executed');
      return;
    }

    const total   = results.length;
    const passed  = results.filter(r => r.finalStatus === 'SUCCESS').length;
    const partial = results.filter(r => r.finalStatus === 'PARTIAL_SUCCESS').length;
    const failed  = results.filter(r => r.finalStatus === 'FAILED').length;
    const error   = results.filter(r => r.finalStatus === 'ERROR').length;
    const skipped = results.filter(r => r.finalStatus === 'SKIPPED').length;

    console.log('\n┌┐');
    console.log('│ OVERALL TEST STATISTICS                                         │');
    console.log('├┤');
    console.log(`│ Total Tests:          ${String(total).padEnd(41)}│`);
    console.log(`│  Passed:            ${String(passed).padEnd(41)}│`);
    console.log(`│   Partial:           ${String(partial).padEnd(41)}│`);
    console.log(`│ ❌ Failed:            ${String(failed).padEnd(41)}│`);
    console.log(`│ 🚨 Error:             ${String(error).padEnd(41)}│`);
    console.log(`│ ⭕ Skipped:           ${String(skipped).padEnd(41)}│`);
    if (total > 0) {
      const rate = ((passed / total) * 100).toFixed(1);
      console.log(`│ Success Rate:         ${(rate + '%').padEnd(41)}│`);
    }
    console.log('└┘');

    // message delivery
    const totalSMS      = results.reduce((s, r) => s + (r.totalSMS ?? 0), 0);
    const successfulSMS = results.reduce((s, r) => s + (r.successfulSMS ?? 0), 0);

    console.log('\n┌┐');
    console.log('│ MESSAGE DELIVERY STATISTICS                                     │');
    console.log('├┤');
    console.log(`│ Total Messages Sent:  ${String(totalSMS).padEnd(41)}│`);
    console.log(`│  Delivered:         ${String(successfulSMS).padEnd(41)}│`);
    console.log(`│ ❌ Failed:            ${String(totalSMS - successfulSMS).padEnd(41)}│`);
    if (totalSMS > 0) {
      const rate = ((successfulSMS / totalSMS) * 100).toFixed(1);
      console.log(`│ Delivery Rate:        ${(rate + '%').padEnd(41)}│`);
    }
    console.log('└┘');

    // direction breakdown
    const outgoing = results.filter(r => r.direction === 'OUTGOING').length;
    const incoming = results.filter(r => r.direction === 'INCOMING').length;

    console.log('\n┌┐');
    console.log('│ DIRECTION BREAKDOWN                                             │');
    console.log('├┤');
    console.log(`│ 📤 OUTGOING:          ${String(outgoing).padEnd(41)}│`);
    console.log(`│  INCOMING:          ${String(incoming).padEnd(41)}│`);
    console.log('└┘');

    // type breakdown
    const individual = results.filter(r => r.isIndividual).length;
    const group      = results.filter(r => r.isGroup).length;

    console.log('\n┌┐');
    console.log('│ MESSAGE TYPE BREAKDOWN                                          │');
    console.log('├┤');
    console.log(`│  Individual:        ${String(individual).padEnd(41)}│`);
    console.log(`│ 👥 Group:             ${String(group).padEnd(41)}│`);
    console.log('└┘');

    // message format breakdown
    const textMessages  = results.filter(r => r.messageType?.toLowerCase() === 'text').length;
    const voiceMessages = results.filter(r => r.messageType?.toLowerCase() === 'voice').length;

    console.log('\n┌┐');
    console.log('│ MESSAGE FORMAT BREAKDOWN                                        │');
    console.log('├┤');
    console.log(`│ 💬 Text Messages:     ${String(textMessages).padEnd(41)}│`);
    console.log(`│ 🎤 Voice Messages:    ${String(voiceMessages).padEnd(41)}│`);
    console.log('└┘');

    // delivery time analysis
    const deliveryTimes = results
      .filter(r => r.deliveryTimeMs !== undefined && (r.deliveryTimeMs ?? 0) > 0)
      .map(r => r.deliveryTimeMs as number)
      .sort((a, b) => a - b);

    if (deliveryTimes.length) {
      const minTime  = deliveryTimes[0];
      const maxTime  = deliveryTimes[deliveryTimes.length - 1];
      const avgTime  = deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length;
      const withinSLA = deliveryTimes.filter(t => t <= 60_000).length;
      const exceedsSLA = deliveryTimes.length - withinSLA;

      console.log('\n┌┐');
      console.log('│ DELIVERY TIME ANALYSIS                                          │');
      console.log('├┤');
      console.log(`│ Measured Deliveries:  ${String(deliveryTimes.length).padEnd(41)}│`);
      console.log(`│ ⏱️  Min Time:          ${formatTime(minTime).padEnd(35)}│`);
      console.log(`│ ⏱️  Max Time:          ${formatTime(maxTime).padEnd(35)}│`);
      console.log(`│ ⏱️  Avg Time:          ${formatTime(Math.round(avgTime)).padEnd(35)}│`);
      console.log(`│  Within SLA (≤60s): ${String(withinSLA).padEnd(41)}│`);
      console.log(`│ ❌ Exceeds SLA (>60s):${String(exceedsSLA).padEnd(41)}│`);
      console.log('└┘');
    }

    // balance deduction summary
    const totalDeduction = results.reduce((s, r) => s + (r.balanceDeduction ?? 0), 0);
    if (totalDeduction > 0 && successfulSMS > 0) {
      console.log('\n┌┐');
      console.log('│ BALANCE DEDUCTION SUMMARY                                       │');
      console.log('├┤');
      console.log(`│ Total Deduction:      ₹${totalDeduction.toFixed(2).padEnd(38)}│`);
      console.log(`│ Avg Per Message:      ₹${(totalDeduction / successfulSMS).toFixed(2).padEnd(38)}│`);
      console.log('└┘');
    }

    console.log('\n' + '='.repeat(100));
  }
});