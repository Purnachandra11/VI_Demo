import { browser, $ } from '@wdio/globals';
import { CaptchaHelper } from '../helpers/CaptchaHelper';


const SWIFT_URL = 'https://swiftcrm.vodafoneidea.in/swift-portal/login';

const Selectors = {
  username: '//*[@id="tempusername"]',
  password: '//*[@id="temppassword"]',
  captchaImg: 'img#LoginCaptcha',
  captchaInput: '//*[@id="captcha"]',
  loginBtn: '//*[@id="loginForm"]/div[2]/div[2]/form/button',
  myProfile: 'a#ac_agent_profile',
  advancedButton: '//*[@id="details-button"]',
  proceedLink: '//*[@id="proceed-link"]',
} as const;

export class SwiftLoginPage {
  async open(): Promise<void> {
    console.log(`[SwiftLoginPage] Navigating to ${SWIFT_URL}`);
    await browser.url(SWIFT_URL);
    
    // Wait for page to load and handle SSL warning if present
    await browser.waitUntil(
      async () => {
        const title = await browser.getTitle();
        return title.length > 0;
      },
      { timeout: 30000, timeoutMsg: 'Page did not load within 30 s' }
    );
    
    // Check if we're on the SSL warning page
    try {
      const advancedBtn = await $(Selectors.advancedButton);
      if (await advancedBtn.isDisplayed()) {
        console.log('[SwiftLoginPage] SSL warning detected, bypassing...');
        await advancedBtn.click();
        await browser.pause(1000);
        
        const proceedLink = await $(Selectors.proceedLink);
        if (await proceedLink.isDisplayed()) {
          await proceedLink.click();
          await browser.pause(2000);
        }
      }
    } catch (e) {
      // No SSL warning, continue
    }
    
    console.log(`[SwiftLoginPage] Page title: ${await browser.getTitle()}`);
    console.log(`[SwiftLoginPage] Current URL: ${await browser.getUrl()}`);
  }

  async enterUsername(username: string): Promise<void> {
    const el = await $(Selectors.username);
    await el.waitForDisplayed({ timeout: 10000 });
    await el.clearValue();
    await el.setValue(username);
    console.log(`[SwiftLoginPage] Username entered: ${username}`);
  }

  // async enterPassword(password: string): Promise<void> {
  //   const el = await $(Selectors.password);
  //   await el.waitForDisplayed({ timeout: 10000 });
  //   await el.clearValue();
  //   await el.setValue(password);
  //   console.log('[SwiftLoginPage] Password entered');
  // }

  async enterPassword(password: string): Promise<void> {
    const el = await $(Selectors.password);
    await el.waitForDisplayed({ timeout: 10000 });
    
    // Fix: Remove readonly attribute and focus the field
    await browser.execute(() => {
        const element = document.getElementById('temppassword') as HTMLInputElement;
        if (element) {
            // Remove readonly attribute
            element.removeAttribute('readonly');
            // Focus the element to trigger any onfocus events
            element.focus();
        }
    });
    
    // Wait a moment for the field to become fully editable
    await browser.pause(500);
    
    // Clear and set value
    await el.clearValue();
    await el.setValue(password);
    
    console.log('[SwiftLoginPage] Password entered');
}

  async enterCaptcha(captchaText: string): Promise<void> {
    const el = await $(Selectors.captchaInput);
    await el.waitForDisplayed({ timeout: 10000 });
    await el.clearValue();
    await el.setValue(captchaText);
    console.log(`[SwiftLoginPage] CAPTCHA entered: ${captchaText}`);
  }

  async clickLoginButton(): Promise<void> {
    const btn = await $(Selectors.loginBtn);
    await btn.waitForClickable({ timeout: 10000 });
    await btn.click();
    console.log('[SwiftLoginPage] Login button clicked');
  }

  async waitForCaptchaImage(): Promise<void> {
    const img = await $(Selectors.captchaImg);
    await img.waitForDisplayed({ timeout: 15000 });
    await browser.pause(1000);
  }

  async waitForProfilePage(timeoutMs = 30000): Promise<void> {
    console.log('[SwiftLoginPage] Waiting for My Profile tab to appear …');
    const profileTab = await $(Selectors.myProfile);
    await profileTab.waitForExist({ timeout: timeoutMs });
    await profileTab.waitForDisplayed({ timeout: timeoutMs });
    console.log('[SwiftLoginPage] ✅ My Profile tab is visible — login successful!');
  }

  async isProfilePageLoaded(): Promise<boolean> {
    try {
      const profileTab = await $(Selectors.myProfile);
      return await profileTab.isDisplayed();
    } catch {
      return false;
    }
  }

  async login(username: string, password: string, maxRetries = 3): Promise<void> {
    await this.open();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n[SwiftLoginPage] Login attempt ${attempt} of ${maxRetries}`);

      await this.enterUsername(username);
      await this.enterPassword(password);
      await this.waitForCaptchaImage();

      const captchaAnswer = await CaptchaHelper.solve();
      await this.enterCaptcha(captchaAnswer);
      await this.clickLoginButton();

      await browser.pause(3000);

      if (await this.isProfilePageLoaded()) {
        console.log('[SwiftLoginPage] ✅ Login verified — Profile page loaded.');
        return;
      }

      console.warn(`[SwiftLoginPage] ⚠️  Profile page not detected after attempt ${attempt}.`);

      if (attempt < maxRetries) {
        console.log('[SwiftLoginPage] Refreshing CAPTCHA and retrying …');
        await CaptchaHelper.refresh();

        try {
          const usernameEl = await $(Selectors.username);
          if (await usernameEl.isDisplayed()) {
            await this.enterUsername(username);
            await this.enterPassword(password);
          }
        } catch {
          await this.open();
        }
      }
    }

    throw new Error(
      `[SwiftLoginPage] Login failed after ${maxRetries} attempts. ` +
      'Verify credentials, CAPTCHA value, and network access.'
    );
  }
}
