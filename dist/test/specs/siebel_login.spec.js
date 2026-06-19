"use strict";
// test/pages/SiebelLoginPage.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiebelLoginPage = void 0;
const globals_1 = require("@wdio/globals");
const siebel_config_1 = require("../config/siebel.config");
const SEL = {
    // Login page
    username: '//*[@id="username"]',
    password: '//*[@id="password"]',
    loginButton: '//*[@id="loginData"]/div[4]/span/input',
    // OTP / identity verification page
    otpField: '//*[@id="Bharosa_Challenge_PadDataField"]',
    otpSubmit: '//*[@id="loginForm"]/div[4]/input',
    // Post-login Siebel home
    homeTab: '//*[@id="ui-id-126"]',
};
class SiebelLoginPage {
    constructor() {
        this.cfg = (0, siebel_config_1.getSiebelConfig)();
    }
    async open() {
        console.log(`\n🌐 Opening Siebel URL: ${this.cfg.url}`);
        await globals_1.browser.url(this.cfg.url);
        await globals_1.browser.pause(3000);
        console.log('Page loaded');
    }
    async verifyWelcomeText() {
        console.log('Verifying "Welcome" text on login page...');
        await globals_1.browser.waitUntil(async () => {
            const body = await (0, globals_1.$)('body');
            const text = await body.getText();
            return text.toLowerCase().includes('welcome');
        }, {
            timeout: 20000,
            interval: 500,
            timeoutMsg: '"Welcome" text not found on login page within 20 s',
        });
        console.log('"Welcome" text detected');
    }
    async enterCredentials(username, password) {
        console.log(`Entering credentials for: ${username}`);
        const usernameField = await (0, globals_1.$)(SEL.username);
        await usernameField.waitForDisplayed({ timeout: 10000 });
        await usernameField.clearValue();
        await usernameField.setValue(username);
        const passwordField = await (0, globals_1.$)(SEL.password);
        await passwordField.waitForDisplayed({ timeout: 5000 });
        await passwordField.clearValue();
        await passwordField.setValue(password);
        console.log('    Credentials entered');
    }
    async clickLoginButton() {
        console.log('🖱️ Clicking Login button...');
        const loginBtn = await (0, globals_1.$)(SEL.loginButton);
        await loginBtn.waitForClickable({ timeout: 10000 });
        await loginBtn.click();
        console.log('    Login button clicked');
    }
    async waitForOTPPage() {
        console.log('⏳ Waiting for OTP / identity verification page...');
        await globals_1.browser.waitUntil(async () => {
            try {
                const body = await (0, globals_1.$)('body');
                const text = await body.getText();
                return (text.includes('To confirm your identity') ||
                    text.includes('Email Code') ||
                    text.includes('enter the code'));
            }
            catch {
                return false;
            }
        }, {
            timeout: 30000,
            interval: 1000,
            timeoutMsg: 'OTP verification page did not appear within 30 s',
        });
        console.log('    OTP page detected');
    }
    async enterOTP(otp, manualPauseMs = 60000) {
        const otpField = await (0, globals_1.$)(SEL.otpField);
        await otpField.waitForDisplayed({ timeout: 15000 });
        if (!otp) {
            console.log(`OTP not provided — pausing ${manualPauseMs / 1000}s manual`);
            console.log(`Please enter the OTP in the browser window`);
            await globals_1.browser.pause(manualPauseMs);
        }
        else {
            console.log('Entering OTP...');
            await otpField.clearValue();
            await otpField.setValue(otp);
            console.log('OTP entered');
        }
    }
    async clickOTPSubmit() {
        console.log('Clicking OTP Submit button...');
        const submitBtn = await (0, globals_1.$)(SEL.otpSubmit);
        await submitBtn.waitForClickable({ timeout: 10000 });
        await submitBtn.click();
        console.log('OTP Submit clicked');
    }
    async waitForHomePage() {
        console.log('Waiting for Siebel Home page...');
        await globals_1.browser.waitUntil(async () => {
            try {
                const homeTab = await (0, globals_1.$)(SEL.homeTab);
                return await homeTab.isDisplayed();
            }
            catch {
                return false;
            }
        }, {
            timeout: 60000,
            interval: 1500,
            timeoutMsg: 'Siebel Home page (Home tab) did not appear within 60 s',
        });
        console.log('Home page loaded');
    }
    async clickHomeTab() {
        console.log('Clicking Home tab...');
        const homeTab = await (0, globals_1.$)(SEL.homeTab);
        await homeTab.waitForClickable({ timeout: 10000 });
        await homeTab.click();
        await globals_1.browser.pause(2000);
        console.log('Home tab clicked');
    }
    async loginFull(username, password, otp = '') {
        await this.open();
        await this.verifyWelcomeText();
        await this.enterCredentials(username, password);
        await this.clickLoginButton();
        await this.waitForOTPPage();
        await this.enterOTP(otp);
        await this.clickOTPSubmit();
        await this.waitForHomePage();
        await this.clickHomeTab();
    }
}
exports.SiebelLoginPage = SiebelLoginPage;
