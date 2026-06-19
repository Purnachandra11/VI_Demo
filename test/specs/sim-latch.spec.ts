/**
 * sim-latch.spec.ts
 * Mirrors: SIMAutoLatchTestSuite.java (SIMAutoLatchTestExecutor)
 *
 * Setup mirrors @BeforeClass:
 *   – resolve aPartyDevice / bPartyDevice / aPartyNumber / bPartyNumber from env
 *   – auto-detect devices when not provided
 *
 * Test mirrors @Test executeSIMAutoLatchTests():
 *   – reads Excel from hardcoded path (src/test/resources/contacts.xlsx)
 *   – SIMAutoLatchTestExecutor.executeAllSIMAutoLatchTests(excelPath)
 *   – prints PASS / MARGINAL / SLOW / FAILED counts + success rate
 *   – prints expected output table header + first 3 sample rows
 *
 * Teardown mirrors @AfterClass.
 */

import { before, after, describe, it } from 'mocha';
import path from 'path';

import { ADBHelper }               from '../utils/ADBHelper';
import { SIMAutoLatchTestExecutor } from '../core/simLatchExecutor';

//  types ─
interface SIMLatchResult {
  testResult:         string;      // PASS | MARGINAL | SLOW | FAIL | ERROR
  deviceId?:          string;
  partyNumber?:       string;
  timeoutSeconds?:    number | string;
  initialNetworkState?: string;
  finalNetworkState?: string;
  autoLatchTimeMs?:   number | string;
  autoLatchTimeSeconds?: number | string;
  transitions?:       string;
  finalIMSRegistered?: string;
  comments?:          string;
}

//  suite ─
describe('SIM Auto-Latch Tests', function () {
  let aPartyDeviceId: string;
  let bPartyDeviceId: string | undefined;
  let aPartyNumber:   string;
  let bPartyNumber:   string;

  //  @BeforeClass 
  before(async function () {
    this.timeout(60_000);

    console.log('\n' + '='.repeat(100));
    console.log('📡 SIM AUTO-LATCH TEST SUITE SETUP');
    console.log('='.repeat(100));

    //  resolve params ( System.getProperty) 
    aPartyDeviceId = process.env.A_PARTY_DEVICE ?? '';
    bPartyDeviceId = process.env.B_PARTY_DEVICE;
    aPartyNumber   = process.env.A_PARTY_NUMBER ?? '8696904544';  // Java default
    bPartyNumber   = process.env.B_PARTY_NUMBER ?? '9773328866';  // Java default

    //  auto-detect devices if not provided ─
    if (!aPartyDeviceId) {
      const devices = await ADBHelper.getConnectedDevices();
      if (!devices.length) throw new Error('❌ No device connected');
      aPartyDeviceId = devices[0];
      if (devices.length > 1) {
        bPartyDeviceId = devices[1];
      }
    }

    console.log(' Configuration:');
    console.log(`   A-Party Device: ${aPartyDeviceId}`);
    console.log(`   A-Party Number: ${aPartyNumber}`);
    console.log(`   B-Party Device: ${bPartyDeviceId ?? '(not provided)'}`);
    console.log(`   B-Party Number: ${bPartyNumber}`);

    console.log(' Setup completed successfully\n');
  });

  //  @Test executeSIMAutoLatchTests ─
  it('executes all SIM auto-latch tests from Excel', async function () {
    this.timeout(600_000);

    console.log('\n' + '='.repeat(100));
    console.log('📡 EXECUTING SIM AUTO-LATCH TESTS');
    console.log('='.repeat(100));

    // Java uses hardcoded path — mirror that here
    const excelFilePath = path.resolve('src/test/resources/contacts.xlsx');
    console.log(`📄 Excel File: ${excelFilePath}`);

    const executor = new SIMAutoLatchTestExecutor(
      aPartyDeviceId,
      bPartyDeviceId ?? '',
      aPartyNumber,
      bPartyNumber
    );

    const results =
      await executor.executeAllSIMAutoLatchTests(excelFilePath);

    //  summary 
    const passed   = results.filter(r => r.testResult === 'PASS').length;
    const marginal = results.filter(r => r.testResult === 'MARGINAL').length;
    const slow     = results.filter(r => r.testResult === 'SLOW').length;
    const failed   = results.filter(
      r => r.testResult === 'FAIL' || r.testResult === 'ERROR'
    ).length;

    console.log('\n' + '='.repeat(100));
    console.log('📈 SIM AUTO-LATCH TESTS COMPLETED');
    console.log(`Total Tests: ${results.length}`);
    console.log(` PASS (< 30s): ${passed}`);
    console.log(`  MARGINAL (30-60s): ${marginal}`);
    console.log(`🐌 SLOW (> 60s): ${slow}`);
    console.log(`❌ FAILED: ${failed}`);

    if (results.length > 0) {
      const successRate = (((passed + marginal) / results.length) * 100).toFixed(1);
      console.log(`\n📊 Overall Success Rate: ${successRate}%`);
    }

    //  expected output table ( print) ─
    console.log('\n📋 EXPECTED OUTPUT FORMAT:');
    console.log('='.repeat(120));
    console.log(
      'Device ID\tParty Number\tTimeout(s)\tInitial Network\tFinal Network\t' +
      'Auto-Latch Time(ms)\tAuto-Latch Time(s)\tTest Result\tTransitions\t' +
      'IMS Registered\tisRoaming\tComments'
    );
    console.log('-'.repeat(120));

    const sample = results.slice(0, 3);
    for (const r of sample) {
      console.log(
        [
          r.deviceId               ?? '',
          r.partyNumber            ?? '',
          r.timeoutSeconds         ?? '',
          r.initialNetworkState    ?? '',
          r.finalNetworkState      ?? '',
          r.autoLatchTimeMs        ?? '',
          r.autoLatchTimeSeconds   ?? '',
          r.testResult             ?? '',
          r.transitions            ?? '',
          r.finalIMSRegistered     ?? '',
          'TRUE',                          // placeholder for roaming status
          r.comments               ?? '',
        ].join('\t')
      );
    }

    if (results.length > 3) {
      console.log(`... (${results.length - 3} more results)`);
    }

    console.log('='.repeat(100));

    //  assertion ─
    expect(results.length).toBeGreaterThan(0);
    if (failed > 0) {
      // Mirror Java: throws AssertionError when failures exist
      throw new AssertionError(`SIM auto-latch tests failed: ${failed} test(s) failed`);
    }
  });

  //  @AfterClass ─
  after(function () {
    console.log('\n' + '='.repeat(100));
    console.log('🧹 CLEANUP');
    console.log('='.repeat(100));
    console.log(' Test execution completed');
  });
});

//  mini AssertionError shim ( throw new AssertionError) ─
class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}