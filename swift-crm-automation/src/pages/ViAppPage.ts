
// ViAppPage.ts - Updated with precise SMS and link handling flow

import { $, $$, browser } from '@wdio/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/** Drop-in replacement for browser.pause() */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// ─── ADB / device detection ─────────────────────────────────────────────────
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
  DEVICE_SERIAL = process.env.DEVICE_SERIAL || 'ZA222V9QNF';
  console.log(`[ViAppPage] Using fallback device: ${DEVICE_SERIAL}`);
}

const ALL_DEVICES = detectedDevices;

/** Sender address for Vi recharge/care notifications */
const SMS_SENDER = 'VK-ViCARE';
const VI_APP_PACKAGE = 'com.mventus.selfcare.activity';

// ─── Screenshots directory ───────────────────────────────────────────────────
const SCREENSHOTS_DIR = path.resolve('./screenshots');

// ─── Selectors ───────────────────────────────────────────────────────────────
// ─── Selectors ───────────────────────────────────────────────────────────────
const Selectors = {
  // ── SMS & Link Navigation ──────────────────────────────────────────────
  smsMessageScreen: '//android.widget.TextView[contains(@text, "VK-ViCARE")]',
  
  // ── Home screen ──────────────────────────────────────────────────────────
  // Updated to match the actual content description from your screenshot
  activePackCard: '//android.view.ViewGroup[@content-desc="1 GB, available, Unlimited, ends on 12 Aug, 2026"]',
  activePackCardPartial: '//android.view.ViewGroup[contains(@content-desc, "Unlimited")]',
  rechargeNowBtn: '//android.widget.TextView[@text="recharge now"]',
  
  // ── Active pack elements ──────────────────────────────────────────────
  endsOnText: '//android.widget.TextView[@text="ends on"]',
  unlimitedPlan: '//android.widget.TextView[contains(@text, "Unlimited")]',
  
  // ── Active pack details screen ──────────────────────────────────────────
  lastRechargeText: '//android.widget.TextView[@text="last recharge"]',
  lastRechargeLabel: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]//android.widget.TextView[1]',
  lastRechargeAmount: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]//android.widget.TextView[2]',
  packEndsOnDate: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]//android.widget.TextView[3]',
  mainBalance: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[4]/android.view.ViewGroup[1]',
  serviceValidity: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[4]/android.view.ViewGroup[2]',

  // ── View History ──────────────────────────────────────────────────────────
  viewHistoryBtn: '//android.widget.TextView[@text="view history"]',
  viewHistoryBtnAlt: '//*[@content-desc="view history"]',
  rechargeHistoryHeader: '//android.view.View[@text="recharge history"]',

  // ── Repeat Recharge ──────────────────────────────────────────────────────
  repeatBtn: '(//android.widget.TextView[@text="repeat"])[1]',

  // ── Pack details after repeat click ─────────────────────────────────────
  packDetailsHeader: '//android.view.View[@text="pack details"]',
  packDetailsContent: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmsVerificationResult {
  found: boolean;
  matchedNotification: boolean;
  dateIsToday: boolean;
  smsBody: string;
  smsDate: string;
  extractedLink: string;
  error?: string;
}

export interface PackDetails {
  lastRechargeLabel?: string;
  lastRechargeAmount: string;
  lastRechargeAmountNumeric: string;
  packEndsOnDate: string;
  mainBalance: string;
  serviceValidity: string;
}

export interface RepeatRechargeDetails {
  packTitle: string;
  benefitText: string;
}

export interface ViAppFlowResult {
  msisdn: string;
  sms?: SmsVerificationResult;
  homeMsisdn?: string;
  homeAvailableData?: string;
  homeEndsOn?: string;
  pack?: PackDetails;
  mrpMatched?: boolean;
  repeatRecharge?: RepeatRechargeDetails;
  benefitMatched?: boolean;
  smsDateIsToday?: boolean;
  smsMatched?: boolean;
  screenshots: string[];
  error?: string;
}

export interface ViAppPlanInfo {
  newMRP: string;
  benefit: string;
  rechargeNotification: string;
}

// ─── Page Object ─────────────────────────────────────────────────────────────

export class ViAppPage {

  // ══════════════════════════════════════════════════════════════════════════
  // GENERIC HELPERS
  // ══════════════════════════════════════════════════════════════════════════

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

