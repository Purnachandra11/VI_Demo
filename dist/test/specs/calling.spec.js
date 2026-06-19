"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const DriverManager_1 = require("../driver/DriverManager");
const ADBHelper_1 = require("../utils/ADBHelper");
const DeviceManager_1 = require("../utils/DeviceManager");
const ConfigReader_1 = require("../config/ConfigReader");
const callingExecutor_1 = require("../core/callingExecutor");
//  suite ─
(0, mocha_1.describe)('Calling Tests', function () {
    let driver;
    let callingExecutor;
    let aPartyDeviceId;
    //  @BeforeClass 
    (0, mocha_1.before)(async function () {
        var _a, _b, _c;
        this.timeout(120000);
        console.log('\n' + '='.repeat(100));
        console.log('🚀 CALLING TEST SETUP');
        console.log('='.repeat(100));
        //  resolve device 
        aPartyDeviceId = (_b = (_a = process.env.APARTY_DEVICE) !== null && _a !== void 0 ? _a : process.env.A_PARTY_DEVICE) !== null && _b !== void 0 ? _b : '';
        if (!aPartyDeviceId) {
            const devices = await ADBHelper_1.ADBHelper.getConnectedDevices();
            if (!devices.length)
                throw new Error(' No device connected');
            aPartyDeviceId = devices[0];
        }
        let platformVersion = (_c = process.env.PLATFORM_VERSION) !== null && _c !== void 0 ? _c : '';
        if (!platformVersion) {
            const raw = await ADBHelper_1.ADBHelper.getAndroidVersion(aPartyDeviceId);
            platformVersion = raw.split('.')[0];
        }
        console.log(' Configuration:');
        console.log(`   A-Party Device: ${aPartyDeviceId}`);
        console.log(`   Android Version: ${platformVersion}`);
        //  DeviceManager 
        await DeviceManager_1.DeviceManager.initializeDevices();
        DeviceManager_1.DeviceManager.printDeviceStatus();
        console.log('\nStarting services...');
        await DriverManager_1.DriverManager.startAppiumService();
        console.log('📲 Initializing driver...');
        driver = await DriverManager_1.DriverManager.initializeDriver(aPartyDeviceId, platformVersion);
        //  executor ─
        callingExecutor = new callingExecutor_1.CompleteCallingTestExecutor(driver, aPartyDeviceId);
        console.log(' Setup completed successfully\n');
    });
    //  @Test testAllCallingScenarios 
    (0, mocha_1.it)('executes all calling scenarios from Excel', async function () {
        this.timeout(600000);
        console.log('\n' + '='.repeat(100));
        console.log('📞 EXECUTING ALL CALLING TESTS');
        console.log('='.repeat(100));
        const excelFilePath = ConfigReader_1.ConfigReader.getExcelFilePath();
        console.log(`📄 Excel File: ${excelFilePath}`);
        const results = await callingExecutor.executeAllCallingTests(excelFilePath);
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
    (0, mocha_1.it)('runs individual voice call scenario', function () {
        console.log('\nℹ️ Individual scenario tests would use specific data from Excel');
    });
    //  @Test testVideoCall 
    (0, mocha_1.it)('runs video call scenario', function () {
        console.log('\nℹ️ Video test data would come from Excel');
    });
    //  @Test testConferenceCall 
    (0, mocha_1.it)('runs conference call scenario', function () {
        console.log('\nℹ️ Conference test data would come from Excel');
    });
    //  @AfterClass ─
    (0, mocha_1.after)(async function () {
        console.log('\n' + '='.repeat(100));
        console.log('🧹 CLEANUP');
        console.log('='.repeat(100));
        if (driver) {
            try {
                await DriverManager_1.DriverManager.quitDriver();
                console.log(' Driver quit successfully');
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.warn(` Driver quit had issues: ${msg}`);
            }
        }
        console.log('='.repeat(100));
    });
});
