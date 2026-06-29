import { browser, $ } from '@wdio/globals';
import * as fs from 'fs';
import * as path from 'path';

const SWIFT_URL = 'https://swiftcrm.vodafoneidea.in/swift-portal/login';
const COMM_DIR = path.resolve('./comm');
const LOGIN_STATE_FILE = path.join(COMM_DIR, 'login_state.json');
const CAPTCHA_REQUEST_FILE = path.join(COMM_DIR, 'captcha_request.json');
const CAPTCHA_RESPONSE_FILE = path.join(COMM_DIR, 'captcha_response.json');

const Selectors = {
  username: '//*[@id="tempusername"]',
  password: '//*[@id="temppassword"]',
  captchaImg: 'img#LoginCaptcha',
  captchaInput: '//*[@id="captcha"]',
  loginBtn: '//*[@id="loginForm"]/div[2]/div[2]/form/button',
  myProfile: 'a#ac_agent_profile',
  advancedButton: '//*[@id="details-button"]',
  proceedLink: '//*[@id="proceed-link"]',
  logoutButton: '//a[contains(@href, "logout")]',
  agentTab: '//*[@id="agent-tab"]',
  captchaImgSelector: '#LoginCaptcha',
} as const;

export class SwiftLoginPage {
  private isLoggedIn = false;

  /**
   * Wait for manual login by the user via frontend
   * Polls login_state.json to detect when user has logged in
   */
  async waitForManualLogin(timeoutMs: number = 300000): Promise<void> {
    console.log('[SwiftLoginPage] Waiting for manual login via frontend...');
    
    const start = Date.now();
    let loggedIn = false;

    while (!loggedIn && (Date.now() - start) < timeoutMs) {
      try {
        // Check if already logged in (profile tab visible)
        const hasProfile = await $(Selectors.myProfile).isDisplayed().catch(() => false);
        if (hasProfile) {
          console.log('[SwiftLoginPage] ✅ Manual login detected - profile tab visible');
          this.isLoggedIn = true;
          await this.writeLoginState(true);
          return;
        }

        // Check login state file
        if (fs.existsSync(LOGIN_STATE_FILE)) {
          const data = JSON.parse(fs.readFileSync(LOGIN_STATE_FILE, 'utf8'));
          if (data.isLoggedIn === true) {
            loggedIn = true;
            this.isLoggedIn = true;
            console.log('[SwiftLoginPage] ✅ Manual login detected from state file');
            return;
          }
        }

        // Check for login form - if we're on login page, wait for user
        const currentUrl = await browser.getUrl().catch(() => '');
        if (currentUrl.includes('/login')) {
          console.log('[SwiftLoginPage] On login page - waiting for user to login manually...');
          // Check if CAPTCHA is visible and trigger it
          await this.checkAndHandleCaptcha();
        }

        await browser.pause(2000);
      } catch (_e) {
        await browser.pause(2000);
      }
    }

    if (!loggedIn) {
      throw new Error('[SwiftLoginPage] ❌ Manual login timeout - user did not login within timeout');
    }
  }

