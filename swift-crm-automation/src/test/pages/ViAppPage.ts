import { $, browser } from '@wdio/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/** Drop-in replacement for browser.pause() */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// ─── ADB / app constants ─────────────────────────────────────────────────────
function getConnectedDevices(): string[] {
    try {
        const output = execSync('adb devices', { encoding: 'utf8' });
        const lines = output.split('\n').filter(line => line.trim() !== '');
        const deviceLines = lines.slice(1);
        const devices = deviceLines
            .filter(line => line.includes('\tdevice'))
            .map(line => line.split('\t')[0].trim())
            .filter(serial => serial !== '');

        if (devices.length === 0) {
            throw new Error('No Android devices connected. Please connect a device and try again.');
        }

        return devices;
    } catch (error: any) {
        throw new Error(`Failed to get connected devices: ${error.message}`);
    }
}

let DEVICE_SERIAL: string;
let detectedDevices: string[] = [];

try {
    detectedDevices = getConnectedDevices();

    if (process.env.DEVICE_SERIAL) {
        const envDevice = process.env.DEVICE_SERIAL.trim();
        if (detectedDevices.includes(envDevice)) {
            DEVICE_SERIAL = envDevice;
            console.log(`[ViAppPage] Using device from env: ${DEVICE_SERIAL}`);
        } else {
            console.warn(`[ViAppPage] Device ${envDevice} from env not found in connected devices. Using first available device.`);
            DEVICE_SERIAL = detectedDevices[0];
            console.log(`[ViAppPage] Using device: ${DEVICE_SERIAL}`);
        }
    } else {
        DEVICE_SERIAL = detectedDevices[0];
        console.log(`[ViAppPage] Using first connected device: ${DEVICE_SERIAL}`);
    }
} catch (error: any) {
    console.error(`[ViAppPage] Device detection error: ${error.message}`);
    DEVICE_SERIAL = process.env.DEVICE_SERIAL || 'LFMVIBEMW8HUR4XK';
    console.log(`[ViAppPage] Using fallback device: ${DEVICE_SERIAL}`);
}

const ALL_DEVICES = detectedDevices;
const VI_APP_PACKAGE = 'com.mventus.selfcare.activity';

// ─── File-based OTP comm ─────────────────────────────────────────────────────
const COMM_DIR          = path.resolve('./comm');
const OTP_REQUEST_FILE  = path.join(COMM_DIR, 'otp_request.json');
const OTP_RESPONSE_FILE = path.join(COMM_DIR, 'otp_response.json');

// ─── Screenshots directory ───────────────────────────────────────────────────
const SCREENSHOTS_DIR = path.resolve('./screenshots');

// ─── Selectors ───────────────────────────────────────────────────────────────
const Selectors = {
  // ── Login (DO NOT TOUCH – working) ───────────────────────────────────────
  mobileNumberField:    '//android.widget.TextView[@text="enter mobile number"]',
  mobileNumberFieldAlt: '//android.view.View[@content-desc="-, enter mobile number"]',
  googleCancelBtn:      '//android.widget.Button[@resource-id="com.google.android.gms:id/cancel"]',
  sendOtpBtn:           '//android.widget.Button[@content-desc="send OTP"]',
  loginWithOtpBtn:      '//android.widget.Button[@content-desc="login with OTP"]',
  otpDigitBoxes:        '(//android.view.ViewGroup[count(android.view.ViewGroup)=4])[last()]/android.view.ViewGroup',
  hamburgerIcon:        '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[1]/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]',
  logoutBtn:            '//android.view.View[@content-desc="logout"]',

  // ── Screenshot 1 – home screen MSISDN label ───────────────────────────────
  // content-desc changes per number e.g. "96724 17412"; match any TextView with content-desc
  homeMsisdnLabel: '//android.widget.TextView[@content-desc]',

  // ── Screenshot 2 / 3 – home screen data card ─────────────────────────────
  // Available data (e.g. "0 MB") – text varies; use the known structural xpath
  homeAvailableData: '//android.widget.TextView[@text]',   // generic fallback; primary below
  homeAvailableDataPrimary: '//android.widget.TextView[contains(@text,"MB") or //android.widget.TextView[contains(@text,"unlimited data")]',
  // Ends-on date (e.g. "ends on 05 Jul, 2026")
    // homeEndsOn: '//android.widget.TextView[contains(@text,"unlimited data")]',
  homeEndsOn: '//android.widget.TextView[contains(@text,"ends on")]',

  // ── Tap into active pack (the card element from home screen) ─────────────
  // elementId 00000000-0000-01c4-ffff-ffff000018c2 — use structural xpath
  activePackCard: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]',
  activePackCardAlt: [
    '//*[contains(@content-desc,"active pack")]',
    '//*[contains(@content-desc,"Pack")]',
    '//*[contains(@content-desc,"recharge")]',
    '(//android.view.ViewGroup[@clickable="true"])[2]',
  ],

  // ── Screenshot 4 – active pack details & benefits screen ─────────────────
  activePackDetailsHeader: [
    '//android.view.View[@text="active pack details & benefits"]',
    '//*[@content-desc="active pack details & benefits"]',
  ],

  // Last recharge section (ViewGroup[2] under ScrollView)
  lastRechargeSection:  '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]',
  // Last recharge amount (elementId …273f)
  lastRechargeAmount: [
    '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]//*[contains(@content-desc,"₹") or contains(@text,"₹")]',
    '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]//*[contains(@content-desc,"Rs") or contains(@text,"Rs")]',
  ],
  // Pack ends on date (elementId …2743)
  packEndsOnDate: [
    '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]//*[contains(@content-desc,"ends on") or contains(@text,"ends on")]',
    '//*[contains(@content-desc,"ends on") or contains(@text,"ends on")]',
  ],
  // Main balance (elementId …2754)
  mainBalance: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[4]/android.view.ViewGroup[1]',
  // Service validity (elementId …2759)
  serviceValidity: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[4]/android.view.ViewGroup[2]',

  // ── Screenshot 4.1 – repeat recharge ──────────────────────────────────────
  repeatRechargeBtn: '//android.widget.Button[@content-desc="repeat recharge"]',
  // Pack title on repeat-recharge screen (text like "₹209 pack details")
  repeatRechargePackTitle: [
    '//android.view.View[contains(@text,"pack details")]',
    '//*[contains(@content-desc,"pack details")]',
  ],
  // Benefit text – the full structural xpath from the doc
  benefitTextFull: '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[1]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[1]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[1]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup',
  benefitTextFallback: [
    '//*[contains(@content-desc,"UL") or contains(@text,"UL")]',
    '//*[contains(@content-desc,"GB") or contains(@text,"GB")]',
    '//*[contains(@content-desc,"Unlimited") or contains(@text,"Unlimited")]',
    '//*[contains(@content-desc,"SMS") or contains(@text,"SMS")]',
  ],

  // ── Screenshot 6 – view history ───────────────────────────────────────────
  viewHistoryBtn:    '//android.widget.TextView[@text="view history"]',
  viewHistoryBtnAlt: '//*[@content-desc="view history"]',
  rechargeHistoryHeader: [
    '//android.view.View[@text="recharge history"]',
    '//*[@content-desc="recharge history"]',
  ],
  rechargeHistoryScroll: '//android.widget.ScrollView/android.view.ViewGroup',

  // ── Screenshot 7 – My Account (after hamburger post-history) ─────────────
  // MSISDN with plan type e.g. "9 6 7 2 4 1 7 4 1 2 Prepaid"
  msisdnPlanType: '//*[contains(@content-desc,"Prepaid") or contains(@content-desc,"Postpaid")]',

  // ── Logout confirmation ───────────────────────────────────────────────────
  loggingOutConfirmText: '//android.widget.TextView[@text="logging out?"]',
  yesLogoutBtn: [
    '//android.widget.TextView[@text="yes, logout"]',
    '//android.widget.Button[@content-desc="yes, logout"]',
    '//android.widget.Button[@text="yes, logout"]',
  ],
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ViAppFlowResult {
  msisdn: string;
  homeMsisdn?: string;
  homeAvailableData?: string;
  homeEndsOn?: string;
  lastRechargeAmount?: string;
  lastRechargeAmountNumeric?: string;
  packEndsOnDate?: string;
  mainBalance?: string;
  serviceValidity?: string;
  mrpMatched?: boolean;
  repeatRechargePackTitle?: string;
  benefitText?: string;
  benefitMatched?: boolean;
  msisdnPlanType?: string;
  screenshots: string[];
  error?: string;
}

