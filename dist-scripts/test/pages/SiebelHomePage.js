"use strict";
// test/pages/SiebelHomePage.ts (NEEDS UPDATE)
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiebelHomePage = void 0;
const globals_1 = require("@wdio/globals");
const SiebelHelper_1 = require("../utils/SiebelHelper");
class SiebelHomePage {
    async verifyHomePageLoaded() {
        console.log('🏠 Verifying Home page loaded...');
        try {
            await globals_1.browser.waitUntil(async () => {
                const homeTab = await (0, globals_1.$)('//*[@id="ui-id-126"]');
                return await homeTab.isDisplayed();
            }, { timeout: 30000, interval: 1000 });
            console.log('   ✅ Home page loaded successfully');
            return true;
        }
        catch (error) {
            console.log('   ❌ Home page not loaded');
            return false;
        }
    }
    async clickBillingAndAccountTab() {
        console.log('💰 Clicking Billing & Account tab...');
        try {
            const billingTab = await (0, globals_1.$)('//*[@id="ui-id-535"]');
            await billingTab.waitForClickable({ timeout: 15000 });
            await billingTab.click();
            await globals_1.browser.pause(3000);
            console.log('   ✅ Billing & Account tab clicked');
        }
        catch (error) {
            console.log('   ⚠️ Could not find Billing & Account tab, trying alternative...');
            await SiebelHelper_1.SiebelHelper.safeClick('//*[contains(text(), "Billing") or contains(text(), "Account")]');
        }
    }
    async getHomeTabText() {
        try {
            const homeTab = await (0, globals_1.$)('//*[@id="ui-id-126"]');
            return await homeTab.getText();
        }
        catch {
            return '';
        }
    }
}
exports.SiebelHomePage = SiebelHomePage;
