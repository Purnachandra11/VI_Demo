"use strict";
// test/pages/AccountSummaryPage.ts (NEEDS UPDATE - add more validation methods)
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountSummaryPage = void 0;
const globals_1 = require("@wdio/globals");
const SiebelSelectors_1 = require("../utils/SiebelSelectors");
class AccountSummaryPage {
    async getAccountDetails() {
        await globals_1.browser.pause(2000);
        const mobileNumber = await this.getMobileNumber();
        const planType = await this.getPlanType();
        const circleName = await this.getCircleName();
        const customerName = await this.getCustomerName();
        const accountNumber = await this.getAccountNumber();
        return {
            mobileNumber,
            planType,
            circleName,
            customerName,
            accountNumber,
        };
    }
    async getMobileNumber() {
        try {
            const inputElement = await (0, globals_1.$)(SiebelSelectors_1.SiebelSelectors.accountSummary.mobileNumberInput);
            await inputElement.waitForDisplayed({ timeout: 10000 });
            const value = await inputElement.getValue();
            return value || 'Not Found';
        }
        catch (error) {
            console.log('Could not get mobile number from account summary');
            return 'Not Found';
        }
    }
    async getPlanType() {
        try {
            const labelElement = await (0, globals_1.$)(SiebelSelectors_1.SiebelSelectors.accountSummary.postpaidLabel);
            const text = await labelElement.getText();
            if (text.toLowerCase().includes('postpaid')) {
                return 'Postpaid';
            }
            else if (text.toLowerCase().includes('prepaid')) {
                return 'Prepaid';
            }
            return text.trim();
        }
        catch (error) {
            return 'Not Found';
        }
    }
    async getCircleName() {
        try {
            const labelElement = await (0, globals_1.$)(SiebelSelectors_1.SiebelSelectors.accountSummary.circleNameLabel);
            const text = await labelElement.getText();
            return text.trim();
        }
        catch (error) {
            return 'Not Found';
        }
    }
    async getCustomerName() {
        try {
            const customerElement = await (0, globals_1.$)('//*[contains(@aria-label, "Customer") or contains(@id, "Customer")]');
            if (await customerElement.isExisting()) {
                return await customerElement.getValue();
            }
            return 'Not Found';
        }
        catch {
            return 'Not Found';
        }
    }
    async getAccountNumber() {
        try {
            const accountElement = await (0, globals_1.$)('//*[contains(@aria-label, "Account") or contains(@id, "Account")]');
            if (await accountElement.isExisting()) {
                return await accountElement.getValue();
            }
            return 'Not Found';
        }
        catch {
            return 'Not Found';
        }
    }
    async validateMobileNumber(expectedMSISDN) {
        const actual = await this.getMobileNumber();
        const isValid = actual === expectedMSISDN;
        if (!isValid) {
            console.log(`Mobile number mismatch: Expected ${expectedMSISDN}, Got ${actual}`);
        }
        return isValid;
    }
    async validatePostpaid() {
        const planType = await this.getPlanType();
        const isValid = planType.toLowerCase() === 'postpaid';
        if (!isValid) {
            console.log(`Not Postpaid: ${planType}`);
        }
        return isValid;
    }
    async validateCircleName(expectedCircle) {
        const actual = await this.getCircleName();
        const isValid = actual.toLowerCase().includes(expectedCircle.toLowerCase());
        if (!isValid) {
            console.log(`Circle mismatch: Expected ${expectedCircle}, Got ${actual}`);
        }
        return isValid;
    }
    async verifyAccountSummaryPage(expectedMsisdn) {
        try {
            const breadcrumb = await (0, globals_1.$)('span.siebui-crumb');
            await breadcrumb.waitForDisplayed({ timeout: 15000 });
            const breadcrumbText = await breadcrumb.getText();
            if (!breadcrumbText.includes('Account Summary')) {
                throw new Error(`Wrong page: ${breadcrumbText}`);
            }
            console.log(`✓ Navigated to: ${breadcrumbText}`);
            const assetField = await (0, globals_1.$)('input[aria-label="Asset"], input[aria-labelledby="AssetNumTitle_Label"]');
            await assetField.waitForDisplayed({ timeout: 10000 });
            const assetValue = await assetField.getValue();
            console.log(`✓ Asset Number: ${assetValue}`);
            const subscriberType = await (0, globals_1.$)('span[id*="_Subscriber_Type"] label');
            const subscriberTypeText = await subscriberType.getText();
            console.log(`✓ Subscriber Type: ${subscriberTypeText}`);
            return true;
        }
        catch (err) {
            const error = err;
            console.error(`Verification failed: ${error.message}`);
            return false;
        }
    }
}
exports.AccountSummaryPage = AccountSummaryPage;
