// swift_recharge_spec.ts — Updated with PreTest failure handling and summary report removal
// FIX: Removed duplicate SIM_Recharge_Report generation from main loop
// Reports are now generated ONLY in the after hook

/**
 * swift_recharge_spec.ts — IN + SWIFT Testing with Network Error Handling
 * Auto-generates row-wise reports based on test results
 */

import { browser } from '@wdio/globals';
import { SwiftLoginPage } from '../pages/SwiftLoginPage';
import { RechargePage } from '../pages/RechargePage';
import { ViAppPage } from '../pages/ViAppPage';
import { ExcelReportService } from '../services/ExcelReportService';
import { FinalAnalysisReportService, FinalAnalysisContext } from '../services/FinalAnalysisReportService';
import { PreTestReportService } from '../services/PreTestReportService';
import { ExcelDataService } from '../services/ExcelDataService';
import * as path from 'path';
import * as fs from 'fs';

// ── Configuration Flags ──────────────────────────────────────────────────
const SKIP_UPSS_PROCESSING = true; 

// ── Paths ──────────────────────────────────────────────────────────
const DATA_PATH = path.resolve('./data/Input_data.xlsx');
const SAMPLE_PATH = path.resolve('./Sample file/Input_data.xlsx');
const EXCEL_PATH = fs.existsSync(DATA_PATH) ? DATA_PATH : SAMPLE_PATH;

// ── Comm files ──────────────────────────────────────────────────────────
const COMM_DIR = path.resolve('./comm');
const MATCHED_ROWS_FILE = path.join(COMM_DIR, 'matched_rows.json');
const LOGIN_STATE_FILE = path.join(COMM_DIR, 'login_state.json');
const CAPTCHA_REQUEST_FILE = path.join(COMM_DIR, 'captcha_request.json');
const CAPTCHA_RESPONSE_FILE = path.join(COMM_DIR, 'captcha_response.json');
const RECHARGE_CONFIRM_FILE = path.join(COMM_DIR, 'recharge_confirmed.json');
const RECHARGE_SKIP_FILE = path.join(COMM_DIR, 'recharge_skipped.json');
const RECHARGE_FAILED_FILE = path.join(COMM_DIR, 'recharge_failed.json');

// ─── Interfaces ──────────────────────────────────────────────────────────

interface MatchedRow {
  rowIndex: number;
  srNo: number;
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  recharge: string;
  swift: string;
  inFlag: string;
  viApp: string;
  pretest?: string;
  planBenefit: string;
  rechargeNotification: string;
}

interface TestResult {
  rowIndex: number;
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  pretestStatus: 'Pass' | 'Fail' | 'Skip';
  inStatus: 'Pass' | 'Fail' | 'Skip';
  swiftStatus: 'Pass' | 'Fail' | 'Mismatch' | 'Skip';
  viAppStatus: 'Pass' | 'Fail' | 'Skip';
  overallStatus: 'Pass' | 'Fail';
  reason?: string;
  timestamp: string;
}

// ─── Helper Functions ────────────────────────────────────────────────────

function readMatchedRows(): MatchedRow[] {
  if (!fs.existsSync(MATCHED_ROWS_FILE)) {
    throw new Error(`[Recharge UAT] matched_rows.json not found at ${MATCHED_ROWS_FILE}.`);
  }
  const raw = fs.readFileSync(MATCHED_ROWS_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('[Recharge UAT] matched_rows.json must contain a JSON array.');
  }
  return parsed;
}

function reportRowEvent(event: string, rowIndex: number, msisdn: string, extra: any = {}) {
  const eventData = {
    event,
    rowIndex,
    msisdn,
    ...extra,
    timestamp: new Date().toISOString()
  };
  console.log(`[ROW_EVENT] ${JSON.stringify(eventData)}`);
}

function reportColStatus(rowIndex: number, msisdn: string, col: string, status: string, message: string = '') {
  console.log(`[${col.toUpperCase()}_TEST] ${JSON.stringify({ rowIndex, msisdn, status, message })}`);
  console.log(`[COL_STATUS] ${JSON.stringify({ rowIndex, msisdn, col, status, message })}`);
}

function mapMatchStatusToSwiftStatus(matchStatus: string): string {
  switch (matchStatus) {
    case 'Pass':
      return 'Pass';
    case 'Fail-DateMismatch':
    case 'Fail-UnparsableDate':
      return 'Fail';
    case 'Unmatched':
      return 'Mismatch';
    default:
      return 'Fail';
  }
}

function determineOverallStatus(results: TestResult): 'Pass' | 'Fail' {
  if (results.pretestStatus === 'Fail') return 'Fail';
  if (results.inStatus === 'Fail') return 'Fail';
  if (results.swiftStatus === 'Fail') return 'Fail';
  if (results.viAppStatus === 'Fail') return 'Fail';
  if (results.swiftStatus === 'Mismatch') return 'Fail';
  return 'Pass';
}

// ─── SUMMARY REPORT — COMPLETELY COMMENTED OUT ──────────────────────────
/*
function generateSummaryReport(results: TestResult[]): string {
  const total = results.length;
  const passed = results.filter(r => r.overallStatus === 'Pass').length;
  const failed = results.filter(r => r.overallStatus === 'Fail').length;
  
  const pretestPass = results.filter(r => r.pretestStatus === 'Pass').length;
  const pretestFail = results.filter(r => r.pretestStatus === 'Fail').length;
  const pretestSkip = results.filter(r => r.pretestStatus === 'Skip').length;
  
  const inPass = results.filter(r => r.inStatus === 'Pass').length;
  const inFail = results.filter(r => r.inStatus === 'Fail').length;
  const inSkip = results.filter(r => r.inStatus === 'Skip').length;
  
  const swiftPass = results.filter(r => r.swiftStatus === 'Pass').length;
  const swiftFail = results.filter(r => r.swiftStatus === 'Fail').length;
  const swiftMismatch = results.filter(r => r.swiftStatus === 'Mismatch').length;
  const swiftSkip = results.filter(r => r.swiftStatus === 'Skip').length;
  
  const viAppPass = results.filter(r => r.viAppStatus === 'Pass').length;
  const viAppFail = results.filter(r => r.viAppStatus === 'Fail').length;
  const viAppSkip = results.filter(r => r.viAppStatus === 'Skip').length;
  
  let summary = '';
  summary += '\n' + '='.repeat(80) + '\n';
  summary += 'TEST EXECUTION SUMMARY\n';
  summary += '='.repeat(80) + '\n';
  summary += `Total Rows: ${total} | Passed: ${passed} | Failed: ${failed} | Pass Rate: ${total > 0 ? Math.round((passed/total)*100) : 0}%\n`;
  summary += '-'.repeat(80) + '\n';
  summary += `PreTest:  Pass=${pretestPass}  Fail=${pretestFail}  Skip=${pretestSkip}\n`;
  summary += `IN:       Pass=${inPass}  Fail=${inFail}  Skip=${inSkip}\n`;
  summary += `SWIFT:    Pass=${swiftPass}  Fail=${swiftFail}  Mismatch=${swiftMismatch}  Skip=${swiftSkip}\n`;
  summary += `VI App:   Pass=${viAppPass}  Fail=${viAppFail}  Skip=${viAppSkip}\n`;
  summary += '-'.repeat(80) + '\n';
  summary += '  #   MSISDN        Circle   MRP   PreTest   IN     SWIFT    VI App  Overall\n';
  summary += '-'.repeat(80) + '\n';
  
  results.forEach((r, idx) => {
    const pretest = r.pretestStatus.padStart(8);
    const inStatus = r.inStatus.padStart(6);
    const swift = r.swiftStatus.padStart(8);
    const viApp = r.viAppStatus.padStart(8);
    const overall = r.overallStatus.padStart(8);
    summary += `  │  ${String(idx + 1).padStart(4)} ${r.msisdn.padStart(12)} ${r.circle.padStart(8)} ${r.rechargeMRP.padStart(6)} ${pretest} ${inStatus} ${swift} ${viApp} ${overall} │\n`;
  });
  
  summary += '='.repeat(80) + '\n';
  return summary;
}
*/

