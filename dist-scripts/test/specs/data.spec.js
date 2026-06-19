"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const DriverManager_1 = require("../driver/DriverManager");
const ADBHelper_1 = require("../utils/ADBHelper");
const ConfigReader_1 = require("../config/ConfigReader");
const dataExecutor_1 = require("../core/dataExecutor");
//  suite ─
(0, mocha_1.describe)('Data Usage Tests', function () {
    let driver;
    let deviceId;
    //  @BeforeClass setUp() ─
    (0, mocha_1.before)(async function () {
        var _a, _b;
        this.timeout(120000);
        console.log('🌐 Setting up Data Usage Test Environment...');
        await DriverManager_1.DriverManager.startAppiumService();
        deviceId = (_b = (_a = process.env.APARTY_DEVICE) !== null && _a !== void 0 ? _a : process.env.DEVICE_ID) !== null && _b !== void 0 ? _b : '';
        if (!deviceId) {
            const devices = await ADBHelper_1.ADBHelper.getConnectedDevices();
            if (!devices.length) {
                throw new Error('❌ No device connected');
            }
            deviceId = devices[0];
        }
        const androidVersion = await ADBHelper_1.ADBHelper.getAndroidVersion(deviceId);
        const majorVersion = androidVersion.split('.')[0];
        driver = await DriverManager_1.DriverManager.initializeDriver(deviceId, majorVersion);
        console.log(' Data Usage Test Environment Ready');
    });
    //  @Test executeDataUsageTests() ─
    (0, mocha_1.it)('executes data usage tests from Excel', async function () {
        this.timeout(600000); // 10 min — matches Java's open-ended test method
        try {
            console.log('\n🌐 EXECUTING DATA USAGE TESTS');
            console.log('='.repeat(80));
            const excelPath = ConfigReader_1.ConfigReader.getExcelFilePath();
            const executor = new dataExecutor_1.DataUsageTestExecutor(driver, deviceId);
            const results = await executor.executeDataUsageTests(excelPath);
            console.log('\n Data Usage Tests Completed');
            console.log(`   Total Tests: ${results.length}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`❌ Data usage test execution failed: ${message}`);
            throw err;
        }
    });
    //  @AfterClass tearDown() ─
    (0, mocha_1.after)(async function () {
        if (driver) {
            await DriverManager_1.DriverManager.quitDriver();
        }
        // Don't stop external Appium server ( comment)
        console.log('ℹ️  External Appium server remains running');
    });
});
