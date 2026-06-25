"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const path_1 = __importDefault(require("path"));
const ADBHelper_1 = require("../utils/ADBHelper");
const simLatchExecutor_1 = require("../core/simLatchExecutor");
//  suite ─
(0, mocha_1.describe)('SIM Auto-Latch Tests', function () {
    let aPartyDeviceId;
    let bPartyDeviceId;
    let aPartyNumber;
    let bPartyNumber;
    //  @BeforeClass 
    (0, mocha_1.before)(async function () {
        var _a, _b, _c;
        this.timeout(60000);
        console.log('\n' + '='.repeat(100));
        console.log('📡 SIM AUTO-LATCH TEST SUITE SETUP');
        console.log('='.repeat(100));
        //  resolve params ( System.getProperty) 
        aPartyDeviceId = (_a = process.env.A_PARTY_DEVICE) !== null && _a !== void 0 ? _a : '';
        bPartyDeviceId = process.env.B_PARTY_DEVICE;
        aPartyNumber = (_b = process.env.A_PARTY_NUMBER) !== null && _b !== void 0 ? _b : '8696904544'; // Java default
        bPartyNumber = (_c = process.env.B_PARTY_NUMBER) !== null && _c !== void 0 ? _c : '9773328866'; // Java default
        //  auto-detect devices if not provided ─
        if (!aPartyDeviceId) {
            const devices = await ADBHelper_1.ADBHelper.getConnectedDevices();
            if (!devices.length)
                throw new Error('❌ No device connected');
            aPartyDeviceId = devices[0];
            if (devices.length > 1) {
                bPartyDeviceId = devices[1];
            }
        }
        console.log(' Configuration:');
        console.log(`   A-Party Device: ${aPartyDeviceId}`);
        console.log(`   A-Party Number: ${aPartyNumber}`);
        console.log(`   B-Party Device: ${bPartyDeviceId !== null && bPartyDeviceId !== void 0 ? bPartyDeviceId : '(not provided)'}`);
        console.log(`   B-Party Number: ${bPartyNumber}`);
        console.log(' Setup completed successfully\n');
    });
    //  @Test executeSIMAutoLatchTests ─
    (0, mocha_1.it)('executes all SIM auto-latch tests from Excel', async function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        this.timeout(600000);
        console.log('\n' + '='.repeat(100));
        console.log('📡 EXECUTING SIM AUTO-LATCH TESTS');
        console.log('='.repeat(100));
        // Java uses hardcoded path — mirror that here
        const excelFilePath = path_1.default.resolve('src/test/resources/contacts.xlsx');
        console.log(`📄 Excel File: ${excelFilePath}`);
        const executor = new simLatchExecutor_1.SIMAutoLatchTestExecutor(aPartyDeviceId, bPartyDeviceId !== null && bPartyDeviceId !== void 0 ? bPartyDeviceId : '', aPartyNumber, bPartyNumber);
        const results = await executor.executeAllSIMAutoLatchTests(excelFilePath);
        //  summary 
        const passed = results.filter(r => r.testResult === 'PASS').length;
        const marginal = results.filter(r => r.testResult === 'MARGINAL').length;
        const slow = results.filter(r => r.testResult === 'SLOW').length;
        const failed = results.filter(r => r.testResult === 'FAIL' || r.testResult === 'ERROR').length;
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
        console.log('Device ID\tParty Number\tTimeout(s)\tInitial Network\tFinal Network\t' +
            'Auto-Latch Time(ms)\tAuto-Latch Time(s)\tTest Result\tTransitions\t' +
            'IMS Registered\tisRoaming\tComments');
        console.log('-'.repeat(120));
        const sample = results.slice(0, 3);
        for (const r of sample) {
            console.log([
                (_a = r.deviceId) !== null && _a !== void 0 ? _a : '',
                (_b = r.partyNumber) !== null && _b !== void 0 ? _b : '',
                (_c = r.timeoutSeconds) !== null && _c !== void 0 ? _c : '',
                (_d = r.initialNetworkState) !== null && _d !== void 0 ? _d : '',
                (_e = r.finalNetworkState) !== null && _e !== void 0 ? _e : '',
                (_f = r.autoLatchTimeMs) !== null && _f !== void 0 ? _f : '',
                (_g = r.autoLatchTimeSeconds) !== null && _g !== void 0 ? _g : '',
                (_h = r.testResult) !== null && _h !== void 0 ? _h : '',
                (_j = r.transitions) !== null && _j !== void 0 ? _j : '',
                (_k = r.finalIMSRegistered) !== null && _k !== void 0 ? _k : '',
                'TRUE', // placeholder for roaming status
                (_l = r.comments) !== null && _l !== void 0 ? _l : '',
            ].join('\t'));
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
    (0, mocha_1.after)(function () {
        console.log('\n' + '='.repeat(100));
        console.log('🧹 CLEANUP');
        console.log('='.repeat(100));
        console.log(' Test execution completed');
    });
});
//  mini AssertionError shim ( throw new AssertionError) ─
class AssertionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssertionError';
    }
}
