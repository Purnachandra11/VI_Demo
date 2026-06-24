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

import { browser, $ } from '@wdio/globals';
import { getSiebelConfig } from '../config/siebel.config';
import * as fs from 'fs';
import * as path from 'path';

// ─── Selectors ─────────────────────────────────────────────────────────────────

const SEL = {
  // Step 1 – Login form
  body        : 'body',
  username    : '//*[@id="username"]',
  password    : '//*[@id="password"]',
  loginBtn    : '//*[@id="loginData"]/div[4]/span/input',

  // Step 2 – Shared challenge input + submit (same XPath for OTP and Answer)
  challengeInput  : '//*[@id="Bharosa_Challenge_PadDataField"]',
  challengeSubmit : '//*[@id="loginForm"]/div[4]/input',
} as const;

// ─── Challenge type ────────────────────────────────────────────────────────────

export type ChallengeType = 'OTP' | 'SECURITY_QUESTION' | 'UNKNOWN';

// ─── Page object ──────────────────────────────────────────────────────────────

export class SiebelLoginPage {
  private readonly cfg = getSiebelConfig();

  private async switchToLatestWindowIfAny(): Promise<void> {
    try {
      const handles = await browser.getWindowHandles();
      if (handles.length > 1) {
        await browser.switchToWindow(handles[handles.length - 1]);
      }
    } catch {}
  }

  private async acceptAnyAlertIfPresent(): Promise<void> {
    try {
      await browser.getAlertText();
      await browser.acceptAlert();
    } catch {}
  }

  // ── Step 1a : Open URL ───────────────────────────────────────────────────────

  async open(): Promise<void> {
    console.log(`\n🌐 Opening: ${this.cfg.url}`);
    await browser.url(this.cfg.url);
    await browser.pause(2_000);
  }

  // ── Step 1b : Verify "Welcome" text ─────────────────────────────────────────

  async verifyWelcomeText(): Promise<void> {
    console.log('🔍 Verifying "Welcome" text...');

    await browser.waitUntil(
      async () => {
        const text = await (await $('body')).getText();
        return text.toLowerCase().includes('welcome');
      },
      { timeout: 20_000, interval: 500,
        timeoutMsg: '"Welcome" not found on login page within 20 s' }
    );

    console.log('   ✅ "Welcome" text found');
  }

  // ── Step 1c : Fill credentials ───────────────────────────────────────────────

  async enterCredentials(username: string, password: string): Promise<void> {
    console.log(`📝 Entering credentials — user: ${username}`);

    const uField = await $(SEL.username);
    await uField.waitForDisplayed({ timeout: 10_000 });
    await uField.clearValue();
    await uField.setValue(username);

    const pField = await $(SEL.password);
    await pField.waitForDisplayed({ timeout: 5_000 });
    await pField.clearValue();
    await pField.setValue(password);

    console.log('   ✅ Credentials entered');
  }

  // ── Step 1d : Click Login button ─────────────────────────────────────────────

  async clickLoginButton(): Promise<void> {
    console.log('🖱️  Clicking Login button...');
    const btn = await $(SEL.loginBtn);
    await btn.waitForClickable({ timeout: 10_000 });
    await btn.click();
    console.log('   ✅ Login button clicked');
  }

  // ── Step 2 : Detect which challenge screen appeared ──────────────────────────

  /**
   * Waits for the Bharosa challenge page to load and returns which type it is.
   *   'OTP'               → "enter the code sent to you in email"
   *   'SECURITY_QUESTION' → "answer the following security question"
   */
  async detectChallengeType(): Promise<ChallengeType> {
    console.log('⏳ Waiting for challenge screen...');

    await browser.waitUntil(
      async () => {
        await this.acceptAnyAlertIfPresent();
        await this.switchToLatestWindowIfAny();
        const text = await (await $('body')).getText();
        return (
          text.includes('To confirm your identity') ||
          text.includes('enter the code') ||
          text.includes('security question')
        );
      },
      { timeout: 30_000, interval: 1_000,
        timeoutMsg: 'Challenge screen did not appear within 30 s' }
    );

    const bodyText = await (await $('body')).getText();

    if (
      bodyText.toLowerCase().includes('email') ||
      bodyText.toLowerCase().includes('enter the code')
    ) {
      console.log('   📧 Case 2.1 — Email OTP challenge detected');
      console.log('[CHALLENGE]: Please enter the OTP sent to your email');
      return 'OTP';
    }

    if (bodyText.toLowerCase().includes('security question')) {
      console.log('   ❓ Case 2.2 — Security Question challenge detected');
      const question = await this.logSecurityQuestion();
      return 'SECURITY_QUESTION';
    }

    console.log('   ⚠️  Unknown challenge type');
    return 'UNKNOWN';
  }

  /**
   * Log the security question text so the tester knows what to answer.
   * e.g. "What was the name of your favorite teacher?"
   */
  async logSecurityQuestion(): Promise<string> {
    try {
      const bodyText = await (await $('body')).getText();
      // The question typically appears between "security question." and the input
      const match = bodyText.match(/security question\.\s*\n+(.*?)(?:\n|$)/i);
      const question = match ? match[1].trim() : '(question text not parsed)';
      console.log(`   ❓ Security Question: "${question}"`);
      console.log(`[CHALLENGE]: Please answer the security question: "${question}"`);
      return question;
    } catch {
      return '';
    }
  }

