/**
 * data.spec.ts
 * Mirrors: DataUsageTest.java (DataUsageTestExecutor)
 *
 * Setup mirrors @BeforeClass setUp():
 *   – start Appium → auto-detect or accept DEVICE_ID from env
 *   – ADBHelper.getAndroidVersion → initializeDriver
 *
 * Test mirrors @Test executeDataUsageTests():
 *   – DataUsageTestExecutor.executeDataUsageTests(excelPath)
 *   – print result count
 *
 * Teardown mirrors @AfterClass tearDown():
 *   – quitDriver, leave external Appium server running
 */

import { before, after, describe, it } from 'mocha';

import { DriverManager }        from '../driver/DriverManager';
import { ADBHelper }            from '../utils/ADBHelper';
import { ConfigReader }         from '../config/ConfigReader';
import { DataUsageTestExecutor } from '../core/dataExecutor';
import type { AndroidDriver }   from '../types/driver';

//  suite ─
describe('Data Usage Tests', function () {
  let driver: AndroidDriver;
  let deviceId: string;

  //  @BeforeClass setUp() ─
  before(async function () {
    this.timeout(120_000);

    console.log('🌐 Setting up Data Usage Test Environment...');

    await DriverManager.startAppiumService();

    deviceId = process.env.APARTY_DEVICE ?? process.env.DEVICE_ID ?? '';
    if (!deviceId) {
      const devices = await ADBHelper.getConnectedDevices();
      if (!devices.length) {
        throw new Error('❌ No device connected');
      }
      deviceId = devices[0];
    }

    const androidVersion = await ADBHelper.getAndroidVersion(deviceId);
    const majorVersion   = androidVersion.split('.')[0];

    driver = await DriverManager.initializeDriver(deviceId, majorVersion);

    console.log(' Data Usage Test Environment Ready');
  });

  //  @Test executeDataUsageTests() ─
  it('executes data usage tests from Excel', async function () {
    this.timeout(600_000); // 10 min — matches Java's open-ended test method

    try {
      console.log('\n🌐 EXECUTING DATA USAGE TESTS');
      console.log('='.repeat(80));

      const excelPath = ConfigReader.getExcelFilePath();

      const executor = new DataUsageTestExecutor(driver, deviceId);
      const results  = await executor.executeDataUsageTests(excelPath);

      console.log('\n Data Usage Tests Completed');
      console.log(`   Total Tests: ${results.length}`);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`❌ Data usage test execution failed: ${message}`);
      throw err;
    }
  });

  //  @AfterClass tearDown() ─
  after(async function () {
    if (driver) {
      await DriverManager.quitDriver();
    }
    // Don't stop external Appium server ( comment)
    console.log('ℹ️  External Appium server remains running');
  });
});