  private toNumeric(value: string): string {
    if (!value) return '';
    const match = value.replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? match[0] : '';
  }

  private async findFirst(xpaths: readonly string[], timeoutMs = 5000): Promise<WebdriverIO.Element | null> {
    for (const xp of xpaths) {
      try {
        const el = await $(xp);
        const exists = await el.waitForExist({ timeout: timeoutMs }).catch(() => false);
        if (exists) return el;
      } catch (_e) { /* try next */ }
    }
    return null;
  }

  private async scrollDown(): Promise<void> {
    try {
      await browser.execute('mobile: scroll', { direction: 'down' });
    } catch (_e) {
      try {
        await browser.touchAction([
          { action: 'press', x: 500, y: 800 },
          { action: 'moveTo', x: 500, y: 200 },
          { action: 'release' }
        ]);
      } catch (_e2) {}
    }
    await sleep(500);
  }

  private async pressBack(): Promise<void> {
    try { 
      await browser.back(); 
    } catch (_e) {
      try { 
        await browser.pressKeyCode(4); 
      } catch (_e2) { 
        // ignore 
      }
    }
    await sleep(1000);
  }

  static getDeviceSerial(): string { return DEVICE_SERIAL; }
  static getAllDevices(): string[] { return ALL_DEVICES; }