  // ── Step 2 : Enter OTP or Answer (shared input, 30 s manual pause) ──────────

  /**
   * Waits up to `pauseMs` for the tester to manually type the OTP or answer
   * into the Bharosa challenge input.  If a pre-set value is provided it is
   * typed automatically instead. Also checks the comm directory for a challenge
   * response from the frontend.
   *
   * @param presetValue   Pre-set OTP or answer (leave blank for manual entry)
   * @param pauseMs       How long to pause for manual entry (default 30 s)
   */
  async enterChallengeResponse(
    presetValue = '',
    pauseMs     = 300_000
  ): Promise<void> {
    const input = await $(SEL.challengeInput);
    await input.waitForDisplayed({ timeout: 150_000 });

    if (presetValue) {
      console.log('🔑 Auto-filling challenge response...');
      await input.clearValue();
      await input.setValue(presetValue);
      console.log('   ✅ Response entered');
    } else {
      console.log(`⏸️  Waiting up to ${pauseMs / 1000}s for challenge response from frontend...`);
      
      const commDir = path.join(process.cwd(), 'comm');
      const responseFile = path.join(commDir, 'challenge_response.json');
      
      // Clean up old response file if it exists
      try {
        if (fs.existsSync(responseFile)) {
          fs.unlinkSync(responseFile);
        }
      } catch (err) {
        // console.log('   ℹ️  Could not clean up old response file:', err.message);
      }

      // Wait for the response file or timeout
      const startTime = Date.now();
      let responseReceived = false;
      
      while (Date.now() - startTime < pauseMs && !responseReceived) {
        if (fs.existsSync(responseFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
            if (data.response) {
              console.log(`   ✅ Received challenge response from frontend: ${data.response}`);
              await input.clearValue();
              await input.setValue(data.response);
              responseReceived = true;
              // Clean up the file
              fs.unlinkSync(responseFile);
            }
          } catch (err) {
            // console.log('   ⚠️  Error reading response file:', err.message);
          }
        }
        if (!responseReceived) {
          await browser.pause(1000); // Check every second
        }
      }
      
      if (!responseReceived) {
        console.log('   ⚠️  No response received from frontend - waiting for manual input');
      }
    }
  }

  // ── Step 2 : Click the challenge Submit button ────────────────────────────────

  async clickChallengeSubmit(): Promise<void> {
    console.log('🖱️  Clicking challenge Submit...');
    const btn = await $(SEL.challengeSubmit);
    await btn.waitForClickable({ timeout: 10_000 });
    await btn.click();
    console.log('   ✅ Challenge submitted');
  }

  // ── Step 3 : Wait for Home page ───────────────────────────────────────────────

  async waitForHomePage(timeoutMs?: number): Promise<void> {
    const t = timeoutMs ?? this.cfg.homePageTimeoutMs;
    console.log(`⏳ Waiting for Home page (up to ${t / 1000}s)...`);

    await browser.waitUntil(
      async () => {
        try {
          // Accept either of the two known Home-tab IDs
          for (const id of ['ui-id-126', 'ui-id-209']) {
            const el = await $(`//*[@id="${id}"]`);
            if (await el.isDisplayed()) return true;
          }
          return false;
        } catch {
          return false;
        }
      },
      { timeout: t, interval: 1_500,
        timeoutMsg: `Siebel Home page did not load within ${t / 1000}s` }
    );

    console.log('   ✅ Home page loaded');
  }

  // ── Step 3 : Click Home tab ───────────────────────────────────────────────────

  async clickHomeTab(): Promise<void> {
    console.log('🏠 Clicking Home tab...');

    // Try primary ID first, then fallback ID from the HTML element provided
    for (const id of ['ui-id-126', 'ui-id-209']) {
      try {
        const el = await $(`//*[@id="${id}"]`);
        if (await el.isDisplayed()) {
          await el.waitForClickable({ timeout: 5_000 });
          await el.click();
          await browser.pause(2_000);
          console.log(`   ✅ Home tab clicked (#${id})`);
          return;
        }
      } catch { /* try next */ }
    }

    throw new Error('Home tab not found with any known ID');
  }

  // ── Convenience: full login flow ──────────────────────────────────────────────

  /**
   * Runs the complete Steps 1-3 in one call.
   * Handles both Case 2.1 (OTP) and Case 2.2 (Security Question) automatically.
   */
  async loginFull(
    username     : string,
    password     : string,
    otpOrAnswer  = '',
    challengePauseMs = 30_000
  ): Promise<ChallengeType> {
    // ── Check if already logged in ──────────────────────────────────────────── 
    try { 
        for (const id of ['ui-id-126', 'ui-id-209']) { 
            const el = await $(`//*[@id="${id}"]`); 
            if (await el.isExisting() && await el.isDisplayed()) { 
                console.log('   ℹ️  Already logged in — skipping login steps'); 
                return 'UNKNOWN'; 
            } 
        } 
    } catch { /* not logged in, proceed */ } 

    await this.open();
    await this.verifyWelcomeText();
    await this.enterCredentials(username, password);
    await this.clickLoginButton();
    await this.acceptAnyAlertIfPresent();
    await this.switchToLatestWindowIfAny();

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
