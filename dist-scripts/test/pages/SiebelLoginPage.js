"use strict";
/**
 * SiebelLoginPage.ts
 * Page Object — Steps 1 & 2
 *
 * Step 1 : Open URL → verify "Welcome" → fill username/password → click Login
 * Step 2 : Post-login challenge screen — two cases handled automatically:
 *   Case 2.1 — Email OTP     (Bharosa OTP challenge)
 *   Case 2.2 — Security Q&A  (Bharosa knowledge-based challenge)
 *   Both share the same input XPath and submit button.
 *   The page body text is read to decide which case applies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiebelLoginPage = void 0;
const globals_1 = require("@wdio/globals");
const siebel_config_1 = require("../config/siebel.config");
// ─── Selectors ─────────────────────────────────────────────────────────────────
const SEL = {
    // Step 1 – Login form
    body: 'body',
    username: '//*[@id="username"]',
    password: '//*[@id="password"]',
    loginBtn: '//*[@id="loginData"]/div[4]/span/input',
    // Step 2 – Shared challenge input + submit (same XPath for OTP and Answer)
    challengeInput: '//*[@id="Bharosa_Challenge_PadDataField"]',
    challengeSubmit: '//*[@id="loginForm"]/div[4]/input',
};
// ─── Page object ──────────────────────────────────────────────────────────────
class SiebelLoginPage {
    constructor() {
        this.cfg = (0, siebel_config_1.getSiebelConfig)();
    }
    // ── Step 1a : Open URL ───────────────────────────────────────────────────────
    async open() {
        console.log(`\n🌐 Opening: ${this.cfg.url}`);
        await globals_1.browser.url(this.cfg.url);
        await globals_1.browser.pause(2000);
    }
    // ── Step 1b : Verify "Welcome" text ─────────────────────────────────────────
    async verifyWelcomeText() {
        console.log('🔍 Verifying "Welcome" text...');
        await globals_1.browser.waitUntil(async () => {
            const text = await (await (0, globals_1.$)('body')).getText();
            return text.toLowerCase().includes('welcome');
        }, { timeout: 20000, interval: 500,
            timeoutMsg: '"Welcome" not found on login page within 20 s' });
        console.log('   ✅ "Welcome" text found');
    }
    // ── Step 1c : Fill credentials ───────────────────────────────────────────────
    async enterCredentials(username, password) {
        console.log(`📝 Entering credentials — user: ${username}`);
        const uField = await (0, globals_1.$)(SEL.username);
        await uField.waitForDisplayed({ timeout: 10000 });
        await uField.clearValue();
        await uField.setValue(username);
        const pField = await (0, globals_1.$)(SEL.password);
        await pField.waitForDisplayed({ timeout: 5000 });
        await pField.clearValue();
        await pField.setValue(password);
        console.log('   ✅ Credentials entered');
    }
    // ── Step 1d : Click Login button ─────────────────────────────────────────────
    async clickLoginButton() {
        console.log('🖱️  Clicking Login button...');
        const btn = await (0, globals_1.$)(SEL.loginBtn);
        await btn.waitForClickable({ timeout: 10000 });
        await btn.click();
        console.log('   ✅ Login button clicked');
    }
    // ── Step 2 : Detect which challenge screen appeared ──────────────────────────
    /**
     * Waits for the Bharosa challenge page to load and returns which type it is.
     *   'OTP'               → "enter the code sent to you in email"
     *   'SECURITY_QUESTION' → "answer the following security question"
     */
    async detectChallengeType() {
        console.log('⏳ Waiting for challenge screen...');
        await globals_1.browser.waitUntil(async () => {
            const text = await (await (0, globals_1.$)('body')).getText();
            return (text.includes('To confirm your identity') ||
                text.includes('enter the code') ||
                text.includes('security question'));
        }, { timeout: 30000, interval: 1000,
            timeoutMsg: 'Challenge screen did not appear within 30 s' });
        const bodyText = await (await (0, globals_1.$)('body')).getText();
        if (bodyText.toLowerCase().includes('email') ||
            bodyText.toLowerCase().includes('enter the code')) {
            console.log('   📧 Case 2.1 — Email OTP challenge detected');
            return 'OTP';
        }
        if (bodyText.toLowerCase().includes('security question')) {
            console.log('   ❓ Case 2.2 — Security Question challenge detected');
            return 'SECURITY_QUESTION';
        }
        console.log('   ⚠️  Unknown challenge type');
        return 'UNKNOWN';
    }
    /**
     * Log the security question text so the tester knows what to answer.
     * e.g. "What was the name of your favorite teacher?"
     */
    async logSecurityQuestion() {
        try {
            const bodyText = await (await (0, globals_1.$)('body')).getText();
            // The question typically appears between "security question." and the input
            const match = bodyText.match(/security question\.\s*\n+(.*?)(?:\n|$)/i);
            const question = match ? match[1].trim() : '(question text not parsed)';
            console.log(`   ❓ Security Question: "${question}"`);
            return question;
        }
        catch {
            return '';
        }
    }
    // ── Step 2 : Enter OTP or Answer (shared input, 30 s manual pause) ──────────
    /**
     * Waits up to `pauseMs` for the tester to manually type the OTP or answer
     * into the Bharosa challenge input.  If a pre-set value is provided it is
     * typed automatically instead.
     *
     * @param presetValue   Pre-set OTP or answer (leave blank for manual entry)
     * @param pauseMs       How long to pause for manual entry (default 30 s)
     */
    async enterChallengeResponse(presetValue = '', pauseMs = 30000) {
        const input = await (0, globals_1.$)(SEL.challengeInput);
        await input.waitForDisplayed({ timeout: 15000 });
        if (presetValue) {
            console.log('🔑 Auto-filling challenge response...');
            await input.clearValue();
            await input.setValue(presetValue);
            console.log('   ✅ Response entered');
        }
        else {
            console.log(`⏸️  Waiting ${pauseMs / 1000}s for manual challenge entry...`);
            await globals_1.browser.pause(pauseMs);
            console.log('   ✅ Manual entry time elapsed');
        }
    }
    // ── Step 2 : Click the challenge Submit button ────────────────────────────────
    async clickChallengeSubmit() {
        console.log('🖱️  Clicking challenge Submit...');
        const btn = await (0, globals_1.$)(SEL.challengeSubmit);
        await btn.waitForClickable({ timeout: 10000 });
        await btn.click();
        console.log('   ✅ Challenge submitted');
    }
    // ── Step 3 : Wait for Home page ───────────────────────────────────────────────
    async waitForHomePage(timeoutMs) {
        const t = timeoutMs !== null && timeoutMs !== void 0 ? timeoutMs : this.cfg.homePageTimeoutMs;
        console.log(`⏳ Waiting for Home page (up to ${t / 1000}s)...`);
        await globals_1.browser.waitUntil(async () => {
            try {
                // Accept either of the two known Home-tab IDs
                for (const id of ['ui-id-126', 'ui-id-209']) {
                    const el = await (0, globals_1.$)(`//*[@id="${id}"]`);
                    if (await el.isDisplayed())
                        return true;
                }
                return false;
            }
            catch {
                return false;
            }
        }, { timeout: t, interval: 1500,
            timeoutMsg: `Siebel Home page did not load within ${t / 1000}s` });
        console.log('   ✅ Home page loaded');
    }
    // ── Step 3 : Click Home tab ───────────────────────────────────────────────────
    async clickHomeTab() {
        console.log('🏠 Clicking Home tab...');
        // Try primary ID first, then fallback ID from the HTML element provided
        for (const id of ['ui-id-126', 'ui-id-209']) {
            try {
                const el = await (0, globals_1.$)(`//*[@id="${id}"]`);
                if (await el.isDisplayed()) {
                    await el.waitForClickable({ timeout: 5000 });
                    await el.click();
                    await globals_1.browser.pause(2000);
                    console.log(`   ✅ Home tab clicked (#${id})`);
                    return;
                }
            }
            catch { /* try next */ }
        }
        throw new Error('Home tab not found with any known ID');
    }
    // ── Convenience: full login flow ──────────────────────────────────────────────
    /**
     * Runs the complete Steps 1-3 in one call.
     * Handles both Case 2.1 (OTP) and Case 2.2 (Security Question) automatically.
     */
    async loginFull(username, password, otpOrAnswer = '', challengePauseMs = 30000) {
        // ── Check if already logged in ──────────────────────────────────────────── 
        try {
            for (const id of ['ui-id-126', 'ui-id-209']) {
                const el = await (0, globals_1.$)(`//*[@id="${id}"]`);
                if (await el.isExisting() && await el.isDisplayed()) {
                    console.log('   ℹ️  Already logged in — skipping login steps');
                    return 'UNKNOWN';
                }
            }
        }
        catch { /* not logged in, proceed */ }
        await this.open();
        await this.verifyWelcomeText();
        await this.enterCredentials(username, password);
        await this.clickLoginButton();
        const challengeType = await this.detectChallengeType();
        if (challengeType === 'SECURITY_QUESTION') {
            await this.logSecurityQuestion();
        }
        await this.enterChallengeResponse(otpOrAnswer, challengePauseMs);
        await this.clickChallengeSubmit();
        await this.waitForHomePage();
        await this.clickHomeTab();
        return challengeType;
    }
}
exports.SiebelLoginPage = SiebelLoginPage;