// ─── Page Accessibility Helpers ─────────────────────────────────────────

async function isPageAccessible(url: string, maxRetries: number = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[Recharge UAT] Attempt ${i + 1}/${maxRetries} to load ${url}...`);
      await browser.url(url);
      await browser.pause(3000);
      
      const title = await browser.getTitle();
      if (!title.includes('502') && !title.includes('Proxy Error') && !title.includes('Error')) {
        console.log(`[Recharge UAT]  Page loaded successfully: ${title}`);
        return true;
      }
      
      const pageSource = await browser.getPageSource();
      if (pageSource.includes('502') || pageSource.includes('Proxy Error')) {
        console.log(`[Recharge UAT] ⚠️502 Proxy Error detected, retrying...`);
        await browser.pause(2000);
        continue;
      }
      return true;
    } catch (error) {
      console.log(`[Recharge UAT] ⚠️ Attempt ${i + 1} failed:`, error instanceof Error ? error.message : 'Unknown error');
      await browser.pause(2000);
    }
  }
  return false;
}

async function handleSSLWarning(): Promise<void> {
  try {
    console.log('[Recharge UAT] Checking for SSL warning...');
    await browser.pause(2000);
    
    const detailsBtn = await browser.$('//*[@id="details-button"]');
    const isDetailsDisplayed = await detailsBtn.isDisplayed();
    if (isDetailsDisplayed) {
      console.log('[Recharge UAT] SSL warning detected, clicking details...');
      await detailsBtn.click();
      await browser.pause(1000);
      
      const proceedLink = await browser.$('//*[@id="proceed-link"]');
      const isProceedDisplayed = await proceedLink.isDisplayed();
      if (isProceedDisplayed) {
        await proceedLink.click();
        await browser.pause(3000);
        console.log('[Recharge UAT] SSL warning handled');
        return;
      }
    }
    
    const advancedBtn = await browser.$('//*[contains(text(), "Advanced")]');
    const isAdvancedDisplayed = await advancedBtn.isDisplayed();
    if (isAdvancedDisplayed) {
      console.log('[Recharge UAT] Clicking Advanced button...');
      await advancedBtn.click();
      await browser.pause(1000);
      
      const proceedLink = await browser.$('//*[contains(text(), "Proceed")]');
      const isProceedDisplayed = await proceedLink.isDisplayed();
      if (isProceedDisplayed) {
        await proceedLink.click();
        await browser.pause(3000);
        console.log('[Recharge UAT] SSL warning handled via Advanced');
        return;
      }
    }
    
    console.log('[Recharge UAT] No SSL warning detected or already handled');
  } catch (error) {
    console.warn('[Recharge UAT] SSL warning handling error:', error);
  }
}

async function waitForLoginPage(): Promise<boolean> {
  console.log('[Recharge UAT] ⏳ Waiting for login page to load...');
  
  const maxWait = 120 * 1000;
  const start = Date.now();
  
  while (Date.now() - start < maxWait) {
    try {
      const profileTab = await browser.$('a#ac_agent_profile');
      const isProfileDisplayed = await profileTab.isDisplayed();
      if (isProfileDisplayed) {
        console.log('[Recharge UAT]  Already logged in!');
        return true;
      }
      
      const captchaImg = await browser.$('img#LoginCaptcha');
      const isCaptchaDisplayed = await captchaImg.isDisplayed();
      if (isCaptchaDisplayed) {
        console.log('[Recharge UAT]  CAPTCHA detected on login page');
        return true;
      }
      
      const usernameField = await browser.$('//*[@id="tempusername"]');
      const isUsernameDisplayed = await usernameField.isDisplayed();
      if (isUsernameDisplayed) {
        console.log('[Recharge UAT]  Login form detected');
        return true;
      }
      
      const passwordField = await browser.$('//*[@id="temppassword"]');
      const isPasswordDisplayed = await passwordField.isDisplayed();
      if (isPasswordDisplayed) {
        console.log('[Recharge UAT]  Login form detected');
        return true;
      }
    } catch (_e) {}
    await browser.pause(1000);
  }
  
  console.log('[Recharge UAT] ⚠️ Login page not detected within timeout');
  return false;
}

type LoginResult = { success: boolean; reason?: 'invalid_credentials' | 'timeout' | 'error' };

async function handleLoginWithCaptcha(): Promise<LoginResult> {
  console.log('[Recharge UAT] Handling login with CAPTCHA...');

  try {
    const profileTab = await browser.$('a#ac_agent_profile');
    const isProfileDisplayed = await profileTab.isDisplayed();
    if (isProfileDisplayed) {
      console.log('[Recharge UAT]  Already logged in!');
      fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ isLoggedIn: true, timestamp: Date.now() }, null, 2));
      return { success: true };
    }

    const captchaImg = await browser.$('img#LoginCaptcha');
    const hasCaptcha = await captchaImg.isDisplayed();

    if (hasCaptcha) {
      console.log('[Recharge UAT] 📸 CAPTCHA detected - waiting for user input...');

      const timestamp = Date.now();
      const filename = `captcha_${timestamp}.png`;
      const captchaDir = path.resolve('./captcha_screenshots');
      if (!fs.existsSync(captchaDir)) {
        fs.mkdirSync(captchaDir, { recursive: true });
      }
      const filepath = path.join(captchaDir, filename);
      await captchaImg.saveScreenshot(filepath);

      fs.mkdirSync(COMM_DIR, { recursive: true });
      fs.writeFileSync(CAPTCHA_REQUEST_FILE, JSON.stringify({
        timestamp: timestamp,
        filename: filename,
        imageUrl: `/captcha-images/${filename}`,
        requiresCredentials: true
      }, null, 2));

      console.log(`[Recharge UAT] CAPTCHA saved: ${filename}`);
      console.log('[Recharge UAT] Please enter your credentials and CAPTCHA via the frontend popup');

      const maxWait = 5 * 60 * 1000;
      const start = Date.now();
      let response: any = null;

      while (!response && Date.now() - start < maxWait) {
        if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
          try {
            const raw = fs.readFileSync(CAPTCHA_RESPONSE_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (data.answer) {
              response = data;
              console.log(`[Recharge UAT] CAPTCHA response received: ${data.answer}`);
              if (fs.existsSync(CAPTCHA_REQUEST_FILE)) fs.unlinkSync(CAPTCHA_REQUEST_FILE);
              if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) fs.unlinkSync(CAPTCHA_RESPONSE_FILE);
            }
          } catch (_e) {}
        }

        const profileCheck = await browser.$('a#ac_agent_profile');
        const isProfileCheckDisplayed = await profileCheck.isDisplayed();
        if (isProfileCheckDisplayed) {
          console.log('[Recharge UAT]  Manual login detected!');
          fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ isLoggedIn: true, timestamp: Date.now() }, null, 2));
          return { success: true };
        }
        await browser.pause(500);
      }

      if (!response) {
        console.log('[Recharge UAT] ⚠️ CAPTCHA response timeout');
        return { success: false, reason: 'timeout' };
      }

      const captchaInput = await browser.$('//*[@id="captcha"]');
      await captchaInput.waitForDisplayed({ timeout: 10000 });
      await captchaInput.clearValue();
      await captchaInput.setValue(response.answer);
      console.log('[Recharge UAT]  CAPTCHA entered');

      if (response.username) {
        const usernameInput = await browser.$('//*[@id="tempusername"]');
        await usernameInput.waitForDisplayed({ timeout: 5000 });
        await usernameInput.clearValue();
        await usernameInput.setValue(response.username);
        console.log(`[Recharge UAT]  Username entered: ${response.username}`);
      }

      if (response.password) {
        const passwordInput = await browser.$('//*[@id="temppassword"]');
        await passwordInput.waitForDisplayed({ timeout: 5000 });
        await browser.execute((el: any) => { el.removeAttribute('readonly'); }, passwordInput);
        await passwordInput.clearValue();
        await passwordInput.setValue(response.password);
        console.log('[Recharge UAT]  Password entered');
      }

      const loginBtn = await browser.$('//*[@id="loginForm"]/div[2]/div[2]/form/button');
      await loginBtn.click();
      console.log('[Recharge UAT]  Login button clicked');
      await browser.pause(5000);

      const profileTabAfter = await browser.$('a#ac_agent_profile');
      const isProfileAfterDisplayed = await profileTabAfter.isDisplayed();
      if (isProfileAfterDisplayed) {
        console.log('[Recharge UAT]  Login successful!');
        fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ isLoggedIn: true, timestamp: Date.now() }, null, 2));
        return { success: true };
      }

      const stillOnLoginForm = await browser.$('//*[@id="tempusername"]').isDisplayed().catch(() => false);
      if (stillOnLoginForm) {
        console.log('[Recharge UAT] ⚠️ Login failed — invalid credentials or CAPTCHA');
        return { success: false, reason: 'invalid_credentials' };
      }

      console.log('[Recharge UAT] ⚠️ Login may have failed (unknown state)');
      return { success: false, reason: 'error' };
    }

    const usernameField = await browser.$('//*[@id="tempusername"]');
    const isUsernameDisplayed = await usernameField.isDisplayed();
    if (isUsernameDisplayed) {
      console.log('[Recharge UAT] ⚠️ On login page but no CAPTCHA - waiting for manual login...');

      const maxWait = 5 * 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        const profileTabCheck = await browser.$('a#ac_agent_profile');
        const isProfileCheckDisplayed = await profileTabCheck.isDisplayed();
        if (isProfileCheckDisplayed) {
          console.log('[Recharge UAT]  Manual login detected!');
          fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ isLoggedIn: true, timestamp: Date.now() }, null, 2));
          return { success: true };
        }

        const captchaCheck = await browser.$('img#LoginCaptcha');
        const isCaptchaCheckDisplayed = await captchaCheck.isDisplayed();
        if (isCaptchaCheckDisplayed) {
          console.log('[Recharge UAT] CAPTCHA appeared - restarting login flow');
          return await handleLoginWithCaptcha();
        }
        await browser.pause(1000);
      }
      return { success: false, reason: 'timeout' };
    }

    const profileFinal = await browser.$('a#ac_agent_profile');
    const isProfileFinalDisplayed = await profileFinal.isDisplayed();
    if (isProfileFinalDisplayed) {
      console.log('[Recharge UAT]  Already logged in (final check)!');
      fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ isLoggedIn: true, timestamp: Date.now() }, null, 2));
      return { success: true };
    }

    return { success: false, reason: 'error' };
  } catch (error) {
    console.error('[Recharge UAT] Login error:', error);
    return { success: false, reason: 'error' };
  }
}

async function handleLoginWithRetries(maxAttempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Recharge UAT] Login attempt ${attempt}/${maxAttempts}`);

    const result = await handleLoginWithCaptcha();
    if (result.success) return true;

    if (result.reason === 'timeout' || result.reason === 'error') {
      console.log(`[Recharge UAT] ❌ Login stopped — reason: ${result.reason} (not retrying)`);
      return false;
    }

    if (attempt < maxAttempts) {
      console.log(`[Recharge UAT] ⚠️ Attempt ${attempt} failed — invalid credentials/CAPTCHA. Retrying (${attempt + 1}/${maxAttempts})...`);
      fs.mkdirSync(COMM_DIR, { recursive: true });
      fs.writeFileSync(path.join(COMM_DIR, 'login_retry.json'), JSON.stringify({
        attempt, maxAttempts,
        reason: 'Invalid credentials or CAPTCHA — please try again',
        timestamp: Date.now()
      }, null, 2));
      await browser.refresh();
      await browser.pause(2000);
      await waitForLoginPage();
    } else {
      console.error(`[Recharge UAT] ❌ Login failed after ${maxAttempts} attempts — giving up`);
      fs.writeFileSync(path.join(COMM_DIR, 'login_failed.json'), JSON.stringify({
        maxAttempts,
        timestamp: Date.now()
      }, null, 2));
    }
  }
  return false;
}

