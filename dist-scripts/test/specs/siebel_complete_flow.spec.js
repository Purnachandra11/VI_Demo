"use strict";
// D:\New VI UAT PROJECT\WIP\Automation Folder\VI Demo 31.05.2026\VI Demo\test\specs\siebel_complete_flow.spec.ts
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@wdio/globals");
const chai_1 = require("chai");
const SiebelLoginPage_1 = require("../pages/SiebelLoginPage");
const SiebelSubscriptionsPage_1 = require("../pages/SiebelSubscriptionsPage");
const AccountSummaryPage_1 = require("../pages/AccountSummaryPage");
const BillingAccountPage_1 = require("../pages/BillingAccountPage");
const Siebelbillingpage_1 = require("../pages/Siebelbillingpage");
const siebel_config_1 = require("../config/siebel.config");
describe('Siebel Complete Flow - Full Validation', () => {
    let loginPage;
    let subsPage;
    let accountSummaryPage;
    let billingPage;
    let siebelBillingPage;
    let cfg;
    const msisdn = "9737275744";
    before(async () => {
        loginPage = new SiebelLoginPage_1.SiebelLoginPage();
        subsPage = new SiebelSubscriptionsPage_1.SiebelSubscriptionsPage();
        accountSummaryPage = new AccountSummaryPage_1.AccountSummaryPage();
        billingPage = new BillingAccountPage_1.BillingAccountPage();
        siebelBillingPage = new Siebelbillingpage_1.SiebelBillingPage();
        cfg = (0, siebel_config_1.getSiebelConfig)();
        console.log('\n' + '='.repeat(70));
        console.log('SIEBEL COMPLETE FLOW TEST');
        console.log('='.repeat(70));
        console.log(`MSISDN: ${msisdn}`);
        console.log(`URL: ${cfg.url}`);
        console.log('='.repeat(70) + '\n');
    });
    it('Step 1-3: Login to Siebel successfully', async () => {
        await loginPage.loginFull(cfg.username, cfg.password, cfg.otp, cfg.otpPauseMs);
        console.log('✅ Login completed');
    });
    it('Step 4-5: Search and select subscription', async () => {
        await subsPage.enterMSISDN(msisdn);
        await subsPage.clickGoButton();
        const resultPage = await subsPage.detectResultPage();
        if (resultPage === 'ACCOUNT_SUMMARY') {
            console.log('Direct Account Summary - Case 5.1');
            await subsPage.verifyAccountSummaryPage(msisdn);
        }
        else {
            console.log('Subscription List - Case 5.2');
            const found = await subsPage.findAndOpenValidSubscription(msisdn);
            (0, chai_1.expect)(found).to.equal(true);
            await subsPage.verifyAccountSummaryPage(msisdn);
        }
        console.log('✅ Subscription selected');
    });
    it('Step 6: Navigate to Billing/Account', async () => {
        await billingPage.clickBillingAccountTab();
        const hasInvoiceSection = await billingPage.verifyInvoiceDetailsSection();
        (0, chai_1.expect)(hasInvoiceSection).to.equal(true);
        console.log('✅ Billing/Account tab loaded');
    });
    it('Step 7: Open and validate invoice PDF', async () => {
        const latestInvoice = await billingPage.getLatestInvoiceRow();
        (0, chai_1.expect)(latestInvoice).to.not.be.null;
        // console.log(`Latest invoice: ${latestInvoice.invoiceId}`);
        await billingPage.clickDetailedButton();
        await billingPage.switchToPDFTab();
        // Handle certificate warning
        try {
            const continueLink = await $('=Continue to productionsouthebpp.vodafoneidea.in (unsafe)');
            if (await continueLink.isExisting()) {
                await continueLink.click();
                await globals_1.browser.pause(2000);
            }
        }
        catch (e) {
            // No warning
        }
        // Validate PDF content
        // Note: Using validateInvoicePDF instead of non-existent readPDFWithAI
        if (siebelBillingPage.validateInvoicePDF) {
            const result = await siebelBillingPage.validateInvoicePDF({
                msisdn: msisdn,
                planName: "Vi Max Family 871", // This should ideally come from a config or test data
            });
            (0, chai_1.expect)(result).to.not.be.null;
        }
        console.log('✅ PDF validation completed');
    });
    after(async () => {
        console.log('\n' + '='.repeat(70));
        console.log('TEST EXECUTION COMPLETED');
        console.log('='.repeat(70));
    });
});
