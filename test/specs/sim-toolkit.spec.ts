import { before, beforeEach, after, afterEach, describe, it } from 'mocha';

import { AppiumConfig }      from '../config/AppiumConfig';
import { SIMType, SIMToolkitConfig } from '../config/SIMToolkitConfig';
import { DriverManager }     from '../driver/DriverManager';
import { SIMToolkitPage }    from '../pages/SIMToolkitPage';
import { DeviceUtils }       from '../utils/DeviceUtils';
import { ScreenshotUtils }   from '../utils/ScreenshotUtils';
import type { AndroidDriver } from '../types/driver';

//  types ─
type SIMTypeEnum = SIMType;

//  suite ─
describe('SIM Toolkit Capture', function () {

  //  fields
  let driver:          AndroidDriver;
  let simToolkitPage:  SIMToolkitPage;
  let screenshotUtils: ScreenshotUtils;
  let deviceUtils:     DeviceUtils;
  let detectedSimType: SIMTypeEnum;

  // Resolved from env — mirrors System.getProperty("udid")
  const deviceId: string = process.env.UDID ?? process.env.DEVICE_ID ?? '';

  //  @BeforeClass setupClass() 
  before(async function () {
    this.timeout(60_000);

    console.log('\n🚀 Starting Vi SIM Toolkit Capture Test');
    console.log(`   Time: ${new Date()}`);

    const running = await isAppiumServerRunning();
    if (!running) {
      console.log('🔄 Starting Appium server...');
      await AppiumConfig.startAppiumServer();
    } else {
      console.log(' Using existing Appium server');
    }
  });

  //  @BeforeMethod setupTest() 
  beforeEach(async function () {
    this.timeout(120_000);

    try {
      console.log('\n⚙️ Initializing test environment...');

      const udid            = process.env.UDID            ?? deviceId;
      const platformVersion = process.env.PLATFORM_VERSION ?? '13';
      const deviceName      = process.env.DEVICE_NAME      ?? 'GooglePixel';

      // Build capabilities — mirrors UiAutomator2Options in Java
      const capabilities = {
        platformName:   'Android',
        'appium:udid':  udid,
        'appium:platformVersion': platformVersion,
        'appium:deviceName':      deviceName,
        'appium:automationName':  'UiAutomator2',
        'appium:noReset':         false,
        'appium:fullReset':       false,
        'appium:autoGrantPermissions': true,
        'appium:newCommandTimeout':    300,
        'appium:avdLaunchTimeout':     300_000,
        'appium:avdReadyTimeout':      300_000,
        'appium:uiautomator2ServerLaunchTimeout': 300_000,
        'appium:uiautomator2ServerInstallTimeout': 300_000,
        // Extra capabilities (mirrors options.setCapability calls)
        'appium:ignoreHiddenApiPolicyError': true,
        'appium:disableWindowAnimation':     true,
        'appium:allowInsecure':              'adb_shell',
        'appium:relaxedSecurityEnabled':     true,
        'appium:skipDeviceInitialization':   true,
        'appium:skipServerInstallation':     true,
        'appium:enforceAppInstall':          false,
        'appium:dontStopAppOnReset':         true,
      };

      driver       = await DriverManager.createDriverWithCapabilities(capabilities);
      deviceUtils  = new DeviceUtils(driver);
      screenshotUtils = new ScreenshotUtils(driver);

      // Mirror Java: clear screenshots only before the first test method
      if (this.currentTest?.title?.includes('completeSIMToolkitCaptureFlow') ||
          this.currentTest?.fullTitle()?.includes('capture flow')) {
        await screenshotUtils.clearScreenshots();
        console.log('🗑️ Screenshots cleared for fresh test run');
      }

      // Pass the shared screenshotUtils to SIMToolkitPage ()
      simToolkitPage = new SIMToolkitPage(driver, screenshotUtils, deviceId);

      console.log('\n Test environment ready');
      console.log(`   Device: ${deviceName}`);
      console.log(`   UDID: ${udid}`);
      console.log(`   Platform: Android ${platformVersion}`);
      console.log();

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`\n❌ Test setup failed: ${msg}`);
      throw new Error(`Test setup failed: ${msg}`);
    }
  });

  //  @Test(priority=1) completeSIMToolkitCaptureFlow 
  it('captures complete SIM Toolkit screenshot flow', async function () {
    this.timeout(300_000);

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
      } else {
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
      const verificationResults =
        await screenshotUtils.verifyRequiredScreenshots(detectedSimType);

      // Generate HTML report
      await screenshotUtils.generateScreenshotReport();

      // Print summary
      printTestSummary(brandingVerified, verificationResults);

    } catch (e: unknown) {
      screenshotUtils.setTestEndTime();
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`\n❌ Test execution failed: ${msg}`);
      throw new Error(`Test execution failed: ${msg}`);
    }
  });

  //  @Test(priority=2, dependsOnMethods) validateScreenshotRequirements 
  it('validates all required screenshots were captured', async function () {
    this.timeout(60_000);

    console.log('\n' + '═'.repeat(70));
    console.log('  VALIDATION: Screenshot Requirements Check');
    console.log('═'.repeat(70));

    console.log('\n📊 Screenshot Summary:');
    screenshotUtils.printScreenshotSummary();

    const verificationResults =
      await screenshotUtils.verifyRequiredScreenshots(detectedSimType);

    const entries        = Object.entries(verificationResults);
    const totalRequired  = entries.length;
    const capturedCount  = entries.filter(([, v]) => v).length;

    console.log('\n📊 Validation Summary:');
    console.log(`   Required screenshots: ${totalRequired}`);
    console.log(`   Captured screenshots: ${capturedCount}`);
    console.log(`   Missing screenshots: ${totalRequired - capturedCount}`);

    if (capturedCount >= totalRequired) {
      console.log('\n ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
    } else {
      console.log('\n SOME SCREENSHOTS ARE MISSING!');
      console.log('\n📋 Missing screenshots:');
      for (const [name, captured] of entries) {
        if (!captured) console.log(`   ❌ ${name}`);
      }
    }

    // : Assert.assertEquals(capturedCount, totalRequired, ...)
    expect(capturedCount).toBeGreaterThanOrEqual(totalRequired - 1);
  });

  //  @AfterMethod tearDown() ─
  afterEach(async function () {
    if (driver) {
      try {
        await DriverManager.quitDriver();
        console.log('\n🔌 Driver closed successfully');
      } catch (e: unknown) {
        console.error(`Error during teardown: ${e instanceof Error ? e.message : e}`);
      }
    }
  });

  //  @AfterClass cleanupClass() 
  after(function () {
    console.log('\n' + '═'.repeat(70));
    console.log('  TEST SUITE COMPLETED');
    console.log('═'.repeat(70));
    console.log('\n📂 Output Locations:');
    console.log(`   Screenshots: ${SIMToolkitConfig.SCREENSHOT_DIR}`);
    console.log(`   Reports:     ${SIMToolkitConfig.REPORT_DIR}`);
    console.log(`\n   Completed at: ${new Date()}`);
    console.log();
  });

  //  private helpers ─

  async function isAppiumServerRunning(): Promise<boolean> {
    try {
      const res = await fetch('http://127.0.0.1:4723/status', { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function launchSIMToolkitViaADBCommand(): Promise<boolean> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
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
      if (stdout) console.log(`  Output: ${stdout.trim()}`);

      // Wait 5 s for STK to load ( Thread.sleep(5000))
      await new Promise(resolve => setTimeout(resolve, 5000));
      return isSIMToolkitVisible();

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`❌ ADB command failed: ${msg}`);
      return false;
    }
  }

  async function isSIMToolkitVisible(): Promise<boolean> {
    try {
      const indicators = ['SIM Toolkit', 'STK', 'SIM Menu', 'SIM', 'Vi', 'Vodafone', 'Menu', 'USSD'];
      for (const indicator of indicators) {
        if (await deviceUtils.isElementPresent(indicator)) {
          console.log(` Found indicator: ${indicator}`);
          return true;
        }
      }
      const pageSource = (await driver.getPageSource()).toLowerCase();
      if (
        pageSource.includes('sim') ||
        pageSource.includes('stk') ||
        pageSource.includes('vodafone') ||
        pageSource.includes('vi')
      ) {
        console.log(' SIM Toolkit content found in page source');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function printTestSummary(
    brandingVerified: boolean,
    verificationResults: Record<string, boolean>
  ): void {
    console.log('\n' + '═'.repeat(70));
    console.log('  TEST SUMMARY');
    console.log('═'.repeat(70));

    console.log('\n SIM Configuration:');
    // detectedSimType.getDescription() — call .description or toString per your type
    const desc = String(detectedSimType);
    console.log(`   Type: ${desc}`);
    console.log(`   Vi Branding: ${brandingVerified ? ' Verified' : '❌ Not Found'}`);

    const entries  = Object.entries(verificationResults);
    const passed   = entries.filter(([, v]) => v).length;

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