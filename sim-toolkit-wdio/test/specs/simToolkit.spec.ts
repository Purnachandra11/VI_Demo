import { SIMToolkitPage } from '../../src/pageobjects/SIMToolkitPage';
import { ScreenshotUtils } from '../../src/utils/ScreenshotUtils';
import { DeviceUtils } from '../../src/utils/DeviceUtils';
import * as ProgressReporter from '../../src/utils/ProgressReporter';

describe('Vi SIM Toolkit', () => {
    let screenshotUtils: ScreenshotUtils;
    let deviceUtils: DeviceUtils;
    let simToolkitPage: SIMToolkitPage;
    const deviceId = process.env.DEVICE_ID;

    before(() => {
        screenshotUtils = new ScreenshotUtils();
        screenshotUtils.setTestStartTime();
        deviceUtils = new DeviceUtils();
        simToolkitPage = new SIMToolkitPage(screenshotUtils, deviceId);

        if (deviceId) {
            ProgressReporter.initializeTestSuite(deviceId, 1);
        }
    });

    after(() => {
        screenshotUtils.setTestEndTime();
        screenshotUtils.generateScreenshotReport();
        screenshotUtils.printScreenshotSummary();
    });

    it('should launch SIM Toolkit, detect SIM scenario, and validate roaming menus', async () => {
        // Step 1: Launch SIM Toolkit
        const launched = await deviceUtils.launchSIMToolkit(deviceId);
        expect(launched).toBe(true);

        // Step 2: Detect & handle SIM scenario (single / dual mixed / dual Vi)
        await simToolkitPage.detectAndHandleSIMScenario();

        // Step 3: Flash option
        await simToolkitPage.navigateToFlashOption();

        // Step 4: Roaming option
        await simToolkitPage.navigateToRoamingOption();

        // Steps 5-6: Roaming sub-menus (Vodafone IN, International)
        await simToolkitPage.validateRoamingSubMenus();

        // Verify Vi branding is present
        const brandingVerified = await simToolkitPage.verifyViBranding();
        expect(brandingVerified).toBe(true);

        await simToolkitPage.completeSIMToolkitTest();

        if (deviceId) {
            await ProgressReporter.reportTestComplete(deviceId, 'SIM_Toolkit', true, 'SIM Toolkit test completed');
        }
    });
});
