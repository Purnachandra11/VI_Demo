"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePage = void 0;
/**  com.telecom.core.BasePage */
class BasePage {
    constructor(driver, screenshotUtils) {
        this.driver = driver;
        this.screenshotUtils = screenshotUtils;
        this.waitTimeoutMs = 30000;
    }
    async click(selector, screenshotName) {
        const el = await this.driver.$(selector);
        await el.waitForDisplayed({ timeout: this.waitTimeoutMs });
        await el.click();
        await this.driver.pause(1500);
        if (screenshotName && this.screenshotUtils) {
            await this.screenshotUtils.captureScreenshot(screenshotName);
        }
    }
    async isDisplayed(selector) {
        try {
            const el = await this.driver.$(selector);
            return await el.isDisplayed();
        }
        catch {
            return false;
        }
    }
    async getText(selector) {
        try {
            const el = await this.driver.$(selector);
            await el.waitForDisplayed({ timeout: this.waitTimeoutMs });
            return await el.getText();
        }
        catch {
            return null;
        }
    }
}
exports.BasePage = BasePage;
