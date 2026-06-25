"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceUtils = void 0;
const SIMToolkitConfig_1 = require("../config/SIMToolkitConfig");
/**  DeviceUtils */
class DeviceUtils {
    constructor(driver) {
        this.driver = driver;
    }
    async detectSIMType() {
        try {
            const source = (await this.driver.getPageSource()).toLowerCase();
            const viCount = (source.match(/vi|vodafone/g) || []).length;
            if (viCount >= 2)
                return SIMToolkitConfig_1.SIMType.DUAL_SIM_VI;
            if (source.includes('sim') && viCount >= 1)
                return SIMToolkitConfig_1.SIMType.DUAL_SIM_MIXED;
        }
        catch {
            /* fallback */
        }
        return SIMToolkitConfig_1.SIMType.SINGLE_SIM;
    }
    async isElementPresent(text) {
        try {
            const el = await this.driver.$(`//*[contains(@text, "${text}")]`);
            return await el.isDisplayed();
        }
        catch {
            return false;
        }
    }
    async navigateBack() {
        try {
            await this.driver.back();
        }
        catch {
            await this.driver.pressKeyCode(4);
        }
        await this.driver.pause(500);
    }
    async launchApp(appPackage, appActivity) {
        await this.driver.execute('mobile: shell', {
            command: 'am',
            args: ['start', '-n', `${appPackage}/${appActivity}`]
        });
    }
}
exports.DeviceUtils = DeviceUtils;
