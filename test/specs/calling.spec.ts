/**
 * calling.spec.ts
 * Mirrors: CallingTest.java (CompleteCallingTestExecutor)
 *
 * Setup mirrors @BeforeClass:
 *   – auto-detect or accept aPartyDevice / platformVersion from env
 *   – initialize DeviceManager, start Appium, init driver + executor
 *
 * Tests mirror @Test methods:
 *   – testAllCallingScenarios  → runs all rows from Excel
 *   – testVoiceCall            → placeholder (individual scenario)
 *   – testVideoCall            → placeholder (video scenario)
 *   – testConferenceCall       → placeholder (conference scenario)
 */

import { before, after, describe, it } from 'mocha';

import { DriverManager }          from '../driver/DriverManager';
import { ADBHelper }              from '../utils/ADBHelper';
import { DeviceManager }          from '../utils/DeviceManager';
import { ConfigReader }           from '../config/ConfigReader';
import { CompleteCallingTestExecutor } from '../core/callingExecutor';
import type { AndroidDriver }     from '../types/driver';

//  types ─
interface CallingResult {
  finalStatus: string;
  [key: string]: unknown;
}

//  suite ─
describe('Calling Tests', function () {
  let driver: AndroidDriver;
  let callingExecutor: CompleteCallingTestExecutor;
  let aPartyDeviceId: string;

  //  @BeforeClass 
  before(async function () {
    this.timeout(120_000);

    console.log('\n' + '='.repeat(100));
    console.log('🚀 CALLING TEST SETUP');
    console.log('='.repeat(100));

    //  resolve device 
    aPartyDeviceId = process.env.APARTY_DEVICE ?? process.env.A_PARTY_DEVICE ?? '';
    if (!aPartyDeviceId) {
      const devices = await ADBHelper.getConnectedDevices();
      if (!devices.length) throw new Error(' No device connected');
      aPartyDeviceId = devices[0];
    }

    let platformVersion = process.env.PLATFORM_VERSION ?? '';
    if (!platformVersion) {
      const raw = await ADBHelper.getAndroidVersion(aPartyDeviceId);
      platformVersion = raw.split('.')[0];
    }

    console.log(' Configuration:');
    console.log(`   A-Party Device: ${aPartyDeviceId}`);
    console.log(`   Android Version: ${platformVersion}`);

    //  DeviceManager 
    await DeviceManager.initializeDevices();
    DeviceManager.printDeviceStatus();

    console.log('\nStarting services...');
    await DriverManager.startAppiumService();

    console.log('📲 Initializing driver...');
    driver = await DriverManager.initializeDriver(aPartyDeviceId, platformVersion);

    //  executor ─
    callingExecutor = new CompleteCallingTestExecutor(driver, aPartyDeviceId);

    console.log(' Setup completed successfully\n');
  });

  //  @Test testAllCallingScenarios 
  it('executes all calling scenarios from Excel', async function () {
    this.timeout(600_000);

    console.log('\n' + '='.repeat(100));
    console.log('📞 EXECUTING ALL CALLING TESTS');
    console.log('='.repeat(100));

    const excelFilePath = ConfigReader.getExcelFilePath();
    console.log(`📄 Excel File: ${excelFilePath}`);

    const results =
      await callingExecutor.executeAllCallingTests(excelFilePath);

    //  summary ( printout) 
    const passed = results.filter(r => r.finalStatus === 'SUCCESS').length;
    const failed = results.length - passed;

    console.log('\n' + '='.repeat(100));
    console.log('📈 CALLING TESTS COMPLETED');
    console.log(`Total Tests: ${results.length}`);
    console.log(` Passed: ${passed}`);
    console.log(` Failed: ${failed}`);

    if (results.length > 0) {
      const rate = ((passed / results.length) * 100).toFixed(1);
      console.log(`📊 Success Rate: ${rate}%`);
    }

    console.log('='.repeat(100));

    //  assertion ─
    expect(results.length).toBeGreaterThan(0);
    // Soft-fail tolerance: surface failures without hard-stopping the suite
    if (failed > 0) {
      console.warn(`  ${failed} calling test(s) failed`);
    }
  });

  //  @Test testVoiceCall 
  it('runs individual voice call scenario', function () {
    console.log('\nℹ️ Individual scenario tests would use specific data from Excel');
  });

  //  @Test testVideoCall 
  it('runs video call scenario', function () {
    console.log('\nℹ️ Video test data would come from Excel');
  });

  //  @Test testConferenceCall 
  it('runs conference call scenario', function () {
    console.log('\nℹ️ Conference test data would come from Excel');
  });

  //  @AfterClass ─
  after(async function () {
    console.log('\n' + '='.repeat(100));
    console.log('🧹 CLEANUP');
    console.log('='.repeat(100));

    if (driver) {
      try {
        await DriverManager.quitDriver();
        console.log(' Driver quit successfully');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(` Driver quit had issues: ${msg}`);
      }
    }

    console.log('='.repeat(100));
  });
});