async function ensureRechargePage(): Promise<void> {
  console.log('[Recharge UAT] Ensuring recharge page is loaded...');
  
  try {
    const msisdnInput = await browser.$('#mobforward');
    const isMsisdnDisplayed = await msisdnInput.isDisplayed();
    if (isMsisdnDisplayed) {
      console.log('[Recharge UAT]  Already on recharge page');
      return;
    }
    
    try {
      const agentTab = await browser.$('//*[@id="agent-tab"]');
      const isAgentDisplayed = await agentTab.isDisplayed();
      if (isAgentDisplayed) {
        await agentTab.click();
        console.log('[Recharge UAT]  Clicked agent tab');
        await browser.pause(3000);
      }
    } catch (_e) {
      console.log('[Recharge UAT] Agent tab not found, trying direct navigation');
    }
    
    await browser.url('https://swiftcrm.vodafoneidea.in/swift-portal/');
    await browser.pause(5000);
    
    const msisdnInputRetry = await browser.$('#mobforward');
    const isMsisdnRetryDisplayed = await msisdnInputRetry.isDisplayed();
    if (isMsisdnRetryDisplayed) {
      console.log('[Recharge UAT]  Recharge page loaded');
      return;
    }
    
    try {
      const rechargeMenu = await browser.$('//*[contains(text(), "Recharge")]');
      const isMenuDisplayed = await rechargeMenu.isDisplayed();
      if (isMenuDisplayed) {
        await rechargeMenu.click();
        await browser.pause(3000);
        console.log('[Recharge UAT]  Clicked Recharge menu');
        return;
      }
    } catch (_e) {}
    
    console.log('[Recharge UAT] ⚠️ Could not load recharge page');
  } catch (error) {
    console.warn('[Recharge UAT] Error ensuring recharge page:', error);
  }
}

async function waitForRechargeConfirmation(msisdn: string, timeoutMs: number = 300000): Promise<{ confirmed: boolean; skipped: boolean; failed: boolean }> {
  console.log(`[Recharge UAT] ⏳ Waiting for recharge confirmation for ${msisdn}...`);
  
  const confirmFile = path.join(COMM_DIR, 'recharge_confirmed.json');
  const skipFile = path.join(COMM_DIR, 'recharge_skipped.json');
  const failedFile = path.join(COMM_DIR, 'recharge_failed.json');
  
  try {
    if (fs.existsSync(confirmFile)) fs.unlinkSync(confirmFile);
    if (fs.existsSync(skipFile)) fs.unlinkSync(skipFile);
    if (fs.existsSync(failedFile)) fs.unlinkSync(failedFile);
  } catch (_) {}
  
  const start = Date.now();
  let lastFileCheck = 0;
  const checkInterval = 300;
  
  while (Date.now() - start < timeoutMs) {
    if (Date.now() - lastFileCheck < checkInterval) {
      await browser.pause(100);
      continue;
    }
    lastFileCheck = Date.now();
    
    if (fs.existsSync(confirmFile)) {
      try {
        const raw = fs.readFileSync(confirmFile, 'utf8');
        const data = JSON.parse(raw);
        if (data.msisdn === msisdn && data.confirmed === true) {
          console.log(`[Recharge UAT] ✅ Recharge confirmed for ${msisdn} via ${data.source || 'unknown'}`);
          try { fs.unlinkSync(confirmFile); } catch (_) {}
          return { confirmed: true, skipped: false, failed: false };
        }
      } catch (parseErr) {}
    }
    
    if (fs.existsSync(skipFile)) {
      try {
        const raw = fs.readFileSync(skipFile, 'utf8');
        const data = JSON.parse(raw);
        if (data.msisdn === msisdn && data.skipped === true) {
          console.log(`[Recharge UAT] ⏭ Recharge skipped for ${msisdn}: ${data.reason || 'User skipped'}`);
          try { fs.unlinkSync(skipFile); } catch (_) {}
          return { confirmed: false, skipped: true, failed: false };
        }
      } catch (parseErr) {}
    }
    
    if (fs.existsSync(failedFile)) {
      try {
        const raw = fs.readFileSync(failedFile, 'utf8');
        const data = JSON.parse(raw);
        if (data.msisdn === msisdn && data.failed === true) {
          console.log(`[Recharge UAT] ❌ Recharge failed for ${msisdn}: ${data.reason || 'Recharge failed'}`);
          try { fs.unlinkSync(failedFile); } catch (_) {}
          return { confirmed: false, skipped: false, failed: true };
        }
      } catch (parseErr) {}
    }
  }
  
  console.warn(`[Recharge UAT] ⚠️ Timeout waiting for recharge confirmation for ${msisdn} after ${Math.round(timeoutMs/1000)}s`);
  return { confirmed: false, skipped: false, failed: false };
}