// ─── Page Object ─────────────────────────────────────────────────────────────

export class ViAppPage {

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS (login section – DO NOT MODIFY)
  // ══════════════════════════════════════════════════════════════════════════

  private async dismissAllPopups(): Promise<void> {
    const popupSelectors = [
      '//android.widget.Button[@resource-id="com.google.android.gms:id/cancel"]',
      '//android.widget.Button[contains(@text, "none of the above")]',
      '//android.widget.Button[contains(@text, "NONE OF THE ABOVE")]',
    ];

    let dismissed = 0;
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      let found = false;
      for (const sel of popupSelectors) {
        try {
          const els = await $$(sel);
          for (const el of els) {
            if (await el.isDisplayed()) {
              const txt = await el.getText();
              console.log(`[ViAppPage] Dismissing popup: "${txt}"`);
              await el.click();
              dismissed++;
              found = true;
              await sleep(500);
              break;
            }
          }
        } catch (_e) { /* not found */ }
      }
      if (!found) break;
    }

    console.log(dismissed > 0
      ? `[ViAppPage] Dismissed ${dismissed} popup(s)`
      : '[ViAppPage] No popups to dismiss');
  }

  private async waitForAppReady(timeoutMs = 30000): Promise<void> {
    console.log('[ViAppPage] Waiting for app to be ready...');
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const els = await $$('//android.widget.TextView | //android.widget.EditText | //android.view.View');
        for (const el of els) {
          try {
            if (await el.isDisplayed()) {
              const text = await el.getText();
              if (text && text.length > 0) {
                console.log(`[ViAppPage] App ready — found: "${text.substring(0, 40)}"`);
                return;
              }
            }
          } catch (_e) { /* inaccessible yet */ }
        }
      } catch (_e) { /* no elements yet */ }
      await sleep(500);
    }
    console.log('[ViAppPage] App-ready timeout — continuing anyway');
  }

  private async findMobileNumberField(): Promise<WebdriverIO.Element> {
    console.log('[ViAppPage] Looking for mobile number field...');
    await this.waitForAppReady();

    for (let i = 0; i < 5; i++) {
      try {
        const el = await $(Selectors.mobileNumberField);
        if (await el.isDisplayed()) {
          console.log('[ViAppPage] Found via primary selector');
          return el;
        }
      } catch (_e) { await sleep(500); }
    }

    try {
      const el = await $(Selectors.mobileNumberFieldAlt);
      if (await el.isDisplayed()) {
        console.log('[ViAppPage] Found via alt selector');
        return el;
      }
    } catch (_e) { /* continue */ }

    try {
      const els = await $$('//android.widget.TextView | //android.widget.EditText');
      for (const el of els) {
        if (await el.isDisplayed()) {
          const combined = ((await el.getText()) + (await el.getAttribute('hint') || '')).toLowerCase();
          if (combined.includes('mobile') || combined.includes('enter') || combined.includes('number')) {
            console.log(`[ViAppPage] Found via text/hint search`);
            return el;
          }
        }
      }
    } catch (_e) { /* continue */ }

    try {
      const els = await $$('//android.view.View');
      for (const el of els) {
        const desc = (await el.getAttribute('content-desc') || '').toLowerCase();
        if (desc.includes('enter') || desc.includes('mobile')) {
          console.log(`[ViAppPage] Found via content-desc: "${desc}"`);
          return el;
        }
      }
    } catch (_e) { /* continue */ }

    throw new Error('[ViAppPage] Could not find mobile number input field');
  }

  private async isOTPScreenVisible(): Promise<boolean> {
    try {
      const btn = await $(Selectors.loginWithOtpBtn);
      return await btn.isDisplayed();
    } catch (_e) {
      return false;
    }
  }

  private async readOTPDigitBoxes(): Promise<{ filledCount: number; otpValue: string }> {
    let filledCount = 0;
    let otpValue    = '';

    try {
      const boxes = await $$(Selectors.otpDigitBoxes);
      console.log(`[ViAppPage] Found ${boxes.length} OTP digit box(es)`);

      for (let i = 0; i < Math.min(4, boxes.length); i++) {
        const box = boxes[i];
        let value = '';

        try { value = await box.getText(); }                               catch (_e) {}
        if (!value) { try { value = await box.getValue(); }               catch (_e) {} }
        if (!value) { try { value = await box.getAttribute('text'); }     catch (_e) {} }
        if (!value) { try { value = await box.getAttribute('content-desc'); } catch (_e) {} }

        const digit   = (value || '').trim();
        const isEmpty = !digit || digit === '' || digit === ' ' || digit === 'null' || digit === 'undefined';

        console.log(`[ViAppPage] Box ${i + 1}: "${digit}" (filled: ${!isEmpty})`);

        if (!isEmpty) {
          filledCount++;
          otpValue += digit;
        }
      }
    } catch (_e) {
      console.warn('[ViAppPage] Could not read OTP boxes:', _e);
    }

    return { filledCount, otpValue };
  }

  private async waitForAutoFill(waitMs = 8000): Promise<string> {
    console.log(`[ViAppPage] Waiting up to ${waitMs / 1000}s for SIM auto-fill...`);
    const deadline = Date.now() + waitMs;

    while (Date.now() < deadline) {
      const { filledCount, otpValue } = await this.readOTPDigitBoxes();
      if (filledCount >= 4) {
        console.log(`[ViAppPage] ✅ All 4 digits auto-filled: ${otpValue}`);
        return otpValue;
      }
      if (filledCount > 0) console.log(`[ViAppPage] Auto-fill in progress (${filledCount}/4)...`);
      await sleep(500);
    }

    const { filledCount, otpValue } = await this.readOTPDigitBoxes();
    if (filledCount >= 4) return otpValue;

    console.log(`[ViAppPage] Auto-fill ended with ${filledCount}/4 digits — not fully filled`);
    return '';
  }

  private async enterOTPIntoBoxes(otp: string): Promise<void> {
    console.log(`[ViAppPage] Entering OTP manually: ${otp}`);
    const digits = otp.replace(/\D/g, '').split('');
    const boxes  = await $$(Selectors.otpDigitBoxes);
    console.log(`[ViAppPage] Found ${boxes.length} box(es) to fill`);

    for (let i = 0; i < Math.min(4, digits.length, boxes.length); i++) {
      try {
        const box = boxes[i];
        await box.waitForDisplayed({ timeout: 5000 });
        await box.click();
        await sleep(200);
        await box.setValue(digits[i]);
        console.log(`[ViAppPage] ✅ Digit ${i + 1} entered: ${digits[i]}`);
        await sleep(150);
      } catch (e: any) {
        console.warn(`[ViAppPage] setValue failed for box ${i + 1} — keyboard fallback`);
        try { await browser.keys([digits[i]]); } catch (_e) { /* ignore */ }
      }
    }
  }

  private async waitForFrontendOTP(): Promise<string> {
    if (!fs.existsSync(COMM_DIR)) fs.mkdirSync(COMM_DIR, { recursive: true });
    if (fs.existsSync(OTP_RESPONSE_FILE)) fs.unlinkSync(OTP_RESPONSE_FILE);

    const requestTimestamp = Date.now();
    fs.writeFileSync(OTP_REQUEST_FILE, JSON.stringify({
      timestamp: requestTimestamp,
      type: 'otp',
      message: 'Please enter the 4-digit OTP received on your mobile.',
    }, null, 2));

    console.log('[ViAppPage] 📱 OTP request written to frontend (timestamp: ' + requestTimestamp + ')');
    console.log('[ViAppPage] ⏳ Waiting for OTP pop-up to appear in frontend...');

    const maxWaitTime  = 60000;
    const pollInterval = 200;
    const deadline     = Date.now() + maxWaitTime;
    let lastCheckTime  = Date.now();

    while (Date.now() < deadline) {
      if (fs.existsSync(OTP_RESPONSE_FILE)) {
        try {
          const raw  = fs.readFileSync(OTP_RESPONSE_FILE, 'utf8');
          const data = JSON.parse(raw);
          const otp  = (data.otp || '').trim();

          if (/^\d{4,6}$/.test(otp)) {
            fs.unlinkSync(OTP_RESPONSE_FILE);
            if (fs.existsSync(OTP_REQUEST_FILE)) fs.unlinkSync(OTP_REQUEST_FILE);
            console.log(`[ViAppPage] ✅ OTP received from frontend: ${otp} (took ${Date.now() - requestTimestamp}ms)`);
            return otp;
          }
        } catch (_e) { /* file mid-write */ }
      }

      if (Date.now() - lastCheckTime >= 5000) {
        const elapsed = Math.round((Date.now() - requestTimestamp) / 1000);
        console.log(`[ViAppPage] ⏳ Still waiting for OTP... (${elapsed}s elapsed)`);
        lastCheckTime = Date.now();
      }

      await sleep(pollInterval);
    }

    throw new Error('[ViAppPage] ❌ OTP input timeout — user did not enter OTP within 60 seconds');
  }

  private async verifyLoggedInState(): Promise<boolean> {
    console.log('[ViAppPage] Verifying logged-in state...');
    try {
      const hamburger = await $(Selectors.hamburgerIcon);
      if (await hamburger.isDisplayed()) {
        console.log('[ViAppPage] ✅ Hamburger visible — user is logged in');
        return true;
      }
    } catch (_e) { /* continue */ }

    try {
      const els = await $$('//android.widget.TextView');
      for (const el of els) {
        const text = await el.getText().catch(() => '');
        if (['hi', 'welcome', 'dashboard', 'my account'].some(k => text.toLowerCase().includes(k))) {
          console.log(`[ViAppPage] ✅ Logged-in text found: "${text}"`);
          return true;
        }
      }
    } catch (_e) { /* continue */ }

    console.log('[ViAppPage] ❌ No logged-in indicators found');
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE POST-LOGIN HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /** Save screenshot and return filename */
  private async takeShot(msisdn: string, label: string): Promise<string> {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const filename = `ViApp_${msisdn}_${label}_${Date.now()}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    try {
      await browser.saveScreenshot(filepath);
      console.log(`[ViAppPage] 📸 ${label} → ${filename}`);
    } catch (_e) {
      console.warn(`[ViAppPage] ⚠️ Could not save screenshot: ${label}`);
    }
    return filename;
  }

  /** Read text from element via getText(), fallback to content-desc attribute */
  private async safeText(el: WebdriverIO.Element): Promise<string> {
    try {
      const t = await el.getText();
      if (t && t.trim()) return t.trim();
    } catch (_e) {}
    try {
      const cd = await el.getAttribute('content-desc');
      if (cd && cd.trim()) return cd.trim();
    } catch (_e) {}
    try {
      const tv = await el.getAttribute('text');
      if (tv && tv.trim()) return tv.trim();
    } catch (_e) {}
    return '';
  }

  /** Extract numeric part from a string like "₹299" or "Rs 199" */
  private toNumeric(value: string): string {
    if (!value) return '';
    const match = value.replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? match[0] : '';
  }

  /** Try the first selector in a list that exists */
  private async findFirst(xpaths: readonly string[], timeoutMs = 5000): Promise<WebdriverIO.Element | null> {
    for (const xp of xpaths) {
      try {
        const el     = await $(xp);
        const exists = await el.waitForExist({ timeout: timeoutMs }).catch(() => false);
        if (exists) return el;
      } catch (_e) { /* try next */ }
    }
    return null;
  }

  /** Scroll down once and retry finding element */
  private async scrollAndFind(xpaths: readonly string[], maxScrolls = 4): Promise<WebdriverIO.Element | null> {
    for (let i = 0; i < maxScrolls; i++) {
      const el = await this.findFirst(xpaths, 2000);
      if (el) return el;
      try { await browser.execute('mobile: scroll', { direction: 'down' }); } catch (_e) {}
      await sleep(800);
    }
    return null;
  }

  /** Press Android back button */
  private async pressBack(): Promise<void> {
    try { await browser.back(); } catch (_e) {
      try { await browser.pressKeyCode(4); } catch (_e2) { /* ignore */ }
    }
    await sleep(1200);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC STEPS (login – DO NOT MODIFY)
  // ══════════════════════════════════════════════════════════════════════════

  static getDeviceSerial(): string { return DEVICE_SERIAL; }
  static getAllDevices(): string[]  { return ALL_DEVICES; }

  /** Step 1 — Launch Vi App via ADB monkey */
  async launchApp(): Promise<void> {
    console.log(`[ViAppPage] Step 1: Launching Vi App on device ${DEVICE_SERIAL}...`);
    const cmd = `adb -s ${DEVICE_SERIAL} shell monkey -p ${VI_APP_PACKAGE} -c android.intent.category.LAUNCHER 1`;
    try {
      const out = execSync(cmd, { encoding: 'utf8' });
      console.log(`[ViAppPage] ADB output:\n${out}`);
    } catch (err: any) {
      throw new Error(`[ViAppPage] Launch failed on device ${DEVICE_SERIAL}: ${err.message}`);
    }
    await sleep(5000);
    console.log('[ViAppPage] Vi App launched successfully');
  }

  /** Step 2 — Enter MSISDN using the on-screen numeric keypad */
  async enterMSISDN(msisdn: string): Promise<void> {
    console.log(`[ViAppPage] Step 2: Entering MSISDN ${msisdn}...`);

    const mobileField = await this.findMobileNumberField();
    await mobileField.waitForDisplayed({ timeout: 15000 });
    console.log('[ViAppPage] Mobile number field visible');

    await mobileField.click();
    await sleep(1000);
    await this.dismissAllPopups();

    try {
      for (let i = 0; i < 15; i++) { await browser.keys(['Backspace']); await sleep(30); }
    } catch (_e) { /* ignore */ }

    const keypadSelector: Record<string, string> = {
      '0': '//android.widget.Button[@content-desc="0"]',
      '1': '//android.widget.Button[@content-desc="1"]',
      '2': '//android.widget.Button[@content-desc="2"]',
      '3': '//android.widget.Button[@content-desc="3"]',
      '4': '//android.widget.Button[@content-desc="4"]',
      '5': '//android.widget.Button[@content-desc="5"]',
      '6': '//android.widget.Button[@content-desc="6"]',
      '7': '//android.widget.Button[@content-desc="7"]',
      '8': '//android.widget.Button[@content-desc="8"]',
      '9': '//android.widget.Button[@content-desc="9"]',
    };

    for (const digit of msisdn) {
      let tapped = false;
      try {
        const btn = await $(keypadSelector[digit]);
        if (await btn.isDisplayed()) { await btn.click(); tapped = true; await sleep(100); }
      } catch (_e) { /* try keyboard */ }
      if (!tapped) { await browser.keys([digit]); await sleep(100); }
    }

    console.log(`[ViAppPage] MSISDN entered: ${msisdn}`);
    try { await browser.hideKeyboard(); } catch (_e) { /* already hidden */ }
  }

  /** Step 3 — Click "send OTP", handle OTP screen, click "login with OTP" */
  async submitAndLogin(otp?: string): Promise<void> {
    console.log('[ViAppPage] Step 3: Clicking "send OTP"...');
    await this.dismissAllPopups();

    const sendOtp = await $(Selectors.sendOtpBtn);
    await sendOtp.waitForDisplayed({ timeout: 15000 });
    await sendOtp.click();
    console.log('[ViAppPage] "send OTP" clicked — waiting for OTP screen or auto-login...');
    await sleep(50000);

    const otpScreenVisible = await this.isOTPScreenVisible();

    if (otpScreenVisible) {
      console.log('[ViAppPage] ✅ OTP screen detected');
      const autoFilledOtp = await this.waitForAutoFill(8000);

      if (autoFilledOtp) {
        console.log(`[ViAppPage] ✅ SIM auto-filled OTP: ${autoFilledOtp} — proceeding to login`);
      } else {
        console.log('[ViAppPage] 📵 OTP boxes are empty — requesting manual OTP via frontend pop-up');
        const manualOtp = otp || await this.waitForFrontendOTP();
        await this.enterOTPIntoBoxes(manualOtp);
      }

      console.log('[ViAppPage] Clicking "login with OTP"...');
      const loginBtn = await $(Selectors.loginWithOtpBtn);
      await loginBtn.waitForDisplayed({ timeout: 20000 });
      await loginBtn.click();
      await sleep(50000);

      const isLoggedIn = await this.verifyLoggedInState();
      if (!isLoggedIn) throw new Error('[ViAppPage] ❌ Login failed after OTP submission');
      console.log('[ViAppPage] ✅ Login successful via OTP');

    } else {
      console.log('[ViAppPage] OTP screen not shown — checking for auto-login...');
      const isLoggedIn = await this.verifyLoggedInState();
      if (!isLoggedIn) throw new Error('[ViAppPage] ❌ Auto-login failed — home screen not detected');
      console.log('[ViAppPage] ✅ Auto-login successful (no OTP screen needed)');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST-LOGIN STEPS (new implementation per doc)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Screenshot 1 — Capture home screen immediately after login.
   * Notes the MSISDN label displayed (content-desc like "96724 17412").
   */
  private async captureScreenshot1_HomeAfterLogin(msisdn: string): Promise<string> {
    console.log('[ViAppPage] 📸 Screenshot 1 — Home screen after login');
    await sleep(2000);

    // Note the displayed MSISDN label (content-desc changes per number)
    let homeMsisdn = '';
    try {
      // The MSISDN appears as content-desc on a TextView; try to find one whose
      // content-desc contains digits matching our MSISDN (spaces may be inserted)
      const stripped = msisdn.replace(/\s/g, '');
      const els = await $$('//android.widget.TextView[@content-desc]');
      for (const el of els) {
        const cd = (await el.getAttribute('content-desc') || '').replace(/\s/g, '');
        if (cd.includes(stripped) || stripped.includes(cd.replace(/\D/g, ''))) {
          homeMsisdn = await this.safeText(el);
          console.log(`[ViAppPage] Home MSISDN label: "${homeMsisdn}"`);
          break;
        }
      }
    } catch (_e) { /* non-fatal */ }

    return homeMsisdn;
  }

  /**
   * Screenshot 2 & 3 — Read available data and ends-on date from home screen card.
   * Takes Screenshot 2 (number verified) then Screenshot 3 (home card data).
   */
  private async captureScreenshots2And3_HomeData(
    msisdn: string,
    screenshots: string[]
  ): Promise<{ availableData: string; endsOn: string }> {
    console.log('[ViAppPage] 📸 Screenshot 2 — Number verified');
    screenshots.push(await this.takeShot(msisdn, 'SS2_home_number_verified'));

    // Read available data (MB/GB text on home card)
    let availableData = '';
    try {
      const dataEl = await $(Selectors.homeAvailableDataPrimary);
      await dataEl.waitForExist({ timeout: 5000 }).catch(() => false);
      availableData = await this.safeText(dataEl);
      console.log(`[ViAppPage] Available data: "${availableData}"`);
    } catch (_e) { console.warn('[ViAppPage] Available data element not found'); }

    // Read ends-on date
    let endsOn = '';
    try {
      const endsEl = await $(Selectors.homeEndsOn);
      await endsEl.waitForExist({ timeout: 5000 }).catch(() => false);
      endsOn = await this.safeText(endsEl);
      console.log(`[ViAppPage] Ends on: "${endsOn}"`);
    } catch (_e) { console.warn('[ViAppPage] Ends-on date element not found'); }

    console.log('[ViAppPage] 📸 Screenshot 3 — Home card data');
    screenshots.push(await this.takeShot(msisdn, 'SS3_home_card_data'));

    return { availableData, endsOn };
  }

  /**
   * Tap the active pack card on the home screen to navigate to
   * "active pack details & benefits" screen.
   * Uses structural xpath first (from doc), falls back to content-desc variants.
   */
  private async tapActivePackCard(): Promise<void> {
    console.log('[ViAppPage] Tapping active pack card → active pack details...');
    await sleep(1000);

    // Primary: structural xpath documented (elementId 000018c2)
    try {
      const el = await $(Selectors.activePackCard);
      const exists = await el.waitForExist({ timeout: 5000 }).catch(() => false);
      if (exists && await el.isDisplayed()) {
        await el.click();
        console.log('[ViAppPage] ✅ Active pack card tapped (structural xpath)');
        await sleep(3000);
        return;
      }
    } catch (_e) { /* fall through */ }

    // Fallback: content-desc variants + scroll
    const el = await this.scrollAndFind(Selectors.activePackCardAlt, 4);
    if (el) {
      await el.click();
      console.log('[ViAppPage] ✅ Active pack card tapped (fallback)');
      await sleep(3000);
    } else {
      console.warn('[ViAppPage] ⚠️ Active pack card not found — taking diagnostic screenshot');
      await browser.saveScreenshot(
        path.join(SCREENSHOTS_DIR, `diag_pack_card_not_found_${Date.now()}.png`)
      ).catch(() => {});
    }
  }

  /**
   * Screenshot 4 — Read all pack details from "active pack details & benefits" screen.
   * Verifies: lastRechargeAmount vs expectedMRP, packEndsOnDate, mainBalance, serviceValidity.
   */
  private async captureScreenshot4_PackDetails(
    msisdn: string,
    expectedMRP: string,
    screenshots: string[]
  ): Promise<{
    lastRechargeAmount: string;
    lastRechargeAmountNumeric: string;
    packEndsOnDate: string;
    mainBalance: string;
    serviceValidity: string;
    mrpMatched: boolean;
  }> {
    console.log('[ViAppPage] 📸 Screenshot 4 — Active pack details & benefits screen');

    // Wait for the header to confirm we're on the right screen
    const header = await this.findFirst(Selectors.activePackDetailsHeader, 8000);
    if (header) {
      console.log('[ViAppPage] ✅ "active pack details & benefits" screen confirmed');
    } else {
      console.warn('[ViAppPage] ⚠️ Pack details header not found — continuing');
    }

    // Scroll down once to reveal all details
    try { await browser.execute('mobile: scroll', { direction: 'down' }); } catch (_e) {}
    await sleep(1000);

    // ── Last recharge amount ───────────────────────────────────────────────
    let lastRechargeAmount = '';
    const lastRechargeEl = await this.scrollAndFind(Selectors.lastRechargeAmount, 3);
    if (lastRechargeEl) {
      lastRechargeAmount = await this.safeText(lastRechargeEl);
      console.log(`[ViAppPage] Last recharge amount: "${lastRechargeAmount}"`);
    } else {
      console.warn('[ViAppPage] ⚠️ Last recharge amount not found');
    }

    // ── Pack ends on date ──────────────────────────────────────────────────
    let packEndsOnDate = '';
    const endsEl = await this.scrollAndFind(Selectors.packEndsOnDate, 3);
    if (endsEl) {
      packEndsOnDate = await this.safeText(endsEl);
      console.log(`[ViAppPage] Pack ends on: "${packEndsOnDate}"`);
    } else {
      console.warn('[ViAppPage] ⚠️ Pack ends-on date not found');
    }

    // ── Main balance ───────────────────────────────────────────────────────
    let mainBalance = '';
    try {
      const mbEl = await $(Selectors.mainBalance);
      await mbEl.waitForExist({ timeout: 5000 }).catch(() => false);
      mainBalance = await this.safeText(mbEl);
      console.log(`[ViAppPage] Main balance: "${mainBalance}"`);
    } catch (_e) { console.warn('[ViAppPage] ⚠️ Main balance not found'); }

    // ── Service validity ───────────────────────────────────────────────────
    let serviceValidity = '';
    try {
      const svEl = await $(Selectors.serviceValidity);
      await svEl.waitForExist({ timeout: 5000 }).catch(() => false);
      serviceValidity = await this.safeText(svEl);
      console.log(`[ViAppPage] Service validity: "${serviceValidity}"`);
    } catch (_e) { console.warn('[ViAppPage] ⚠️ Service validity not found'); }

    // ── MRP match ─────────────────────────────────────────────────────────
    const lastRechargeAmountNumeric = this.toNumeric(lastRechargeAmount);
    const expectedMRPNumeric        = this.toNumeric(expectedMRP);
    const mrpMatched = !!(lastRechargeAmountNumeric && expectedMRPNumeric &&
                          lastRechargeAmountNumeric === expectedMRPNumeric);

    console.log(mrpMatched
      ? `[ViAppPage] ✅ MRP match: ₹${lastRechargeAmountNumeric} == ₹${expectedMRPNumeric}`
      : `[ViAppPage] ✗ MRP mismatch: actual ₹${lastRechargeAmountNumeric} vs expected ₹${expectedMRPNumeric}`);

    screenshots.push(await this.takeShot(msisdn, 'SS4_pack_details'));

    return { lastRechargeAmount, lastRechargeAmountNumeric, packEndsOnDate, mainBalance, serviceValidity, mrpMatched };
  }

  /**
   * Screenshot 4.1 — Tap "repeat recharge", read pack title MRP + benefit text,
   * then press back once.
   */
  private async captureScreenshot4_1_RepeatRecharge(
    msisdn: string,
    expectedBenefit: string | undefined,
    screenshots: string[]
  ): Promise<{
    repeatRechargePackTitle: string;
    benefitText: string;
    benefitMatched: boolean;
  }> {
    console.log('[ViAppPage] Tapping "repeat recharge" button...');

    // Tap repeat recharge (scroll to find if needed)
    try {
      const rrBtn = await $(Selectors.repeatRechargeBtn);
      const exists = await rrBtn.waitForExist({ timeout: 8000 }).catch(() => false);
      if (exists) {
        await rrBtn.click();
        console.log('[ViAppPage] ✅ Repeat recharge tapped');
      } else {
        console.warn('[ViAppPage] ⚠️ Repeat recharge button not visible — scrolling to find...');
        const el = await this.scrollAndFind([Selectors.repeatRechargeBtn], 4);
        if (el) { await el.click(); console.log('[ViAppPage] ✅ Repeat recharge tapped (after scroll)'); }
        else     { console.warn('[ViAppPage] ⚠️ Repeat recharge button not found — skipping'); }
      }
    } catch (_e) {
      console.warn('[ViAppPage] ⚠️ Error tapping repeat recharge:', _e);
    }
    await sleep(3000);

    // ── Pack title (e.g. "₹209 pack details") ────────────────────────────
    let repeatRechargePackTitle = '';
    const titleEl = await this.findFirst(Selectors.repeatRechargePackTitle, 5000);
    if (titleEl) {
      repeatRechargePackTitle = await this.safeText(titleEl);
      console.log(`[ViAppPage] Repeat recharge pack title: "${repeatRechargePackTitle}"`);
    } else {
      console.warn('[ViAppPage] ⚠️ Repeat recharge pack title not found');
    }

    // ── Benefit text (structural xpath from doc, with fallbacks) ──────────
    let benefitText = '';
    try {
      const benefitEl = await $(Selectors.benefitTextFull);
      const exists    = await benefitEl.waitForExist({ timeout: 5000 }).catch(() => false);
      if (exists) {
        benefitText = await this.safeText(benefitEl);
        console.log(`[ViAppPage] Benefit text (structural): "${benefitText}"`);
      }
    } catch (_e) { /* try fallback */ }

    if (!benefitText) {
      const fbEl = await this.scrollAndFind(Selectors.benefitTextFallback, 3);
      if (fbEl) {
        benefitText = await this.safeText(fbEl);
        console.log(`[ViAppPage] Benefit text (fallback): "${benefitText}"`);
      } else {
        console.warn('[ViAppPage] ⚠️ Benefit text not found');
      }
    }

    // ── Benefit match ─────────────────────────────────────────────────────
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const a    = norm(benefitText);
    const e    = norm(expectedBenefit || '');
    const benefitMatched = !!(a && e && (a.includes(e) || e.includes(a) || a === e));

    console.log(benefitMatched
      ? `[ViAppPage] ✅ Benefit match`
      : `[ViAppPage] ✗ Benefit mismatch — actual: "${a}" | expected: "${e}"`);

    screenshots.push(await this.takeShot(msisdn, 'SS4_1_repeat_recharge'));

    // ── Press back once (return to pack details screen) ───────────────────
    console.log('[ViAppPage] Pressing back → returning to pack details...');
    await this.pressBack();

    return { repeatRechargePackTitle, benefitText, benefitMatched };
  }

  /**
   * Screenshot 5 — After pressing back from repeat-recharge screen.
   * Screenshot 6 — Tap "view history" → recharge history screen.
   */
  private async captureScreenshots5And6_History(
    msisdn: string,
    screenshots: string[]
  ): Promise<void> {
    console.log('[ViAppPage] 📸 Screenshot 5 — After back from repeat recharge');
    screenshots.push(await this.takeShot(msisdn, 'SS5_after_back'));

    // Tap "view history"
    console.log('[ViAppPage] Tapping "view history"...');
    let viewHistoryTapped = false;

    try {
      const el = await $(Selectors.viewHistoryBtn);
      const exists = await el.waitForExist({ timeout: 5000 }).catch(() => false);
      if (exists && await el.isDisplayed()) {
        await el.click();
        viewHistoryTapped = true;
        console.log('[ViAppPage] ✅ View history tapped (primary)');
      }
    } catch (_e) { /* try alt */ }

    if (!viewHistoryTapped) {
      try {
        const el = await $(Selectors.viewHistoryBtnAlt);
        const exists = await el.waitForExist({ timeout: 5000 }).catch(() => false);
        if (exists) {
          await el.click();
          viewHistoryTapped = true;
          console.log('[ViAppPage] ✅ View history tapped (alt)');
        }
      } catch (_e) { /* non-fatal */ }
    }

    if (!viewHistoryTapped) {
      console.warn('[ViAppPage] ⚠️ View history button not found — taking diagnostic shot');
      screenshots.push(await this.takeShot(msisdn, 'DIAG_view_history_not_found'));
      return;
    }

    await sleep(2000);

    // Confirm recharge history screen
    const historyHeader = await this.findFirst(Selectors.rechargeHistoryHeader, 5000);
    if (historyHeader) {
      console.log('[ViAppPage] ✅ Recharge history screen confirmed');
    } else {
      console.warn('[ViAppPage] ⚠️ Recharge history header not found');
    }

    // Note scroll content (for reporting)
    try {
      const scrollEl = await $(Selectors.rechargeHistoryScroll);
      const historyText = await this.safeText(scrollEl);
      if (historyText) console.log(`[ViAppPage] Recharge history content: "${historyText.substring(0, 100)}..."`);
    } catch (_e) { /* non-fatal */ }

    console.log('[ViAppPage] 📸 Screenshot 6 — Recharge history screen');
    screenshots.push(await this.takeShot(msisdn, 'SS6_recharge_history'));
  }

  /**
   * Screenshot 7 — Navigate back to home (2× back), then hamburger → My Account.
   * Notes MSISDN with Prepaid/Postpaid label. Then logs out with confirmation.
   */
  private async captureScreenshot7_AndLogout(
    msisdn: string,
    screenshots: string[]
  ): Promise<string> {
    // Press back twice to return to home screen
    console.log('[ViAppPage] Pressing back ×2 → home screen...');
    await this.pressBack();
    await this.pressBack();
    await sleep(1500);

    // Tap hamburger → My Account screen
    console.log('[ViAppPage] Tapping hamburger → My Account...');
    try {
      const hamburger = await $(Selectors.hamburgerIcon);
      await hamburger.waitForDisplayed({ timeout: 10000 });
      await hamburger.click();
      console.log('[ViAppPage] ✅ Hamburger tapped');
      await sleep(2000);
    } catch (_e) {
      console.warn('[ViAppPage] ⚠️ Hamburger not found');
    }

    console.log('[ViAppPage] 📸 Screenshot 7 — My Account screen');
    screenshots.push(await this.takeShot(msisdn, 'SS7_my_account'));

    // Read MSISDN with plan type (Prepaid/Postpaid)
    let msisdnPlanType = '';
    try {
      const el = await $(Selectors.msisdnPlanType);
      await el.waitForExist({ timeout: 5000 }).catch(() => false);
      msisdnPlanType = await this.safeText(el);
      console.log(`[ViAppPage] MSISDN plan type: "${msisdnPlanType}"`);
    } catch (_e) {
      console.warn('[ViAppPage] ⚠️ MSISDN plan type element not found');
    }

    // Scroll down to find logout button
    console.log('[ViAppPage] Scrolling to logout button...');
    const logoutEl = await this.scrollAndFind([Selectors.logoutBtn], 5);
    if (logoutEl) {
      await logoutEl.click();
      console.log('[ViAppPage] ✅ Logout button tapped');
      await sleep(1500);

      // Verify "logging out?" popup and tap "yes, logout"
      try {
        const popupText = await $(Selectors.loggingOutConfirmText);
        await popupText.waitForExist({ timeout: 5000 }).catch(() => false);
        console.log('[ViAppPage] "logging out?" popup appeared');
      } catch (_e) { /* may not appear on all builds */ }

      const yesEl = await this.findFirst(Selectors.yesLogoutBtn, 5000);
      if (yesEl) {
        await yesEl.click();
        console.log('[ViAppPage] ✅ Logout confirmed — "yes, logout" tapped');
        await sleep(2000);
      } else {
        console.warn('[ViAppPage] ⚠️ "yes, logout" confirm button not found');
      }
    } else {
      // Fallback: ADB force-stop
      console.warn('[ViAppPage] ⚠️ Logout button not found — force-stopping via ADB');
      try {
        execSync(`adb -s ${DEVICE_SERIAL} shell am force-stop ${VI_APP_PACKAGE}`, { encoding: 'utf8' });
        console.log('[ViAppPage] App force-stopped (effective logout)');
      } catch (adbErr: any) {
        console.warn(`[ViAppPage] ADB force-stop failed: ${adbErr.message}`);
      }
    }

    return msisdnPlanType;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC: FULL FLOW
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Complete Vi App UAT flow per the specification document:
   *
   * Step 1  – Launch app (ADB monkey)
   * Step 2  – Handle existing login (logout if already logged in)
   * Step 2.2 – Enter MSISDN
   * Step 3  – OTP + login
   * SS 1    – Screenshot 1: home screen after login, note MSISDN label
   * SS 2    – Screenshot 2: number verified
   * SS 3    – Screenshot 3: home card (available data, ends-on date)
   * Tap     – Open active pack details & benefits
   * SS 4    – Screenshot 4: verify last recharge MRP, pack ends-on, main balance, service validity
   * SS 4.1  – Tap repeat recharge → screenshot 4.1: verify pack title + benefit text → back
   * SS 5    – Screenshot 5: after back
   * SS 6    – Tap view history → screenshot 6: recharge history screen
   * SS 7    – Back ×2 → hamburger → My Account → screenshot 7 → logout with confirmation
   *
   * @param msisdn        Mobile number from Sheet1
   * @param expectedMRP   Recharge MRP from Sheet1 (used for MRP match check)
   * @param expectedBenefit Benefit (Open) from matched Sheet2 plan (optional)
   * @param otp           Manual OTP override (optional)
   */
  async runViAppFlow(
    msisdn: string,
    expectedMRP?: string,
    expectedBenefit?: string,
    otp?: string
  ): Promise<ViAppFlowResult> {
    const screenshots: string[] = [];
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    const result: ViAppFlowResult = { msisdn, screenshots };

    try {
      console.log(`\n[ViAppPage] 🚀 Starting Vi App UAT flow — MSISDN: ${msisdn}, Expected MRP: ${expectedMRP ?? '(none)'}`);

      // Step 1: Launch
      await this.launchApp();

      //Step 2.2: Enter MSISDN 
      await this.enterMSISDN(msisdn);

       // ── Step 2: If already logged in, logout first 
      // await this.handleExistingLoginIfAny(msisdn);

      // ── Step 3: OTP + login ───────────────────────────────────────────────
      await this.submitAndLogin(otp);

      // ── Screenshot 1: home screen, note MSISDN label ──────────────────────
      result.homeMsisdn = await this.captureScreenshot1_HomeAfterLogin(msisdn);
      screenshots.push(await this.takeShot(msisdn, 'SS1_home_after_login'));

      // ── Screenshots 2 & 3: home card data ────────────────────────────────
      const homeData = await this.captureScreenshots2And3_HomeData(msisdn, screenshots);
      result.homeAvailableData = homeData.availableData;
      result.homeEndsOn        = homeData.endsOn;

      // ── Tap active pack card → pack details screen ─────────────────────
      await this.tapActivePackCard();

      // ── Screenshot 4: pack details verification ───────────────────────────
      const packDetails = await this.captureScreenshot4_PackDetails(
        msisdn, expectedMRP ?? '', screenshots
      );
      result.lastRechargeAmount        = packDetails.lastRechargeAmount;
      result.lastRechargeAmountNumeric = packDetails.lastRechargeAmountNumeric;
      result.packEndsOnDate            = packDetails.packEndsOnDate;
      result.mainBalance               = packDetails.mainBalance;
      result.serviceValidity           = packDetails.serviceValidity;
      result.mrpMatched                = packDetails.mrpMatched;

      // ── Screenshot 4.1: repeat recharge → benefit text → back ────────────
      const rrDetails = await this.captureScreenshot4_1_RepeatRecharge(
        msisdn, expectedBenefit, screenshots
      );
      result.repeatRechargePackTitle = rrDetails.repeatRechargePackTitle;
      result.benefitText             = rrDetails.benefitText;
      result.benefitMatched          = rrDetails.benefitMatched;

      // ── Screenshots 5 & 6: view history ──────────────────────────────────
      await this.captureScreenshots5And6_History(msisdn, screenshots);

      // ── Screenshot 7 + logout ─────────────────────────────────────────────
      result.msisdnPlanType = await this.captureScreenshot7_AndLogout(msisdn, screenshots);

      result.screenshots = [...screenshots];
      console.log(`[ViAppPage] ✅ Vi App UAT flow completed — MSISDN: ${msisdn}`);

    } catch (err: any) {
      result.error       = err?.message ?? String(err);
      result.screenshots = [...screenshots];
      console.error(`[ViAppPage] ❌ Flow failed for ${msisdn}: ${result.error}`);

      // Best-effort screenshot on failure
      try {
        const fp = path.join(SCREENSHOTS_DIR, `FAIL_${msisdn}_${Date.now()}.png`);
        await browser.saveScreenshot(fp);
        result.screenshots.push(path.basename(fp));
      } catch (_e) {}
    }

    return result;
  }

  /**
   * If the app opens to the home screen (already logged in), logout first.
   * Mirrors Step 2.1 from the document.
   */
  private async handleExistingLoginIfAny(msisdn: string): Promise<void> {
    console.log('[ViAppPage] Step 2: Checking if already logged in...');
    await sleep(3000);

    // Detect home screen — hamburger visible = logged in
    let isLoggedIn = false;
    try {
      const hamburger = await $(Selectors.hamburgerIcon);
      isLoggedIn = await hamburger.isDisplayed({ timeout: 5000 }).catch(() => false);
    } catch (_e) {}

    if (!isLoggedIn) {
      // Also check for known MSISDN label pattern
      try {
        const els = await $$('//android.widget.TextView[@content-desc]');
        for (const el of els) {
          const cd = await el.getAttribute('content-desc') || '';
          if (/\d{5}\s\d{5}/.test(cd) || /\d{10}/.test(cd.replace(/\s/g, ''))) {
            isLoggedIn = true;
            break;
          }
        }
      } catch (_e) {}
    }

    if (!isLoggedIn) {
      console.log('[ViAppPage] ✅ Login screen showing — no existing session');
      return;
    }

    console.log('[ViAppPage] ⚠️ Already logged in — performing Step 2.1 logout...');

    // Tap hamburger → My Account
    try {
      const hamburger = await $(Selectors.hamburgerIcon);
      await hamburger.waitForDisplayed({ timeout: 10000 });
      await hamburger.click();
      await sleep(2000);
    } catch (_e) {
      console.warn('[ViAppPage] Could not tap hamburger for pre-login logout');
      return;
    }

    // Scroll to logout
    const logoutEl = await this.scrollAndFind([Selectors.logoutBtn], 5);
    if (!logoutEl) {
      console.warn('[ViAppPage] Logout button not found during pre-login cleanup');
      return;
    }

    await logoutEl.click();
    await sleep(1500);

    // Confirm "yes, logout"
    const yesEl = await this.findFirst(Selectors.yesLogoutBtn, 5000);
    if (yesEl) {
      await yesEl.click();
      console.log('[ViAppPage] ✅ Pre-login logout confirmed');
      await sleep(3000);
    } else {
      console.warn('[ViAppPage] ⚠️ Logout confirm button not found');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY / STANDALONE HELPERS (kept for backward compat)
  // ══════════════════════════════════════════════════════════════════════════

  async logout(): Promise<void> {
    console.log('[ViAppPage] logout() called...');
    try {
      const btn = await $(Selectors.logoutBtn);
      await btn.waitForDisplayed({ timeout: 15000 });
      await btn.click();
      await sleep(2000);
      console.log('[ViAppPage] ✅ Logged out');
    } catch (_e) {
      console.warn('[ViAppPage] ⚠️ Logout button not found — force-stopping via ADB');
      try {
        execSync(`adb -s ${DEVICE_SERIAL} shell am force-stop ${VI_APP_PACKAGE}`, { encoding: 'utf8' });
        await sleep(1000);
      } catch (adbErr: any) {
        console.warn(`[ViAppPage] ADB force-stop failed: ${adbErr.message}`);
      }
    }
  }

  uninstallApp(): void {
    console.log(`[ViAppPage] Uninstalling Vi App from device ${DEVICE_SERIAL}...`);
    try {
      const out = execSync(`adb -s ${DEVICE_SERIAL} uninstall ${VI_APP_PACKAGE}`, { encoding: 'utf8' });
      console.log(`[ViAppPage] Uninstall: ${out.trim()}`);
    } catch (err: any) {
      console.warn(`[ViAppPage] Uninstall warning: ${err.message}`);
    }
  }
}