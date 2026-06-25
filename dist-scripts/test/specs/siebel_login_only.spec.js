"use strict";
// test/specs/siebel_login_only.spec.ts
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@wdio/globals");
const SiebelLoginPage_1 = require("../pages/SiebelLoginPage");
const siebel_config_1 = require("../config/siebel.config");
describe('Siebel Login - Quick Test', function () {
    this.timeout(300000);
    let loginPage;
    let cfg;
    before(function () {
        loginPage = new SiebelLoginPage_1.SiebelLoginPage();
        cfg = (0, siebel_config_1.getSiebelConfig)();
        console.log('\n' + '='.repeat(60));
        console.log('SIEBEL LOGIN TEST');
        console.log('='.repeat(60));
        console.log(`URL: ${cfg.url}`);
        console.log(`User: ${cfg.username}`);
        console.log(`OTP Mode: ${cfg.otp ? 'Auto' : 'Manual (60s pause)'}`);
        console.log('='.repeat(60) + '\n');
    });
    it('should login to Siebel successfully', async function () {
        await loginPage.open();
        // Wait a bit for page to load
        await globals_1.browser.pause(2000);
        // Check for welcome text
        const body = await globals_1.browser.$('body');
        const bodyText = await body.getText();
        console.log(`Page contains welcome: ${bodyText.toLowerCase().includes('welcome')}`);
        // Enter credentials
        const usernameField = await globals_1.browser.$('//*[@id="username"]');
        await usernameField.waitForDisplayed({ timeout: 10000 });
        await usernameField.setValue(cfg.username);
        const passwordField = await globals_1.browser.$('//*[@id="password"]');
        await passwordField.setValue(cfg.password);
        // Click login
        const loginBtn = await globals_1.browser.$('//*[@id="loginData"]/div[4]/span/input');
        await loginBtn.click();
        // Wait for OTP page
        await globals_1.browser.pause(3000);
        // Handle OTP
        const otpField = await globals_1.browser.$('//*[@id="Bharosa_Challenge_PadDataField"]');
        if (await otpField.isDisplayed()) {
            if (!cfg.otp) {
                console.log('\nMANUAL OTP REQUIRED - You have 60 seconds to enter the OTP in the browser\n');
                await globals_1.browser.pause(60000);
            }
            else {
                await otpField.setValue(cfg.otp);
            }
            const submitBtn = await globals_1.browser.$('//*[@id="loginForm"]/div[4]/input');
            await submitBtn.click();
        }
        // Wait for home page
        await globals_1.browser.pause(5000);
        const homeTab = await globals_1.browser.$('//*[@id="ui-id-126"]');
        const isHomeDisplayed = await homeTab.isDisplayed();
        expect(isHomeDisplayed).toBe(true);
        console.log('\n Login successful! Home page loaded.\n');
    });
    after(async function () {
        console.log('Test completed. Browser will close in 5 seconds...');
        await globals_1.browser.pause(5000);
    });
});
