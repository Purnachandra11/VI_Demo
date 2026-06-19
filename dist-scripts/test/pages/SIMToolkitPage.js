"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIMToolkitPage = void 0;
const SIMToolkitConfig_1 = require("../config/SIMToolkitConfig");
const DeviceUtils_1 = require("../utils/DeviceUtils");
const progressReporter_1 = require("../utils/progressReporter");
class SIMToolkitPage {
    constructor(driver, screenshotUtils, deviceId) {
        this.driver = driver;
        this.screenshotUtils = screenshotUtils;
        this.deviceId = deviceId;
        this.deviceUtils = new DeviceUtils_1.DeviceUtils(driver);
    }
    async detectAndHandleSIMScenario() {
        console.log('┌─ Step 2: Detect & Handle SIM Scenario');
        await this.reportProgress('STARTED', 'Starting SIM Toolkit detection', 10);
        const simType = await this.deviceUtils.detectSIMType();
        console.log(`  Detected: ${simType}`);
        await this.captureScreenshot('Vi Menu Home');
        await this.reportProgress('COMPLETED', 'SIM scenario handled', 40);
        return simType;
    }
    async navigateToFlashOption() {
        console.log('  → Navigate to Flash');
        await this.clickByText(SIMToolkitConfig_1.FLASH_OPTION);
        await this.captureScreenshot('Flash Option');
        await this.deviceUtils.navigateBack();
    }
    async navigateToRoamingOption() {
        console.log('  → Navigate to Roaming');
        await this.clickByText(SIMToolkitConfig_1.ROAMING_OPTION);
        await this.captureScreenshot('Roaming Option');
    }
    async validateRoamingSubMenus() {
        await this.clickByText(SIMToolkitConfig_1.VODAFONE_IN_OPTION);
        await this.captureScreenshot('Vodafone IN');
        await this.deviceUtils.navigateBack();
        await this.clickByText(SIMToolkitConfig_1.INTERNATIONAL_OPTION);
        await this.captureScreenshot('International Roaming');
        await this.deviceUtils.navigateBack();
        await this.deviceUtils.navigateBack();
    }
    async verifyViBranding() {
        for (const text of SIMToolkitConfig_1.VI_BRANDING_TEXTS) {
            if (await this.deviceUtils.isElementPresent(text)) {
                await this.captureScreenshot('Vi Branding Verified');
                return true;
            }
        }
        return false;
    }
    async completeSIMToolkitTest() {
        await this.detectAndHandleSIMScenario();
        await this.verifyViBranding();
        await this.navigateToFlashOption();
        await this.navigateToRoamingOption();
        await this.validateRoamingSubMenus();
    }
    async captureScreenshot(stepName) {
        await this.screenshotUtils.captureScreenshot(stepName);
    }
    async clickByText(text) {
        const el = await this.driver.$(`//*[contains(@text, "${text}")]`);
        await el.waitForDisplayed({ timeout: 15000 });
        await el.click();
        await this.driver.pause(1000);
    }
    async reportProgress(action, status, pct) {
        await (0, progressReporter_1.reportSIMLatchProgress)(this.deviceId, action, status, pct);
    }
}
exports.SIMToolkitPage = SIMToolkitPage;