  /**
   * Check if CAPTCHA is visible and handle it
   */
  async checkAndHandleCaptcha(): Promise<void> {
    try {
      const captchaImg = await $(Selectors.captchaImgSelector);
      if (await captchaImg.isDisplayed({ timeout: 2000 })) {
        console.log('[SwiftLoginPage] 📸 CAPTCHA image detected');
        
        // Take screenshot of CAPTCHA element
        const timestamp = Date.now();
        const filename = `captcha_${timestamp}.png`;
        const captchaDir = path.resolve('./captcha_screenshots');
        
        if (!fs.existsSync(captchaDir)) {
          fs.mkdirSync(captchaDir, { recursive: true });
        }
        
        const filepath = path.join(captchaDir, filename);
        await captchaImg.saveScreenshot(filepath);
        
        // Write request file for frontend
        fs.mkdirSync(COMM_DIR, { recursive: true });
        const imageUrl = `/captcha-images/${filename}`;
        fs.writeFileSync(CAPTCHA_REQUEST_FILE, JSON.stringify({
          timestamp: timestamp,
          filename: filename,
          imageUrl: imageUrl
        }, null, 2));
        
        // Remove any stale response
        if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
          fs.unlinkSync(CAPTCHA_RESPONSE_FILE);
        }
        
        console.log(`[SwiftLoginPage] CAPTCHA saved: ${filename} → ${imageUrl}`);
        
        // Wait for CAPTCHA response from frontend
        await this.waitForCaptchaResponse();
      }
    } catch (_e) {
      // CAPTCHA not visible yet
    }
  }

  /**
   * Wait for CAPTCHA response from frontend
   */
  async waitForCaptchaResponse(timeoutMs: number = 120000): Promise<void> {
    console.log('[SwiftLoginPage] ⏳ Waiting for CAPTCHA response from frontend...');
    const start = Date.now();
    let answer = '';

    while (!answer && (Date.now() - start) < timeoutMs) {
      if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
        try {
          const raw = fs.readFileSync(CAPTCHA_RESPONSE_FILE, 'utf8');
          const data = JSON.parse(raw);
          if (data.answer) {
            answer = data.answer;
            console.log(`[SwiftLoginPage] ✅ CAPTCHA response received: "${answer}"`);
            
            // Enter the CAPTCHA
            const captchaInput = await $(Selectors.captchaInput);
            await captchaInput.waitForDisplayed({ timeout: 5000 });
            await captchaInput.clearValue();
            await captchaInput.setValue(answer);
            
            // Clean up
            if (fs.existsSync(CAPTCHA_REQUEST_FILE)) fs.unlinkSync(CAPTCHA_REQUEST_FILE);
            if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) fs.unlinkSync(CAPTCHA_RESPONSE_FILE);
            
            return;
          }
        } catch (_e) {
          // File may be mid-write
        }
      }
      await browser.pause(500);
    }

    if (!answer) {
      console.warn('[SwiftLoginPage] ⚠️ CAPTCHA response timeout');
    }
  }

  /**
   * Open the SWIFT CRM page and wait for manual login
   */
  async openAndWaitForManualLogin(): Promise<void> {
    console.log(`[SwiftLoginPage] Navigating to ${SWIFT_URL}`);

    try {
      await browser.url(SWIFT_URL);
    } catch (error) {
      console.log('[SwiftLoginPage] Initial navigation may have triggered SAML redirect');
    }

    // Handle SSL warning if present
    try {
      const detailsBtn = await $(Selectors.advancedButton);
      if (await detailsBtn.isDisplayed({ timeout: 3000 })) {
        await detailsBtn.click();
        const proceedLink = await $(Selectors.proceedLink);
        if (await proceedLink.isDisplayed()) {
          await proceedLink.click();
          console.log('[SwiftLoginPage] SSL warning handled');
        }
      }
    } catch (_e) {}

    // Wait for the page to load and user to login manually
    await this.waitForManualLogin();

    console.log(`[SwiftLoginPage] Current URL: ${await browser.getUrl().catch(() => '(unknown)')}`);
  }

  /**
   * Navigate to agent tab to continue with next row
   */
  async navigateToAgentTab(): Promise<void> {
    console.log('[SwiftLoginPage] Navigating to agent tab...');
    try {
      const agentTab = await $(Selectors.agentTab);
      await agentTab.waitForDisplayed({ timeout: 15000 });
      await agentTab.click();
      console.log('[SwiftLoginPage] ✅ Agent tab clicked');
      await browser.pause(2000);
    } catch (e) {
      console.warn('[SwiftLoginPage] ⚠️ Could not click agent tab, trying fallback...');
      // Try to go to the main page or refresh
      try {
        await browser.url('https://swiftcrm.vodafoneidea.in/swift-portal/login');
        await browser.pause(3000);
        // Wait for manual login again if needed
        await this.waitForManualLogin(60000);
      } catch (_e) {
        throw new Error('[SwiftLoginPage] ❌ Could not navigate to agent tab');
      }
    }
  }

  /**
   * Check if the current session is valid
   */
  async checkIfLoggedIn(): Promise<boolean> {
    try {
      const profileTab = await $(Selectors.myProfile);
      if (await profileTab.isDisplayed({ timeout: 3000 })) {
        console.log('[SwiftLoginPage] ✅ Already logged in (profile tab visible)');
        this.isLoggedIn = true;
        await this.writeLoginState(true);
        return true;
      }

      const logoutBtn = await $(Selectors.logoutButton);
      if (await logoutBtn.isDisplayed({ timeout: 3000 })) {
        console.log('[SwiftLoginPage] ✅ Already logged in (logout button visible)');
        this.isLoggedIn = true;
        await this.writeLoginState(true);
        return true;
      }

      const currentUrl = await browser.getUrl();
      if (currentUrl.includes('/login')) {
        console.log('[SwiftLoginPage] On login page - session expired');
        this.isLoggedIn = false;
        await this.writeLoginState(false);
        return false;
      }

      return false;
    } catch (e) {
      console.log('[SwiftLoginPage] Session check error:', e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async writeLoginState(loggedIn: boolean): Promise<void> {
    try {
      fs.mkdirSync(COMM_DIR, { recursive: true });
      fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({
        isLoggedIn: loggedIn,
        loggedInAt: loggedIn ? Date.now() : null,
        lastChecked: Date.now()
      }, null, 2));
    } catch (e) {
      // Silently fail
    }
  }

  async waitForProfilePage(timeoutMs = 30000): Promise<void> {
    console.log('[SwiftLoginPage] Waiting for My Profile tab to appear …');
    const profileTab = await $(Selectors.myProfile);
    await profileTab.waitForExist({ timeout: timeoutMs });
    await profileTab.waitForDisplayed({ timeout: timeoutMs });
    console.log('[SwiftLoginPage] ✅ My Profile tab is visible — login successful!');

    this.isLoggedIn = true;
    await this.writeLoginState(true);
  }

  async isProfilePageLoaded(): Promise<boolean> {
    try {
      const profileTab = await $(Selectors.myProfile);
      return await profileTab.isDisplayed();
    } catch {
      return false;
    }
  }

  // Check if session is still valid and refresh if needed
  async refreshSessionIfNeeded(): Promise<boolean> {
    const loggedIn = await this.checkIfLoggedIn();
    if (!loggedIn) {
      console.log('[SwiftLoginPage] Session expired, will re-login on next test');
      await this.writeLoginState(false);
      return false;
    }
    return true;
  }
}