  // ══════════════════════════════════════════════════════════════════════════
  // ADB HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private adbShell(cmd: string): string {
    try {
      return execSync(`adb -s ${DEVICE_SERIAL} shell ${cmd}`, { encoding: 'utf8' });
    } catch (err: any) {
      console.warn(`[ViAppPage] ⚠️ ADB shell command failed: ${cmd} — ${err.message}`);
      return '';
    }
  }

  /** Launch Vi App directly using monkey command */
  private async launchViApp(): Promise<void> {
    console.log(`[ViAppPage] Launching Vi App via monkey...`);
    const output = this.adbShell(`monkey -p ${VI_APP_PACKAGE} -c android.intent.category.LAUNCHER 1`);
    console.log(`[ViAppPage] Monkey output: ${output}`);
    await sleep(5000);
  }

  /** Open SMS conversation with VK-ViCARE */
  private async openSmsConversation(): Promise<void> {
    console.log(`[ViAppPage] Opening SMS conversation with ${SMS_SENDER}...`);
    // First try VIEW intent
    let output = this.adbShell(`am start -a android.intent.action.VIEW -d sms:${SMS_SENDER}`);
    console.log(`[ViAppPage] VIEW intent output: ${output}`);
    await sleep(2000);
    
    // If VIEW doesn't work, try SENDTO
    if (output.includes('Error') || output.includes('error')) {
      console.log('[ViAppPage] VIEW intent failed, trying SENDTO...');
      output = this.adbShell(`am start -a android.intent.action.SENDTO -d sms:${SMS_SENDER}`);
      console.log(`[ViAppPage] SENDTO intent output: ${output}`);
      await sleep(2000);
    }
  }

  /** Open a URL via ADB VIEW intent */
  private async openLinkViaAdb(url: string): Promise<void> {
    console.log(`[ViAppPage] Opening link via ADB: ${url}`);
    const output = this.adbShell(`am start -a android.intent.action.VIEW -d "${url}"`);
    console.log(`[ViAppPage] Link open output: ${output}`);
    await sleep(4000);
  }

  /** Switch WebDriver context to native app - handles web platform gracefully */
  private async switchToNativeContext(): Promise<void> {
    try {
      const isMobile = await (browser as any).isMobile?.() || false;
      if (!isMobile) {
        console.log('[ViAppPage] Not on mobile platform, skipping context switch');
        return;
      }
      
      const contexts = await browser.getContexts();
      console.log(`[ViAppPage] Available contexts: ${JSON.stringify(contexts)}`);
      
      const nativeContext = contexts.find(ctx => 
        ctx.includes('NATIVE_APP') || 
        ctx.includes('native')
      );
      
      if (nativeContext) {
        await browser.switchContext(nativeContext);
        console.log(`[ViAppPage] Switched to context: ${nativeContext}`);
      } else {
        console.warn('[ViAppPage] No native context found, staying in current context');
      }
    } catch (error) {
      console.log(`[ViAppPage] Context switching not available, continuing...`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SMS HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private parseSmsRows(raw: string): { address: string; body: string; date: string }[] {
    const rows: { address: string; body: string; date: string }[] = [];
    const lines = raw.split('\n').filter(l => l.trim().startsWith('Row:'));

    for (const line of lines) {
      const m = line.match(/address=(.*?),\s*body=(.*),\s*date=(\d+)\s*$/);
      if (m) {
        rows.push({ address: m[1].trim(), body: m[2].trim(), date: m[3].trim() });
        continue;
      }
      const addr = line.match(/address=([^,]*)/);
      const body = line.match(/body=(.*?),\s*service_center=/);
      const date = line.match(/\bdate=(\d+)/);
      if (addr && body) {
        rows.push({ address: addr[1].trim(), body: body[1].trim(), date: date ? date[1] : '' });
      }
    }
    return rows;
  }

  private queryRechargeSms(): { address: string; body: string; date: string }[] {
    const cmd = `content query --uri content://sms/inbox --projection address:body:date --where "address=\\'${SMS_SENDER}\\'"`;
    const raw = this.adbShell(cmd);
    console.log(`[ViAppPage] SMS query raw output: ${raw.substring(0, 200)}...`);
    return this.parseSmsRows(raw);
  }

  private queryRechargeSmsFull(): { address: string; body: string; date: string }[] {
    const cmd = `content query --uri content://sms/inbox --where "address=\\'${SMS_SENDER}\\'"`;
    const raw = this.adbShell(cmd);
    console.log(`[ViAppPage] Full SMS query raw output: ${raw.substring(0, 200)}...`);
    return this.parseSmsRows(raw);
  }

  private extractLinkFromSms(body: string): string {
    const match = body.match(/https?:\/\/\S+|bit\.ly\/\S+/i);
    if (!match) return '';
    let link = match[0].replace(/[.,;)\]]+$/, '');
    if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
    return link;
  }

  private extractMrpFromSms(body: string): string {
    const match = body.match(/Rs\.(\d+)/i);
    if (match && match[1]) {
      return match[1];
    }
    return '';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP A: SMS VERIFICATION AND LINK CLICK
  // ══════════════════════════════════════════════════════════════════════════

  private async verifyAndOpenRechargeNotification(
    msisdn: string,
    expectedMRP: string,
    expectedNotification: string | undefined,
    screenshots: string[]
  ): Promise<SmsVerificationResult> {
    console.log(`[ViAppPage] Step A: Verifying recharge notification SMS from ${SMS_SENDER}...`);
    console.log(`[ViAppPage] Expected MRP: ₹${expectedMRP}`);

    const result: SmsVerificationResult = {
      found: false,
      matchedNotification: false,
      dateIsToday: false,
      smsBody: '',
      smsDate: '',
      extractedLink: '',
    };

    // ─── Query SMS from VK-ViCARE ──────────────────────────────────────────
    console.log(`[ViAppPage] Querying SMS from ${SMS_SENDER}...`);
    const rows = this.queryRechargeSms();
    
    if (rows.length === 0) {
      result.error = `No SMS found from ${SMS_SENDER}`;
      console.warn(`[ViAppPage] ⚠️ ${result.error}`);
      return result;
    }

    // Get the latest SMS (first row)
    const latest = rows[0];
    result.found = true;
    result.smsBody = latest.body;
    result.smsDate = latest.date;
    
    console.log(`[ViAppPage] ✅ Latest ${SMS_SENDER} SMS found:`);
    console.log(`[ViAppPage]   Body: "${latest.body}"`);
    console.log(`[ViAppPage]   Date: ${latest.date}`);
    
    // Extract MRP from SMS
    const smsMrp = this.extractMrpFromSms(latest.body);
    console.log(`[ViAppPage] Extracted MRP from SMS: ₹${smsMrp}`);

    // ─── Match SMS with expected MRP ──────────────────────────────────────
    const normalizedExpected = expectedMRP.replace(/\D/g, '');
    const normalizedSmsMrp = smsMrp.replace(/\D/g, '');
    
    const mrpMatches = normalizedSmsMrp === normalizedExpected;
    const notificationMatches = expectedNotification ? 
      latest.body.toLowerCase().includes(expectedNotification.toLowerCase().substring(0, 20)) : 
      false;
    
    result.matchedNotification = mrpMatches || notificationMatches;
    
    console.log(result.matchedNotification
      ? `[ViAppPage] ✅ SMS matched! MRP ₹${smsMrp} matches expected ₹${expectedMRP}`
      : `[ViAppPage] ⚠️ SMS MRP ₹${smsMrp} does NOT match expected ₹${expectedMRP}`);

    // ─── Check if SMS date is today ────────────────────────────────────────
    if (latest.date) {
      const smsDateObj = new Date(Number(latest.date));
      const now = new Date();
      result.dateIsToday =
        smsDateObj.getFullYear() === now.getFullYear() &&
        smsDateObj.getMonth() === now.getMonth() &&
        smsDateObj.getDate() === now.getDate();
      
      console.log(result.dateIsToday
        ? `[ViAppPage] ✅ SMS date is today (${smsDateObj.toLocaleString()})`
        : `[ViAppPage] ⚠️ SMS date is NOT today (${smsDateObj.toLocaleString()})`);
    }

    // ─── Open SMS conversation and take screenshot ──────────────────────
    console.log('[ViAppPage] Opening SMS conversation...');
    await this.openSmsConversation();
    await sleep(3000);
    
    // Take screenshot of SMS message screen
    screenshots.push(await this.takeShot(msisdn, 'SS_SMS_message_screen'));
    console.log('[ViAppPage] ✅ SMS message screen screenshot taken');

    // ─── Query full SMS to get complete details ──────────────────────────
    console.log('[ViAppPage] Querying full SMS details...');
    const fullRows = this.queryRechargeSmsFull();
    const latestFull = fullRows[0] || latest;

    // ─── Extract link and click it ────────────────────────────────────────
    result.extractedLink = this.extractLinkFromSms(latestFull.body || latest.body);
    
    if (result.extractedLink) {
      console.log(`[ViAppPage] Extracted link: ${result.extractedLink}`);
      
      // Click the link using ADB
      await this.openLinkViaAdb(result.extractedLink);
      await sleep(5000);
      
      // Take screenshot after link click
      screenshots.push(await this.takeShot(msisdn, 'SS_after_link_click'));
      console.log('[ViAppPage] ✅ Link clicked and screenshot taken');
      
      // ─── Launch Vi App using monkey command ────────────────────────────
      console.log('[ViAppPage] Launching Vi App...');
      await this.launchViApp();
      await sleep(5000);
      console.log('[ViAppPage] ✅ Vi App launched');
      
      // Switch to native context
      await this.switchToNativeContext();
      await sleep(3000);
      
    } else {
      result.error = 'No link found in recharge notification SMS';
      console.warn(`[ViAppPage] ⚠️ ${result.error}`);
    }

    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP B: VI APP NAVIGATION
  // ══════════════════════════════════════════════════════════════════════════

  private async navigateToLastRechargeScreen(
    msisdn: string,
    screenshots: string[]
  ): Promise<boolean> {
    console.log('[ViAppPage] 📱 Navigating to last recharge screen...');
    
    try {
      // ─── Ensure we're in native context ──────────────────────────────────
      await this.ensureNativeContext();
      
      // ─── Step 4: Click on active pack card ──────────────────────────────
      console.log('[ViAppPage] 🔍 Step 4: Looking for active pack card...');
      
      // Try multiple selectors for the pack card
      const packSelectors = [
        Selectors.activePackCard,
        Selectors.activePackCardPartial,
        '//android.view.ViewGroup[contains(@content-desc, "GB")]',
        '//android.view.ViewGroup[contains(@content-desc, "Unlimited")]',
        '//android.widget.TextView[contains(@text, "Unlimited")]'
      ];
      
      let packElement: WebdriverIO.Element | null = null;
      for (const selector of packSelectors) {
        try {
          const el = await $(selector);
          const exists = await el.waitForExist({ timeout: 5000 });
          if (exists) {
            packElement = el;
            console.log(`[ViAppPage] ✅ Found pack card using: ${selector}`);
            break;
          }
        } catch (_e) {
          continue;
        }
      }
      
      if (!packElement) {
        console.warn('[ViAppPage] ⚠️ Active pack card not found');
        screenshots.push(await this.takeShot(msisdn, 'DIAG_pack_not_found'));
        return false;
      }
      
      screenshots.push(await this.takeShot(msisdn, 'SS_before_pack_click'));
      
      // Click the pack card
      await packElement.click();
      console.log('[ViAppPage] ✅ Clicked active pack card');
      await sleep(3000);
      
      // ─── Step 5: Wait for "last recharge" screen ──────────────────────
      console.log('[ViAppPage] 🔍 Step 5: Waiting for "last recharge" screen...');
      
      // Try multiple selectors for last recharge screen
      const lastRechargeSelectors = [
        Selectors.lastRechargeText,
        '//android.widget.TextView[contains(@text, "last recharge")]',
        '//android.widget.TextView[contains(@text, "Last Recharge")]'
      ];
      
      let found = false;
      for (const selector of lastRechargeSelectors) {
        try {
          const el = await $(selector);
          const exists = await el.waitForExist({ timeout: 10000 });
          if (exists) {
            found = true;
            console.log(`[ViAppPage] ✅ "last recharge" screen found using: ${selector}`);
            break;
          }
        } catch (_e) {
          continue;
        }
      }
      
      if (found) {
        screenshots.push(await this.takeShot(msisdn, 'SS_last_recharge_screen'));
        await sleep(2000);
        return true;
      } else {
        console.warn('[ViAppPage] ⚠️ "last recharge" screen did not load');
        screenshots.push(await this.takeShot(msisdn, 'DIAG_last_recharge_not_found'));
        return false;
      }
      
    } catch (error: any) {
      console.error(`[ViAppPage] Navigation error: ${error.message}`);
      screenshots.push(await this.takeShot(msisdn, 'DIAG_navigation_error'));
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC: FULL FLOW
  // ══════════════════════════════════════════════════════════════════════════

  async runViAppFlow(
    msisdn: string,
    rechargeMRP: string,
    circle?: string,
    planInfo?: ViAppPlanInfo,
    _otpUnused?: string
  ): Promise<ViAppFlowResult> {
    const screenshots: string[] = [];
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    const result: ViAppFlowResult = { 
      msisdn, 
      screenshots,
      smsDateIsToday: false,
      smsMatched: false
    };

    try {
      console.log(`\n[ViAppPage] 🚀 Starting Vi App UAT flow — MSISDN: ${msisdn}`);
      console.log(`[ViAppPage] Circle: ${circle ?? '(none)'}`);
      console.log(`[ViAppPage] Expected MRP: ₹${rechargeMRP ?? '(none)'}`);
      console.log(`[ViAppPage] Device: ${DEVICE_SERIAL}`);

      // ─── Step A: SMS verification and link click ────────────────────────
      const sms = await this.verifyAndOpenRechargeNotification(
        msisdn, rechargeMRP ?? '', planInfo?.rechargeNotification, screenshots
      );
      result.sms = sms;
      result.smsDateIsToday = sms.dateIsToday;
      result.smsMatched = sms.matchedNotification;

      if (!sms.extractedLink) {
        throw new Error(sms.error || 'Could not open Vi App via recharge notification SMS link');
      }

      // ─── Step B: Navigate to last recharge screen ──────────────────────
      const navigationSuccess = await this.navigateToLastRechargeScreen(msisdn, screenshots);
      
      if (!navigationSuccess) {
        console.warn('[ViAppPage] ⚠️ Navigation to last recharge screen failed');
      }

      // Update result with screenshots
      result.screenshots = [...screenshots];
      
      console.log(`\n[ViAppPage] ✅ Vi App UAT flow completed — MSISDN: ${msisdn}`);
      console.log(`[ViAppPage] 📊 Test Results:`);
      console.log(`[ViAppPage]   SMS Found: ${sms.found ? '✅ YES' : '❌ NO'}`);
      console.log(`[ViAppPage]   SMS Date Today: ${result.smsDateIsToday ? '✅ YES' : '❌ NO'}`);
      console.log(`[ViAppPage]   SMS Matched: ${result.smsMatched ? '✅ YES' : '❌ NO'}`);
      console.log(`[ViAppPage]   Navigation Success: ${navigationSuccess ? '✅ YES' : '❌ NO'}`);
      console.log(`[ViAppPage]   Screenshots Taken: ${screenshots.length}`);

    } catch (err: any) {
      result.error = err?.message ?? String(err);
      result.screenshots = [...screenshots];
      console.error(`[ViAppPage] ❌ Flow failed for ${msisdn}: ${result.error}`);

      try {
        const fp = path.join(SCREENSHOTS_DIR, `FAIL_${msisdn}_${Date.now()}.png`);
        await browser.saveScreenshot(fp);
        result.screenshots.push(path.basename(fp));
      } catch (_e) {}
    }

    return result;
  }
}