// ─── Main Test ─────────────────────────────────────────────────────────────

describe('SWIFT CRM – IN + SWIFT Recharge UAT', () => {
  let loginPage: SwiftLoginPage;
  let rechargePage: RechargePage;
  let viAppPage: ViAppPage;
  let excelReportService: ExcelReportService;
  let finalAnalysisReportService: FinalAnalysisReportService;
  let preTestReportService: PreTestReportService;
  let excelDataService: ExcelDataService;
  let matchedRows: MatchedRow[] = [];
  let isLoggedIn = false;
  let inputRowsForReport: any[] = [];
  let testResults: TestResult[] = [];
  let upssPromotional: any[] = [];

  before(async () => {
    loginPage = new SwiftLoginPage();
    rechargePage = new RechargePage();
    viAppPage = new ViAppPage();
    excelReportService = new ExcelReportService();
    finalAnalysisReportService = new FinalAnalysisReportService(excelReportService, EXCEL_PATH);
    preTestReportService = new PreTestReportService();
    excelDataService = new ExcelDataService(EXCEL_PATH);

    matchedRows = readMatchedRows();
    
    const planData = excelDataService.getRechargePlans();
    const planMap = new Map();
    planData.forEach(p => {
      planMap.set(String(p.newMRP), {
        benefit: p.benefit,
        rechargeNotification: p.rechargeNotification,
        circle: p.circle,
        mode: p.mode,
        cat: p.cat
      });
    });
    
    matchedRows = matchedRows.map(row => {
      const plan = planMap.get(String(row.rechargeMRP));
      return {
        ...row,
        planBenefit: plan?.benefit || 'N/A',
        rechargeNotification: plan?.rechargeNotification || 'N/A'
      };
    });
    
    inputRowsForReport = matchedRows.map(row => ({
      msisdn: row.msisdn,
      circle: row.circle,
      rechargeMRP: row.rechargeMRP,
      recharge: row.recharge,
      swift: row.swift || 'yes',
      inFlag: row.inFlag || 'yes',
      viApp: row.viApp,
      planBenefit: row.planBenefit,
      rechargeNotification: row.rechargeNotification
    }));
    
    excelReportService.addInputRows(inputRowsForReport);
    preTestReportService.addInputRows(inputRowsForReport.map(r => ({
      msisdn: r.msisdn,
      circle: r.circle,
      rechargeMRP: r.rechargeMRP,
      planBenefit: r.planBenefit
    })));
    
    console.log(`[Recharge UAT] Loaded ${matchedRows.length} matched row(s)`);
    console.log(`[Recharge UAT] IN-Yes rows: ${matchedRows.filter(r => r.inFlag?.toLowerCase() === 'yes').length}`);
    console.log(`[Recharge UAT] SWIFT-Yes rows: ${matchedRows.filter(r => r.swift?.toLowerCase() === 'yes').length}`);
    console.log(`[Recharge UAT] Recharge-Yes rows: ${matchedRows.filter(r => r.recharge?.toLowerCase() === 'yes').length}`);
  });

  after(async () => {
    // ─── SUMMARY REPORT — COMPLETELY COMMENTED OUT ──────────────────────────
    /*
    if (testResults.length > 0) {
      const summary = generateSummaryReport(testResults);
      console.log(summary);
      
      const summaryDir = path.resolve('./reports');
      if (!fs.existsSync(summaryDir)) {
        fs.mkdirSync(summaryDir, { recursive: true });
      }
      const summaryPath = path.join(summaryDir, `summary_report_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
      fs.writeFileSync(summaryPath, summary);
      console.log(`[Recharge UAT] Summary report saved: ${summaryPath}`);
    }
    */

    // ─── PreTest reports are generated for ALL rows (pass or fail) ──────────
    // SIM_Recharge_Report (Excel/PDF/HTML) should be generated for PreTest PASS or SKIP cases

    if (excelReportService.getResultCount() > 0 || preTestReportService.getPreTestResultCount() > 0) {
      console.log(`[Recharge UAT] Total rows processed: ${matchedRows.length}`);
      console.log(`[Recharge UAT] Total screenshots: ${excelReportService.getScreenshotCount()}`);

      // ─── Check which rows are eligible for SIM_Recharge_Report ──────────────
      const rowsEligibleForReport = testResults
        .filter(r => r.pretestStatus === 'Pass' || r.pretestStatus === 'Skip')
        .map(r => r.msisdn);

      const preTestFailedMsisdns = testResults
        .filter(r => r.pretestStatus === 'Fail')
        .map(r => r.msisdn);

      console.log(`[Recharge UAT] Rows eligible for SIM_Recharge_Report (Pass/Skip): ${rowsEligibleForReport.length}`);
      console.log(`[Recharge UAT] PreTest Fail rows (skipping SIM_Recharge_Report): ${preTestFailedMsisdns.length}`);

      // ─── Generate SIM_Recharge_Report for eligible rows ──────────────────────
      if (rowsEligibleForReport.length > 0) {
        const eligibleInputRows = inputRowsForReport.filter(row => 
          rowsEligibleForReport.includes(row.msisdn)
        );

        console.log(`[Recharge UAT] Generating SIM_Recharge_Reports for ${eligibleInputRows.length} eligible rows...`);

        // Generate individual reports for eligible rows
        for (const row of eligibleInputRows) {
          try {
            const rowBundle = await excelReportService.writeIndividualReport(row);
            console.log(`[Recharge UAT] ✅ SIM_Recharge_Report for ${row.msisdn}: ${rowBundle.zipPath}`);
          } catch (err: any) {
            console.error(`[Recharge UAT] ❌ Failed to generate report for ${row.msisdn}: ${err.message}`);
          }
        }

        // If there are multiple eligible rows, generate consolidated report
        if (eligibleInputRows.length > 1) {
          try {
            const consolidated = await excelReportService.writeConsolidatedReport();
            console.log(`[Recharge UAT] ✅ Consolidated SIM_Recharge_Report: ${consolidated.excelPath}`);
          } catch (err: any) {
            console.warn(`[Recharge UAT] Consolidated report generation skipped: ${err?.message || err}`);
          }
        }
      } else {
        console.log('[Recharge UAT] ⏭ No eligible rows (Pass/Skip) — skipping SIM_Recharge_Report generation');
      }

      // ─── PreTest Reports are always generated for ALL rows ────────────────
      try {
        if (preTestReportService.getPreTestResultCount() > 0) {
          // Generate individual PreTest reports for ALL rows
          const preTestResults = await preTestReportService.writeAllIndividualReports();
          console.log(`[Recharge UAT] ✅ Generated ${preTestResults.length} PreTest report(s)`);
          
          // Generate consolidated PreTest report
          // const preTestConsolidated = await preTestReportService.writeConsolidatedReport();
          // console.log(`[Recharge UAT] ✅ Consolidated PreTest Report: ${preTestConsolidated.excelPath}`);
        }
      } catch (preTestReportErr: any) {
        console.warn(`[Recharge UAT] PreTest report generation error: ${preTestReportErr?.message || preTestReportErr}`);
      }

      // ─── Analysis Reports are generated per row during execution ────────────
      // No additional action needed here - they're generated in the main loop

    } else {
      console.log('[Recharge UAT] No results recorded — skipping report generation');
    }
  });  

  it('should process all matched recharge UAT rows in one session', async function () {
    const batchTimeoutMs = Math.max(30 * 60 * 1000, (matchedRows.length || 1) * 10 * 60 * 1000);
    this.timeout(batchTimeoutMs);
    console.log(`[Recharge UAT] Overall batch timeout: ${Math.round(batchTimeoutMs / 60000)} minute(s)`);

    // ── STEP 1: Navigate to SWIFT with retry ─────────────────────────────────
    console.log('[Recharge UAT] Navigating to SWIFT CRM...');
    const pageLoaded = await isPageAccessible('https://swiftcrm.vodafoneidea.in/swift-portal/login', 5);
    
    if (!pageLoaded) {
      console.error('[Recharge UAT] ❌ Could not access SWIFT CRM page after multiple retries.');
      throw new Error('[Recharge UAT] ❌ Cannot access SWIFT CRM - check your network connectivity or CISCO VPN Connection');
    }

    // ── STEP 2: Handle SSL warning ──────────────────────────────────────────
    await handleSSLWarning();

    // ── STEP 3: Wait for login page ──────────────────────────────────────────
    const loginPageDetected = await waitForLoginPage();
    if (!loginPageDetected) {
      console.log('[Recharge UAT] ⚠️ Login page not detected. Taking debug screenshot...');
      try {
        const screenshotPath = path.resolve(`./screenshots/login_page_debug_${Date.now()}.png`);
        await browser.saveScreenshot(screenshotPath);
        console.log(`[Recharge UAT] Debug screenshot saved: ${screenshotPath}`);
      } catch (_) {}
    }

    // ── STEP 4: Handle login ──────────────────────────────────────────────────
    const loginSuccess = await handleLoginWithRetries(3);
    if (loginSuccess) { 
      isLoggedIn = true;
      console.log('[Recharge UAT] Login successful!');
    } else {
      console.log('[Recharge UAT] Login not confirmed - waiting for manual login...');
      const maxWait = 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        try {
          const profileTab = await browser.$('a#ac_agent_profile');
          const isProfileDisplayed = await profileTab.isDisplayed();
          if (isProfileDisplayed) {
            isLoggedIn = true;
            console.log('[Recharge UAT] Manual login detected!');
            break;
          }
        } catch (_e) {}
        await browser.pause(1000);
      }
      if (!isLoggedIn) {
        console.log('[Recharge UAT] ⚠️ Still not logged in. Continuing after 15 seconds...');
        await browser.pause(15000);
        try {
          const profileTab = await browser.$('a#ac_agent_profile');
          const isProfileDisplayed = await profileTab.isDisplayed();
          if (isProfileDisplayed) {
            isLoggedIn = true;
            console.log('[Recharge UAT]  Login detected after wait!');
          }
        } catch (_e) {}
      }
    }

    if (!isLoggedIn) {
      console.error('[Recharge UAT] ❌ Could not login to SWIFT CRM.');
      throw new Error('[Recharge UAT] ❌ Login failed - cannot proceed with tests');
    }

    // ── STEP 5: Ensure we're on the recharge page ────────────────────────────
    await ensureRechargePage();

    // ── Process each row ─────────────────────────────────────────────────────
    for (let index = 0; index < matchedRows.length; index++) {
      const row = matchedRows[index];
      const srNo = index + 1;
      const rowIndex = row.rowIndex || index;
      const viAppFlag = (row.viApp || '').toLowerCase();
      const inFlag = (row.inFlag || '').toLowerCase();
      const swiftFlag = (row.swift || '').toLowerCase();
      const rechargeFlag = (row.recharge || '').toLowerCase();
      const pretestFlag = 'yes';
      // const pretestFlag = 'no';

      console.log(`\n===== Row ${srNo}/${matchedRows.length} =====`);
      console.log(`MSISDN: ${row.msisdn}`);
      console.log(`Recharge MRP: ${row.rechargeMRP}`);
      console.log(`Circle: ${row.circle}`);
      console.log(`Recharge: ${row.recharge}`);
      console.log(`IN: ${row.inFlag}`);
      console.log(`SWIFT: ${row.swift}`);
      console.log(`Vi App: ${row.viApp}`);
      console.log(`Plan Benefit: ${row.planBenefit}`);
      console.log('========================');

      // Initialize row result
      const rowResult: TestResult = {
        rowIndex: rowIndex,
        msisdn: row.msisdn,
        circle: row.circle,
        rechargeMRP: row.rechargeMRP,
        pretestStatus: 'Skip',
        inStatus: 'Skip',
        swiftStatus: 'Skip',
        viAppStatus: 'Skip',
        overallStatus: 'Pass',
        reason: '',
        timestamp: new Date().toISOString()
      };

      try {
        reportRowEvent('row_start', rowIndex, row.msisdn);

        let preTestResult = null;

        // ════════════════════════════════════════════════════════════════════
        // 🔎 STEP 1: PRETEST
        // ════════════════════════════════════════════════════════════════════
        if (pretestFlag === 'yes') {
          reportColStatus(rowIndex, row.msisdn, 'pretest', 'running', 'PreTest verification in progress');
          preTestResult = await rechargePage.runPreTestVerification(row.msisdn);

          try {
            const preTestScreenshotEntries = rechargePage.getScreenshots().filter(s => s.msisdn === row.msisdn);

            preTestReportService.addPreTestResult({
              msisdn: row.msisdn,
              circle: row.circle,
              rechargeMRP: row.rechargeMRP,
              status: preTestResult.success ? 'Pass' : 'Fail',
              reason: preTestResult.reason || 'N/A',
              customerName: preTestResult.subscriberInfo?.customerName,
              coreBalance: preTestResult.subscriberInfo?.coreBalance,
              serviceValidity: preTestResult.subscriberInfo?.serviceValidity,
              accountStatus: preTestResult.subscriberInfo?.accountStatus,
              userType: preTestResult.subscriberInfo?.userType,
              accountOverview: preTestResult.accountOverview || {},
              dedicatedAccounts: preTestResult.dedicatedAccounts || [],
              offers: preTestResult.offers || [],
              voice: preTestResult.totalUsage?.voice || [],
              data: preTestResult.totalUsage?.data || [],
              sms: preTestResult.totalUsage?.sms || [],
              screenshots: preTestScreenshotEntries,
            });

            excelReportService.addPreTestResult({
              msisdn: row.msisdn,
              circle: row.circle,
              rechargeMRP: row.rechargeMRP,
              status: preTestResult.success ? 'Pass' : 'Fail',
              reason: preTestResult.reason || 'N/A',
              voice: preTestResult.totalUsage?.voice || [],
              data: preTestResult.totalUsage?.data || [],
              sms: preTestResult.totalUsage?.sms || [],
              dedicatedAccounts: preTestResult.dedicatedAccounts || [],
              offers: preTestResult.offers || [],
              screenshotCount: preTestScreenshotEntries.length,
              screenshots: preTestScreenshotEntries.map(s => s.fullPath),
            });

            // PreTest report is generated for ALL rows (pass or fail)
            const preTestRowBundle = await preTestReportService.writeIndividualReport({
              msisdn: row.msisdn,
              circle: row.circle,
              rechargeMRP: row.rechargeMRP,
              planBenefit: row.planBenefit,
            });
            console.log(`[Recharge UAT] PreTest report bundle: ${preTestRowBundle.zipPath}`);
          } catch (preTestReportErr: any) {
            console.error(`[Recharge UAT] Failed to generate PreTest report for ${row.msisdn}:`, preTestReportErr instanceof Error ? preTestReportErr.message : preTestReportErr);
          }

          // ─── Handle PreTest failure ───────────────────────────────────────
          if (!preTestResult.success) {
            console.log(`[Recharge UAT] ❌ PreTest FAILED for ${row.msisdn}: ${preTestResult.reason}`);
            
            const failureReason = preTestResult.reason || 'Active usage found — PreTest failed';
            
            // ─── Broadcast PreTest failure ──────────────────────────────────
            console.log(`[ROW_EVENT] ${JSON.stringify({ 
              event: 'row_failed', 
              rowIndex, 
              msisdn: row.msisdn, 
              error: failureReason
            })}`);
            
            console.log(`[COL_STATUS] ${JSON.stringify({
              rowIndex,
              msisdn: row.msisdn,
              col: 'pretest',
              status: 'failed',
              message: failureReason
            })}`);

            console.log(`[PRETEST_TEST] ${JSON.stringify({ 
              rowIndex, 
              msisdn: row.msisdn, 
              status: 'failed', 
              message: failureReason 
            })}`);

            reportColStatus(rowIndex, row.msisdn, 'recharge', 'skipped', 'Skipped — PreTest failed');
            reportColStatus(rowIndex, row.msisdn, 'in', 'skipped', 'Skipped — PreTest failed');
            reportColStatus(rowIndex, row.msisdn, 'swift', 'skipped', 'Skipped — PreTest failed');
            reportColStatus(rowIndex, row.msisdn, 'viApp', 'skipped', 'Skipped — PreTest failed');

            const preTestScreenshots = rechargePage.getScreenshotsForMSISDN(row.msisdn);
            
            // ─── IMPORTANT: Do NOT add UAT result for PreTest failures ──────
            // This prevents SIM_Recharge_Report from being generated
            // We only add UAT results for PreTest PASS cases
            
            rowResult.pretestStatus = 'Fail';
            rowResult.reason = failureReason;
            rowResult.overallStatus = 'Fail';
            testResults.push(rowResult);
            
            // ─── No SIM_Recharge_Report for PreTest failures ────────────────
            console.log(`[Recharge UAT] ⏭ Skipping SIM_Recharge_Report for ${row.msisdn} (PreTest failed)`);
            continue;
          }

          // PreTest passed
          rowResult.pretestStatus = 'Pass';
          reportColStatus(rowIndex, row.msisdn, 'pretest', 'completed', preTestResult.reason || 'PreTest passed');
          console.log(`[Recharge UAT] ✅ PreTest passed for ${row.msisdn}`);
          
        } else {
          rowResult.pretestStatus = 'Skip';
          reportColStatus(rowIndex, row.msisdn, 'pretest', 'skipped', 'PreTest not required');
        }

        // ════════════════════════════════════════════════════════════════════
        // 🔁 STEP 2: RECHARGE CONFIRMATION WAIT
        // ════════════════════════════════════════════════════════════════════
        if (rechargeFlag === 'yes') {
          console.log(`[Recharge UAT] Recharge=Yes — waiting for confirmation for ${row.msisdn}`);
          const txnId = `TXN-${row.msisdn}-${Date.now()}`;
          reportRowEvent('row_waiting_confirm', rowIndex, row.msisdn, { transactionId: txnId });

          const result = await waitForRechargeConfirmation(row.msisdn, 1600000);
          let rechargeOk = false;

          if (result.confirmed) {
            console.log(`[Recharge UAT] ✅ Recharge confirmed for ${row.msisdn}`);
            reportRowEvent('row_recharge_confirmed', rowIndex, row.msisdn, { transactionId: txnId });
            reportColStatus(rowIndex, row.msisdn, 'recharge', 'completed', 'Recharge confirmed via email');
            rechargeOk = true;
          } else if (result.skipped) {
            console.log(`[Recharge UAT] ⏭ Recharge skipped for ${row.msisdn}`);
            reportRowEvent('row_skipped', rowIndex, row.msisdn, { reason: 'User skipped' });
            reportColStatus(rowIndex, row.msisdn, 'recharge', 'skipped', 'Recharge skipped by user');
            rechargeOk = true;
          } else if (result.failed) {
            console.log(`[Recharge UAT] ❌ Recharge failed for ${row.msisdn}`);
            reportColStatus(rowIndex, row.msisdn, 'recharge', 'failed', 'Recharge failed by user');
          } else {
            console.warn(`[Recharge UAT] ⚠️ Recharge confirmation timeout for ${row.msisdn}`);
            reportColStatus(rowIndex, row.msisdn, 'recharge', 'failed', 'Recharge confirmation timeout');
          }

          if (!rechargeOk) {
            rowResult.reason = 'Recharge failed or timed out';
            rowResult.overallStatus = 'Fail';
            reportColStatus(rowIndex, row.msisdn, 'in', 'skipped', 'Skipped — recharge failed');
            reportColStatus(rowIndex, row.msisdn, 'swift', 'skipped', 'Skipped — recharge failed');
            reportColStatus(rowIndex, row.msisdn, 'viApp', 'skipped', 'Skipped — recharge failed');

            // ─── NO UAT result for recharge failures ─────────────────────────
            testResults.push(rowResult);
            continue;
          }
        } else {
          reportColStatus(rowIndex, row.msisdn, 'recharge', 'skipped', 'Recharge not required');
        }

        // ── From here on: PreTest passed AND recharge confirmed/skipped/not-required ──

        // Per-row context for final analysis report
        let rowSubscriberInfo: any = null;
        let rowInResults: any = null;
        let rowSwiftResults: any = null;

        // --- MSISDN Entry ---
        await rechargePage.enterMSISDN(row.msisdn);
        await rechargePage.takeScreenshot(`Row${srNo}_Step1_Enter_MSISDN`);

        // --- Search ---
        await rechargePage.clickSearchButton();
        await rechargePage.takeScreenshot(`Row${srNo}_Step2_Click_Search`);

        // --- Subscriber Info ---
        const subscriberInfo = await rechargePage.captureSubscriberInfo(row.msisdn, srNo);
        rowSubscriberInfo = subscriberInfo;
        await rechargePage.takeScreenshot(`Row${srNo}_Step3_Subscriber_Info`);

        console.log(`[Recharge UAT] Subscriber: ${subscriberInfo.customerName || 'N/A'}, Circle: ${subscriberInfo.circle || 'N/A'}`);
        console.log(`[Recharge UAT] Core Balance: ${subscriberInfo.coreBalance || 'N/A'}, Validity: ${subscriberInfo.serviceValidity || 'N/A'}`);

        // ─── IN yes case ──────────────────────────────────────────────────────
        if (inFlag === 'yes') {
          console.log(`[Recharge UAT] 🔄 Running IN test for ${row.msisdn}`);
          reportColStatus(rowIndex, row.msisdn, 'in', 'running', 'IN test in progress');

          const inResults = await rechargePage.runINTest(row.msisdn, row.rechargeMRP);
          rowInResults = inResults;
          
          const inTestPassed = inResults.success === true;
          
          if (!inTestPassed) {
            rowResult.overallStatus = 'Fail';
            rowResult.reason = inResults.reason || 'IN test failed';
          }

          const screenshots = rechargePage.getScreenshotsForMSISDN(row.msisdn);

          excelReportService.addINResult({
            msisdn: row.msisdn,
            circle: row.circle,
            rechargeMRP: row.rechargeMRP,
            status: inTestPassed ? 'Pass' : 'Fail',
            customerName: subscriberInfo.customerName || 'N/A',
            coreBalance: subscriberInfo.coreBalance || 'N/A',
            serviceValidity: subscriberInfo.serviceValidity || 'N/A',
            accountStatus: subscriberInfo.accountStatus || 'N/A',
            userType: subscriberInfo.userType || 'N/A',
            activationDate: inResults.accountOverview?.activationDate || 'N/A',
            serviceRemovalOn: inResults.accountOverview?.serviceRemovalOn || 'N/A',
            supervisionExpiresOn: inResults.accountOverview?.supervisionExpiresOn || 'N/A',
            mainBalance: inResults.accountOverview?.mainBalance || 'N/A',
            serviceFeeExpiresOn: inResults.accountOverview?.serviceFeeExpiresOn || 'N/A',
            subscriberStatus: inResults.accountOverview?.subscriberStatus || 'N/A',
            creditClearanceOn: inResults.accountOverview?.creditClearanceOn || 'N/A',
            dedicatedAccounts: inResults.dedicatedAccounts || [],
            offers: inResults.offers || [],
            screenshotCount: screenshots.length,
            screenshots: screenshots,
            remarks: inTestPassed ? 'IN test completed successfully' : 'IN test failed'
          });

          const screenshotEntries = rechargePage.getScreenshots().filter(s => s.msisdn === row.msisdn);
          excelReportService.addScreenshots(screenshotEntries);

          console.log(`[Recharge UAT] IN test completed: ${inTestPassed ? 'COMPLETED' : 'FAIL'}`);
        } else {
          rowResult.inStatus = 'Skip';
          reportColStatus(rowIndex, row.msisdn, 'in', 'skipped', 'IN not required');
        }

        // ─── SWIFT Yes case ──────────────────────────────────────────────────
        if (swiftFlag === 'yes') {
          console.log(`[Recharge UAT] 🔄 Running SWIFT test for ${row.msisdn}`);
          reportColStatus(rowIndex, row.msisdn, 'swift', 'running', 'SWIFT test in progress');

          await rechargePage.enterMSISDN(row.msisdn);
          await rechargePage.clickSearchButton();
          await browser.pause(2000);

          const swiftResults = await rechargePage.runSwiftTest(row.msisdn, row.rechargeMRP);
          rowSwiftResults = swiftResults;

          console.log(`[Recharge UAT] Swift Results - Success: ${swiftResults.success}`);
          console.log(`[Recharge UAT] Swift Results - Offer History Count: ${swiftResults.offerHistory?.length || 0}`);

          const voiceUsage = swiftResults.totalUsage?.voice || [];
          const dataUsage = swiftResults.totalUsage?.data || [];
          const smsUsage = swiftResults.totalUsage?.sms || [];
          const unlimitedOffers = swiftResults.unlimitedOffers || [];
          const vasOffers = swiftResults.vasOffers || [];
          
          let upssPromotional: any[] = [];
          if (!SKIP_UPSS_PROCESSING) {
            upssPromotional = swiftResults.upssPromotional || [];
          }

          if (!SKIP_UPSS_PROCESSING) {
            if (swiftFlag === 'yes' && rowSwiftResults) {
              const upssPromotionalData = rowSwiftResults.upssPromotional || [];
              
              if (upssPromotionalData.length > 0) {
                excelReportService.addUpssPromoHistory(row.msisdn, upssPromotionalData);
                console.log(`[Recharge UAT] Added ${upssPromotionalData.length} UPSS promo history row(s) for ${row.msisdn}`);
                reportColStatus(rowIndex, row.msisdn, 'upss', 'completed', `Found ${upssPromotionalData.length} UPSS promotional entries`);
              } else {
                reportColStatus(rowIndex, row.msisdn, 'upss', 'skipped', 'No UPSS promotional entries found');
              }
            } else {
              reportColStatus(rowIndex, row.msisdn, 'upss', 'skipped', 'UPSS skipped - SWIFT not run');
            }
          } else {
            console.log(`[Recharge UAT] ⏭ UPSS processing skipped for ${row.msisdn} (SKIP_UPSS_PROCESSING=true)`);
            reportColStatus(rowIndex, row.msisdn, 'upss', 'skipped', 'UPSS processing disabled by configuration');
          }

          const offerHistoryItems = swiftResults.offerHistory || [];

          console.log(`[Recharge UAT] Found ${offerHistoryItems.length} offer history item(s) for ${row.msisdn}`);

          const screenshots = rechargePage.getScreenshotsForMSISDN(row.msisdn);
          const screenshotEntries = rechargePage.getScreenshots().filter(s => s.msisdn === row.msisdn);

          const hasPass = offerHistoryItems.some((item: any) => item.matchStatus === 'Pass');
          const hasMatchedButFailed = offerHistoryItems.some((item: any) => item.isMatched && item.matchStatus !== 'Pass');

          let overallSwiftStatus = 'Fail';
          if (hasPass && swiftResults.success) {
            overallSwiftStatus = 'Pass';
          } else if (hasMatchedButFailed && swiftResults.success) {
            overallSwiftStatus = 'Fail';
          } else if (offerHistoryItems.length > 0 && swiftResults.success) {
            overallSwiftStatus = 'Mismatch';
          }

          rowResult.swiftStatus = overallSwiftStatus;
          if (overallSwiftStatus !== 'Pass') {
            rowResult.overallStatus = 'Fail';
            rowResult.reason = 'SWIFT test failed or mismatch';
          }

          if (offerHistoryItems.length === 0) {
            const uatResult: any = {
              msisdn: row.msisdn,
              circle: subscriberInfo.circle || row.circle || 'N/A',
              mrp: row.rechargeMRP,
              planName: row.planBenefit || 'N/A',
              rechargeNotification: row.rechargeNotification || 'N/A',
              inStatus: 'Skip',
              swiftStatus: 'Fail',
              viAppStatus: viAppFlag === 'yes' ? 'Pending' : 'Skip',
              transactionId: `SWIFT-${row.msisdn}-${Date.now()}`,
              activationDateTime: new Date().toLocaleString(),
              validity: subscriberInfo.serviceValidity || 'N/A',
              activationMode: 'SWIFT Portal',
              currentCoreBalance: subscriberInfo.coreBalance || 'N/A',
              etopupTransactionId: 'N/A',
              retailerMsisdn: row.msisdn,
              name: subscriberInfo.customerName || 'N/A',
              category: 'SWIFT Recharge',
              benefits: row.planBenefit || 'N/A',
              detailValidity: subscriberInfo.serviceValidity || 'N/A',
              accountStatus: subscriberInfo.accountStatus || 'N/A',
              userType: subscriberInfo.userType || 'N/A',
              reason: 'No offer history rows found in SWIFT offer history tab',
              allOfferHistory: [],
              voiceUsage: voiceUsage,
              dataUsage: dataUsage,
              smsUsage: smsUsage,
              unlimitedOffers: unlimitedOffers,
              vasOffers: vasOffers,
              screenshots: screenshots
            };
            
            if (!SKIP_UPSS_PROCESSING) {
              uatResult.upssPromotional = upssPromotional;
            }
            
            excelReportService.addUATResult(uatResult);
          } else {
            offerHistoryItems.forEach((item: any, idx: number) => {
              const itemSwiftStatus = mapMatchStatusToSwiftStatus(item.matchStatus);

              const uatResult: any = {
                msisdn: row.msisdn,
                circle: subscriberInfo.circle || row.circle || 'N/A',
                mrp: item.mrp || row.rechargeMRP,
                planName: row.planBenefit || 'N/A',
                rechargeNotification: row.rechargeNotification || 'N/A',
                inStatus: 'Skip',
                swiftStatus: itemSwiftStatus,
                viAppStatus: viAppFlag === 'yes' ? 'Pending' : 'Skip',
                transactionId: item.transactionId || `SWIFT-${row.msisdn}-${idx}-${Date.now()}`,
                activationDateTime: item.activationDateTime || 'N/A',
                validity: item.validity || 'N/A',
                activationMode: item.activationMode || 'N/A',
                currentCoreBalance: item.currentCoreBalance || subscriberInfo.coreBalance || '0.00',
                etopupTransactionId: item.etopupTransactionId || 'N/A',
                retailerMsisdn: item.retailerMsisdn || row.msisdn,
                name: item.name || subscriberInfo.customerName || 'N/A',
                category: item.category || 'SWIFT Recharge',
                benefits: item.benefits || row.planBenefit || 'N/A',
                detailValidity: item.detailValidity || 'N/A',
                accountStatus: subscriberInfo.accountStatus || 'N/A',
                userType: subscriberInfo.userType || 'N/A',
                reason: item.matchReason || 'N/A',
                allOfferHistory: offerHistoryItems,
                voiceUsage: voiceUsage,
                dataUsage: dataUsage,
                smsUsage: smsUsage,
                unlimitedOffers: unlimitedOffers,
                vasOffers: vasOffers,
                screenshots: screenshots
              };
              
              if (!SKIP_UPSS_PROCESSING) {
                uatResult.upssPromotional = upssPromotional;
              }
              
              excelReportService.addUATResult(uatResult);
            });
          }

          excelReportService.addScreenshots(screenshotEntries);
          console.log(`[Recharge UAT] SWIFT test: ${swiftResults.success ? 'COMPLETED' : 'FAIL'}`);
        } else {
          rowResult.swiftStatus = 'Skip';
          reportColStatus(rowIndex, row.msisdn, 'swift', 'skipped', 'SWIFT not required');
        }

        // ─── Vi App Test ──────────────────────────────────────────────────────
        if (viAppFlag === 'yes') {
          console.log(`[Vi App]  Running Vi App flow for ${row.msisdn}`);
          reportColStatus(rowIndex, row.msisdn, 'viApp', 'running', 'Vi App test in progress');

          try {
            const matchedPlan = {
              newMRP: row.rechargeMRP,
              benefit: row.planBenefit || 'N/A',
              rechargeNotification: row.rechargeNotification || 'N/A'
            };

            await viAppPage.runViAppFlow(
              row.msisdn,
              row.rechargeMRP,
              row.circle,
              matchedPlan,
              process.env.VI_APP_OTP ?? undefined
            );
            console.log(`[Vi App]  Completed for ${row.msisdn}`);
            rowResult.viAppStatus = 'Pass';

            const results = (excelReportService as any)['uatResults'] || [];
            const existing = results.find((r: any) => r.msisdn === row.msisdn);
            if (existing) {
              existing.viAppStatus = 'Pass';
            }
          } catch (viError: any) {
            console.error(`[Vi App] ❌ Failed for ${row.msisdn}: ${viError.message}`);
            rowResult.viAppStatus = 'Fail';
            rowResult.overallStatus = 'Fail';
            rowResult.reason = `Vi App test failed: ${viError.message}`;
            reportColStatus(rowIndex, row.msisdn, 'viApp', 'failed', rowResult.reason);

            const results = (excelReportService as any)['uatResults'] || [];
            const existing = results.find((r: any) => r.msisdn === row.msisdn);
            if (existing) {
              existing.viAppStatus = 'Fail';
            }
          }
        } else {
          rowResult.viAppStatus = 'Skip';
          console.log(`[Vi App] ⏭ Vi App="${row.viApp}" — skipping`);
          reportColStatus(rowIndex, row.msisdn, 'viApp', 'skipped', 'Vi App not required');
        }

        // ─── Generate Final Analysis Report ──────────────────────────────────
        if (inFlag === 'yes' || swiftFlag === 'yes') {
          try {
            const ctx: FinalAnalysisContext = {
              inputRow: {
                msisdn: row.msisdn,
                circle: row.circle,
                rechargeMRP: row.rechargeMRP,
                planBenefit: row.planBenefit,
                rechargeNotification: row.rechargeNotification
              },
              testDate: new Date().toLocaleDateString('en-CA'), 
              subscriberInfo: rowSubscriberInfo || {
                customerName: subscriberInfo?.customerName || 'N/A',
                coreBalance: subscriberInfo?.coreBalance || 'N/A',
                serviceValidity: subscriberInfo?.serviceValidity || 'N/A',
                accountStatus: subscriberInfo?.accountStatus || 'N/A',
                userType: subscriberInfo?.userType || 'N/A',
                circle: subscriberInfo?.circle || row.circle
              },
              inResults: rowInResults ? {
                ...rowInResults,
                success: rowInResults.success === true
              } : undefined,
              swiftResults: rowSwiftResults || undefined,
              screenshots: rechargePage.getScreenshots().filter(s => s.msisdn === row.msisdn),
              inRan: inFlag === 'yes',
              swiftRan: swiftFlag === 'yes',
              masterPlanBenefit: row.planBenefit || undefined,
              masterRechargeNotification: row.rechargeNotification || undefined,
            };

            const analysisResult = await finalAnalysisReportService.writeReport(ctx);
            console.log(`[Recharge UAT] ✅ Analysis Report generated: ${analysisResult.zipPath}`);
            
          } catch (analysisErr: any) {
            console.error(`[Recharge UAT] ⚠️ Analysis Report generation failed: ${analysisErr.message}`);
            rowResult.overallStatus = 'Fail';
            rowResult.reason = `Analysis failed: ${analysisErr.message}`;
          }
        }

        // ─── Handle case when neither IN nor SWIFT nor Recharge ─────────────
        if (inFlag !== 'yes' && swiftFlag !== 'yes' && rechargeFlag !== 'yes') {
          console.log(`[Recharge UAT] ⏭ Neither IN, SWIFT, nor Recharge, capturing basic info`);

          const screenshots = rechargePage.getScreenshotsForMSISDN(row.msisdn);
          excelReportService.addUATResult({
            msisdn: row.msisdn,
            circle: row.circle,
            mrp: row.rechargeMRP,
            planName: row.planBenefit || 'N/A',
            rechargeNotification: row.rechargeNotification || 'N/A',
            inStatus: 'Skip',
            swiftStatus: 'Skip',
            viAppStatus: viAppFlag === 'yes' ? 'Pending' : 'Skip',
            transactionId: `N/A`,
            activationDateTime: new Date().toLocaleString(),
            validity: subscriberInfo.serviceValidity || 'N/A',
            activationMode: 'N/A',
            currentCoreBalance: subscriberInfo.coreBalance || 'N/A',
            etopupTransactionId: `N/A`,
            retailerMsisdn: row.msisdn,
            name: subscriberInfo.customerName || 'N/A',
            category: 'N/A',
            benefits: row.planBenefit || 'N/A',
            detailValidity: subscriberInfo.serviceValidity || 'N/A',
            screenshots: screenshots
          });

          const screenshotEntries = rechargePage.getScreenshots().filter(s => s.msisdn === row.msisdn);
          excelReportService.addScreenshots(screenshotEntries);
        }

        // ─── Row completion ──────────────────────────────────────────────────
        rowResult.overallStatus = determineOverallStatus(rowResult);
        testResults.push(rowResult);

        reportRowEvent('row_completed', rowIndex, row.msisdn, {
          message: 'Row processed successfully',
          overallStatus: rowResult.overallStatus
        });

        // ─── REMOVED: Duplicate SIM_Recharge_Report generation ──────────────
        // Reports are now generated ONLY in the 'after' hook
        // This eliminates duplicate report generation

        console.log(`[Recharge UAT]  Row ${srNo} completed successfully - Overall Status: ${rowResult.overallStatus}\n`);

      } catch (rowErr: any) {
        console.error(`[Recharge UAT] ❌ Row ${srNo} (${row.msisdn}) failed: ${rowErr.message}`);
        rowResult.overallStatus = 'Fail';
        rowResult.reason = rowErr.message || 'Unknown error';
        testResults.push(rowResult);
        reportRowEvent('row_failed', rowIndex, row.msisdn, { error: rowErr.message });

        // ─── REMOVED: Duplicate SIM_Recharge_Report generation ──────────────
        // Reports are now generated ONLY in the 'after' hook
        // This eliminates duplicate report generation
      }
    }
  });
});