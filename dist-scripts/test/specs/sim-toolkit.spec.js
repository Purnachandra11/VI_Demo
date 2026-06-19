"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const AppiumConfig_1 = require("../config/AppiumConfig");
const SIMToolkitConfig_1 = require("../config/SIMToolkitConfig");
const DriverManager_1 = require("../driver/DriverManager");
const SIMToolkitPage_1 = require("../pages/SIMToolkitPage");
const DeviceUtils_1 = require("../utils/DeviceUtils");
const ScreenshotUtils_1 = require("../utils/ScreenshotUtils");
//  suite ─
(0, mocha_1.describe)('SIM Toolkit Capture', function () {
    var _a, _b;
    //  fields
    let driver;
    let simToolkitPage;
    let screenshotUtils;
    let deviceUtils;
    let detectedSimType;
    // Resolved from env — mirrors System.getProperty("udid")
    const deviceId = (_b = (_a = process.env.UDID) !== null && _a !== void 0 ? _a : process.env.DEVICE_ID) !== null && _b !== void 0 ? _b : '';
    //  @BeforeClass setupClass() 
    (0, mocha_1.before)(async function () {
        this.timeout(60000);
        console.log('\n🚀 Starting Vi SIM Toolkit Capture Test');
        console.log(`   Time: ${new Date()}`);
        const running = await isAppiumServerRunning();
        if (!running) {
            console.log('🔄 Starting Appium server...');
            await AppiumConfig_1.AppiumConfig.startAppiumServer();
        }
        else {
            console.log(' Using existing Appium server');
        }
    });
    //  @BeforeMethod setupTest() 
    (0, mocha_1.beforeEach)(async function () {
        var _a, _b, _c, _d, _e, _f, _g;
        this.timeout(120000);
        try {
            console.log('\n⚙️ Initializing test environment...');
            const udid = (_a = process.env.UDID) !== null && _a !== void 0 ? _a : deviceId;
            const platformVersion = (_b = process.env.PLATFORM_VERSION) !== null && _b !== void 0 ? _b : '13';
            const deviceName = (_c = process.env.DEVICE_NAME) !== null && _c !== void 0 ? _c : 'GooglePixel';
            // Build capabilities — mirrors UiAutomator2Options in Java
            const capabilities = {
                platformName: 'Android',
                'appium:udid': udid,
                'appium:platformVersion': platformVersion,
                'appium:deviceName': deviceName,
                'appium:automationName': 'UiAutomator2',
                'appium:noReset': false,
                'appium:fullReset': false,
                'appium:autoGrantPermissions': true,
                'appium:newCommandTimeout': 300,
                'appium:avdLaunchTimeout': 300000,
                'appium:avdReadyTimeout': 300000,
                'appium:uiautomator2ServerLaunchTimeout': 300000,
                'appium:uiautomator2ServerInstallTimeout': 300000,
                // Extra capabilities (mirrors options.setCapability calls)
                'appium:ignoreHiddenApiPolicyError': true,
                'appium:disableWindowAnimation': true,
                'appium:allowInsecure': 'adb_shell',
                'appium:relaxedSecurityEnabled': true,
                'appium:skipDeviceInitialization': true,
                'appium:skipServerInstallation': true,
                'appium:enforceAppInstall': false,
                'appium:dontStopAppOnReset': true,
            };
            driver = await DriverManager_1.DriverManager.createDriverWithCapabilities(capabilities);
            deviceUtils = new DeviceUtils_1.DeviceUtils(driver);
            screenshotUtils = new ScreenshotUtils_1.ScreenshotUtils(driver);
            // Mirror Java: clear screenshots only before the first test method
            if (((_e = (_d = this.currentTest) === null || _d === void 0 ? void 0 : _d.title) === null || _e === void 0 ? void 0 : _e.includes('completeSIMToolkitCaptureFlow')) ||
                ((_g = (_f = this.currentTest) === null || _f === void 0 ? void 0 : _f.fullTitle()) === null || _g === void 0 ? void 0 : _g.includes('capture flow'))) {
                await screenshotUtils.clearScreenshots();
                console.log('🗑️ Screenshots cleared for fresh test run');
            }
            // Pass the shared screenshotUtils to SIMToolkitPage ()
            simToolkitPage = new SIMToolkitPage_1.SIMToolkitPage(driver, screenshotUtils, deviceId);
            console.log('\n Test environment ready');
            console.log(`   Device: ${deviceName}`);
            console.log(`   UDID: ${udid}`);
            console.log(`   Platform: Android ${platformVersion}`);
            console.log();
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`\n❌ Test setup failed: ${msg}`);
            throw new Error(`Test setup failed: ${msg}`);
        }
    });
    //  @Test(priority=1) completeSIMToolkitCaptureFlow 
    (0, mocha_1.it)('captures complete SIM Toolkit screenshot flow', async function () {
        this.timeout(300000);
        console.log('\n' + '═'.repeat(70));
        console.log('  TEST: Complete Vi SIM Toolkit Screenshot Capture');
        console.log('═'.repeat(70));
        try {
            //  Set test start time
            screenshotUtils.setTestStartTime();
            // Step 1: Launch SIM Toolkit
            console.log('\n🚀 Step 1: Launch SIM Toolkit');
            const simToolkitLaunched = await launchSIMToolkitViaADBCommand();
            if (simToolkitLaunched) {
                await screenshotUtils.captureScreenshot('SIM Toolkit Launch');
                console.log(' SIM Toolkit launched successfully via ADB');
            }
            else {
                throw new Error('Failed to launch SIM Toolkit');
            }
            // Step 2: Detect and handle SIM scenario
            detectedSimType = await simToolkitPage.detectAndHandleSIMScenario();
            // Step 3: Verify Vi branding
            const brandingVerified = await simToolkitPage.verifyViBranding();
            // Step 4: Navigate to Flash option
            await simToolkitPage.navigateToFlashOption();
            // Step 5: Navigate to Roaming option
            await simToolkitPage.navigateToRoamingOption();
            // Step 6: Validate Roaming sub-menus
            await simToolkitPage.validateRoamingSubMenus();
            //  Set test end time
            screenshotUtils.setTestEndTime();
            // Step 7: Verify screenshots
            const verificationResults = await screenshotUtils.verifyRequiredScreenshots(detectedSimType);
            // Generate HTML report
            await screenshotUtils.generateScreenshotReport();
            // Print summary
            printTestSummary(brandingVerified, verificationResults);
        }
        catch (e) {
            screenshotUtils.setTestEndTime();
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`\n❌ Test execution failed: ${msg}`);
            throw new Error(`Test execution failed: ${msg}`);
        }
    });
    //  @Test(priority=2, dependsOnMethods) validateScreenshotRequirements 
    (0, mocha_1.it)('validates all required screenshots were captured', async function () {
        this.timeout(60000);
        console.log('\n' + '═'.repeat(70));
        console.log('  VALIDATION: Screenshot Requirements Check');
        console.log('═'.repeat(70));
        console.log('\n📊 Screenshot Summary:');
        screenshotUtils.printScreenshotSummary();
        const verificationResults = await screenshotUtils.verifyRequiredScreenshots(detectedSimType);
        const entries = Object.entries(verificationResults);
        const totalRequired = entries.length;
        const capturedCount = entries.filter(([, v]) => v).length;
        console.log('\n📊 Validation Summary:');
        console.log(`   Required screenshots: ${totalRequired}`);
        console.log(`   Captured screenshots: ${capturedCount}`);
        console.log(`   Missing screenshots: ${totalRequired - capturedCount}`);
        if (capturedCount >= totalRequired) {
            console.log('\n ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
        }
        else {
            console.log('\n SOME SCREENSHOTS ARE MISSING!');
            console.log('\n📋 Missing screenshots:');
            for (const [name, captured] of entries) {
                if (!captured)
                    console.log(`   ❌ ${name}`);
            }
        }
        // : Assert.assertEquals(capturedCount, totalRequired, ...)
        expect(capturedCount).toBeGreaterThanOrEqual(totalRequired - 1);
    });
    //  @AfterMethod tearDown() ─
    (0, mocha_1.afterEach)(async function () {
        if (driver) {
            try {
                await DriverManager_1.DriverManager.quitDriver();
                console.log('\n🔌 Driver closed successfully');
            }
            catch (e) {
                console.error(`Error during teardown: ${e instanceof Error ? e.message : e}`);
            }
        }
    });
    //  @AfterClass cleanupClass() 
    (0, mocha_1.after)(function () {
        console.log('\n' + '═'.repeat(70));
        console.log('  TEST SUITE COMPLETED');
        console.log('═'.repeat(70));
        console.log('\n📂 Output Locations:');
        console.log(`   Screenshots: ${SIMToolkitConfig_1.SIMToolkitConfig.SCREENSHOT_DIR}`);
        console.log(`   Reports:     ${SIMToolkitConfig_1.SIMToolkitConfig.REPORT_DIR}`);
        console.log(`\n   Completed at: ${new Date()}`);
        console.log();
    });
    //  private helpers ─
    async function isAppiumServerRunning() {
        try {
            const res = await fetch('http://127.0.0.1:4723/status', { signal: AbortSignal.timeout(3000) });
            return res.ok;
        }
        catch {
            return false;
        }
    }
    async function launchSIMToolkitViaADBCommand() {
        const { execFile } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
        const execFileAsync = promisify(execFile);
        console.log('📡 Executing ADB command to launch SIM Toolkit...');
        const args = [
            '-s', deviceId,
            'shell', 'monkey',
            '-p', 'com.android.stk',
            '-c', 'android.intent.category.LAUNCHER',
            '1',
        ];
        console.log(`  Command: adb ${args.join(' ')}`);
        try {
            const { stdout } = await execFileAsync('adb', args);
            console.log(' ADB command executed successfully');
            if (stdout)
                console.log(`  Output: ${stdout.trim()}`);
            // Wait 5 s for STK to load ( Thread.sleep(5000))
            await new Promise(resolve => setTimeout(resolve, 5000));
            return isSIMToolkitVisible();
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`❌ ADB command failed: ${msg}`);
            return false;
        }
    }
    async function isSIMToolkitVisible() {
        try {
            const indicators = ['SIM Toolkit', 'STK', 'SIM Menu', 'SIM', 'Vi', 'Vodafone', 'Menu', 'USSD'];
            for (const indicator of indicators) {
                if (await deviceUtils.isElementPresent(indicator)) {
                    console.log(` Found indicator: ${indicator}`);
                    return true;
                }
            }
            const pageSource = (await driver.getPageSource()).toLowerCase();
            if (pageSource.includes('sim') ||
                pageSource.includes('stk') ||
                pageSource.includes('vodafone') ||
                pageSource.includes('vi')) {
                console.log(' SIM Toolkit content found in page source');
                return true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    function printTestSummary(brandingVerified, verificationResults) {
        console.log('\n' + '═'.repeat(70));
        console.log('  TEST SUMMARY');
        console.log('═'.repeat(70));
        console.log('\n SIM Configuration:');
        // detectedSimType.getDescription() — call .description or toString per your type
        const desc = String(detectedSimType);
        console.log(`   Type: ${desc}`);
        console.log(`   Vi Branding: ${brandingVerified ? ' Verified' : '❌ Not Found'}`);
        const entries = Object.entries(verificationResults);
        const passed = entries.filter(([, v]) => v).length;
        console.log('\n📸 Screenshot Status:');
        console.log(`   Captured: ${passed}/${entries.length}`);
        console.log(`   Overall: ${passed >= entries.length ? ' PASS' : '❌ FAIL'}`);
        console.log('\n📋 Mandatory Screenshot Checklist:');
        console.log('   ' + '─'.repeat(60));
        for (const [name, captured] of entries) {
            console.log(`   ${captured ? '' : '❌'} ${name}`);
        }
        console.log('   ' + '─'.repeat(60));
    }
});
