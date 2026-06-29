/**
 * swift_recharge_spec.ts — IN + SWIFT Testing with Network Error Handling
 */

import { browser } from '@wdio/globals';
import { SwiftLoginPage } from '../pages/SwiftLoginPage';
import { RechargePage } from '../pages/RechargePage';
import { ViAppPage } from '../pages/ViAppPage';
import { ExcelReportService } from '../services/ExcelReportService';
import { ExcelDataService } from '../services/ExcelDataService';
import * as path from 'path';
import * as fs from 'fs';

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
  planBenefit: string;
  rechargeNotification: string;
}

function readMatchedRows(): MatchedRow[] {
  if (!fs.existsSync(MATCHED_ROWS_FILE)) {
    throw new Error(
      `[Recharge UAT] matched_rows.json not found at ${MATCHED_ROWS_FILE}.`
    );
  }
  const raw = fs.readFileSync(MATCHED_ROWS_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('[Recharge UAT] matched_rows.json must contain a JSON array.');
  }
  return parsed;
}

// ─── Helper: Report row status to orchestrator ──────────────────────────────
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

// ─── Helper: Report test status for columns ──────────────────────────────────
function reportColStatus(rowIndex: number, msisdn: string, col: string, status: string, message: string = '') {
  console.log(`[${col.toUpperCase()}_TEST] ${JSON.stringify({ rowIndex, msisdn, status, message })}`);
}

// ─── Helper: Check if page is accessible ────────────────────────────────────
async function isPageAccessible(url: string, maxRetries: number = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[Recharge UAT] Attempt ${i + 1}/${maxRetries} to load ${url}...`);
      await browser.url(url);
      await browser.pause(3000);
      
      const title = await browser.getTitle();
      const urlCurrent = await browser.getUrl();
      
      if (!title.includes('502') && !title.includes('Proxy Error') && !title.includes('Error')) {
        console.log(`[Recharge UAT] ✅ Page loaded successfully: ${title}`);
        return true;
      }
      
      const pageSource = await browser.getPageSource();
      if (pageSource.includes('502') || pageSource.includes('Proxy Error')) {
        console.log(`[Recharge UAT] ⚠️ 502 Proxy Error detected, retrying...`);
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

// ─── Helper: Handle SSL certificate warning ────────────────────────────────
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
        console.log('[Recharge UAT] Clicking proceed link...');
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

// ─── Helper: Wait for login page ──────────────────────────────────────────
async function waitForLoginPage(): Promise<boolean> {
  console.log('[Recharge UAT] ⏳ Waiting for login page to load...');
  
  const maxWait = 120 * 1000;
  const start = Date.now();
  
  while (Date.now() - start < maxWait) {
    try {
      const profileTab = await browser.$('a#ac_agent_profile');
      const isProfileDisplayed = await profileTab.isDisplayed();
      if (isProfileDisplayed) {
        console.log('[Recharge UAT] ✅ Already logged in!');
        return true;
      }
      
      const captchaImg = await browser.$('img#LoginCaptcha');
      const isCaptchaDisplayed = await captchaImg.isDisplayed();
      if (isCaptchaDisplayed) {
        console.log('[Recharge UAT] ✅ CAPTCHA detected on login page');
        return true;
      }
      
      const usernameField = await browser.$('//*[@id="tempusername"]');
      const isUsernameDisplayed = await usernameField.isDisplayed();
      if (isUsernameDisplayed) {
        console.log('[Recharge UAT] ✅ Login form detected');
        return true;
      }
      
      const passwordField = await browser.$('//*[@id="temppassword"]');
      const isPasswordDisplayed = await passwordField.isDisplayed();
      if (isPasswordDisplayed) {
        console.log('[Recharge UAT] ✅ Login form detected');
        return true;
      }
      
      const url = await browser.getUrl();
      if (url.includes('/login') || url.includes('swiftcrm')) {
        console.log('[Recharge UAT] Still on login page, waiting...');
      }
      
    } catch (_e) {
      // Ignore errors and continue
    }
    
    await browser.pause(1000);
  }
  
  console.log('[Recharge UAT] ⚠️ Login page not detected within timeout');
  return false;
}

// ─── Helper: Handle login with CAPTCHA ──────────────────────────────────────
async function handleLoginWithCaptcha(): Promise<boolean> {
  console.log('[Recharge UAT]  Handling login with CAPTCHA...');
  
  try {
    const profileTab = await browser.$('a#ac_agent_profile');
    const isProfileDisplayed = await profileTab.isDisplayed();
    if (isProfileDisplayed) {
      console.log('[Recharge UAT] ✅ Already logged in!');
      fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ 
        isLoggedIn: true, 
        timestamp: Date.now() 
      }, null, 2));
      return true;
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
      let response = null;
      
      while (!response && Date.now() - start < maxWait) {
        if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
          try {
            const raw = fs.readFileSync(CAPTCHA_RESPONSE_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (data.answer) {
              response = data;
              console.log(`[Recharge UAT] ✅ CAPTCHA response received: ${data.answer}`);
              if (fs.existsSync(CAPTCHA_REQUEST_FILE)) fs.unlinkSync(CAPTCHA_REQUEST_FILE);
              if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) fs.unlinkSync(CAPTCHA_RESPONSE_FILE);
            }
          } catch (_e) {}
        }
        
        const profileCheck = await browser.$('a#ac_agent_profile');
        const isProfileCheckDisplayed = await profileCheck.isDisplayed();
        if (isProfileCheckDisplayed) {
          console.log('[Recharge UAT] ✅ Manual login detected!');
          fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ 
            isLoggedIn: true, 
            timestamp: Date.now() 
          }, null, 2));
          return true;
        }
        
        await browser.pause(500);
      }
      
      if (!response) {
        console.log('[Recharge UAT] ⚠️ CAPTCHA response timeout');
        return false;
      }
      
      const captchaInput = await browser.$('//*[@id="captcha"]');
      await captchaInput.waitForDisplayed({ timeout: 10000 });
      await captchaInput.clearValue();
      await captchaInput.setValue(response.answer);
      console.log('[Recharge UAT] ✅ CAPTCHA entered');
      
      if (response.username) {
        const usernameInput = await browser.$('//*[@id="tempusername"]');
        await usernameInput.waitForDisplayed({ timeout: 5000 });
        await usernameInput.clearValue();
        await usernameInput.setValue(response.username);
        console.log(`[Recharge UAT] ✅ Username entered: ${response.username}`);
      }
      
      if (response.password) {
        const passwordInput = await browser.$('//*[@id="temppassword"]');
        await passwordInput.waitForDisplayed({ timeout: 5000 });
        await browser.execute((el: any) => {
          el.removeAttribute('readonly');
        }, passwordInput);
        await passwordInput.clearValue();
        await passwordInput.setValue(response.password);
        console.log('[Recharge UAT] ✅ Password entered');
      }
      
      const loginBtn = await browser.$('//*[@id="loginForm"]/div[2]/div[2]/form/button');
      await loginBtn.click();
      console.log('[Recharge UAT] ✅ Login button clicked');
      
      await browser.pause(5000);
      
      const profileTabAfter = await browser.$('a#ac_agent_profile');
      const isProfileAfterDisplayed = await profileTabAfter.isDisplayed();
      if (isProfileAfterDisplayed) {
        console.log('[Recharge UAT] ✅ Login successful!');
        fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ 
          isLoggedIn: true, 
          timestamp: Date.now() 
        }, null, 2));
        return true;
      }
      
      console.log('[Recharge UAT] ⚠️ Login may have failed');
      return false;
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
          console.log('[Recharge UAT] ✅ Manual login detected!');
          fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ 
            isLoggedIn: true, 
            timestamp: Date.now() 
          }, null, 2));
          return true;
        }
        
        const captchaCheck = await browser.$('img#LoginCaptcha');
        const isCaptchaCheckDisplayed = await captchaCheck.isDisplayed();
        if (isCaptchaCheckDisplayed) {
          console.log('[Recharge UAT] CAPTCHA appeared - restarting login flow');
          return await handleLoginWithCaptcha();
        }
        
        await browser.pause(1000);
      }
      return false;
    }
    
    const profileFinal = await browser.$('a#ac_agent_profile');
    const isProfileFinalDisplayed = await profileFinal.isDisplayed();
    if (isProfileFinalDisplayed) {
      console.log('[Recharge UAT] ✅ Already logged in (final check)!');
      fs.writeFileSync(LOGIN_STATE_FILE, JSON.stringify({ 
        isLoggedIn: true, 
        timestamp: Date.now() 
      }, null, 2));
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('[Recharge UAT] Login error:', error);
    return false;
  }
}

// ─── Helper: Ensure we're on the recharge page ──────────────────────────────
async function ensureRechargePage(): Promise<void> {
  console.log('[Recharge UAT] Ensuring recharge page is loaded...');
  
  try {
    const msisdnInput = await browser.$('#mobforward');
    const isMsisdnDisplayed = await msisdnInput.isDisplayed();
    if (isMsisdnDisplayed) {
      console.log('[Recharge UAT] ✅ Already on recharge page');
      return;
    }
    
    try {
      const agentTab = await browser.$('//*[@id="agent-tab"]');
      const isAgentDisplayed = await agentTab.isDisplayed();
      if (isAgentDisplayed) {
        await agentTab.click();
        console.log('[Recharge UAT] ✅ Clicked agent tab');
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
      console.log('[Recharge UAT] ✅ Recharge page loaded');
      return;
    }
    
    try {
      const rechargeMenu = await browser.$('//*[contains(text(), "Recharge")]');
      const isMenuDisplayed = await rechargeMenu.isDisplayed();
      if (isMenuDisplayed) {
        await rechargeMenu.click();
        await browser.pause(3000);
        console.log('[Recharge UAT] ✅ Clicked Recharge menu');
        return;
      }
    } catch (_e) {}
    
    console.log('[Recharge UAT] ⚠️ Could not load recharge page');
    
  } catch (error) {
    console.warn('[Recharge UAT] Error ensuring recharge page:', error);
  }
}

// In swift_recharge_spec.ts, update the recharge confirmation wait

// ─── Helper: Wait for recharge confirmation ──────────────────────────────
async function waitForRechargeConfirmation(msisdn: string, timeoutMs: number = 300000): Promise<{ confirmed: boolean; skipped: boolean }> {
  console.log(`[Recharge UAT] ⏳ Waiting for recharge confirmation for ${msisdn}...`);
  
  const confirmFile = path.join(COMM_DIR, 'recharge_confirmed.json');
  const skipFile = path.join(COMM_DIR, 'recharge_skipped.json');
  
  // Clean up old files
  if (fs.existsSync(confirmFile)) fs.unlinkSync(confirmFile);
  if (fs.existsSync(skipFile)) fs.unlinkSync(skipFile);
  
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    // Check for confirmation
    if (fs.existsSync(confirmFile)) {
      try {
        const raw = fs.readFileSync(confirmFile, 'utf8');
        const data = JSON.parse(raw);
        if (data.msisdn === msisdn && data.confirmed === true) {
          console.log(`[Recharge UAT] ✅ Recharge confirmed for ${msisdn}`);
          fs.unlinkSync(confirmFile);
          return { confirmed: true, skipped: false };
        }
      } catch (parseErr) {
        // File may be mid-write
      }
    }
    
    // Check for skip
    if (fs.existsSync(skipFile)) {
      try {
        const raw = fs.readFileSync(skipFile, 'utf8');
        const data = JSON.parse(raw);
        if (data.msisdn === msisdn && data.skipped === true) {
          console.log(`[Recharge UAT] ⏭ Recharge skipped for ${msisdn}: ${data.reason || 'User skipped'}`);
          fs.unlinkSync(skipFile);
          return { confirmed: false, skipped: true };
        }
      } catch (parseErr) {
        // File may be mid-write
      }
    }
    
    await browser.pause(1000);
  }
  
  console.warn(`[Recharge UAT] ⚠️ Timeout waiting for recharge confirmation for ${msisdn}`);
  return { confirmed: false, skipped: false };
}

// ─── Main test ─────────────────────────────────────────────────────────────
describe('SWIFT CRM – IN + SWIFT Recharge UAT', () => {
  let loginPage: SwiftLoginPage;
  let rechargePage: RechargePage;
  let viAppPage: ViAppPage;
  let excelReportService: ExcelReportService;
  let excelDataService: ExcelDataService;
  let matchedRows: MatchedRow[] = [];
  let isLoggedIn = false;
  let inputRowsForReport: any[] = [];

  before(async () => {
    loginPage = new SwiftLoginPage();
    rechargePage = new RechargePage();
    viAppPage = new ViAppPage();
    excelReportService = new ExcelReportService();
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
    
    console.log(`[Recharge UAT] Loaded ${matchedRows.length} matched row(s)`);
    console.log(`[Recharge UAT] IN-Yes rows: ${matchedRows.filter(r => r.inFlag?.toLowerCase() === 'yes').length}`);
    console.log(`[Recharge UAT] SWIFT-Yes rows: ${matchedRows.filter(r => r.swift?.toLowerCase() === 'yes').length}`);
    console.log(`[Recharge UAT] Recharge-Yes rows: ${matchedRows.filter(r => r.recharge?.toLowerCase() === 'yes').length}`);
  });

  after(async () => {
    if (excelReportService.getResultCount() > 0) {
      try {
        const reportPath = await excelReportService.writeReport();
        console.log(`[Recharge UAT] Excel Report generated: ${reportPath}`);
        try {
          const pdfPath = await excelReportService.writePDFReport();
          console.log(`[Recharge UAT] HTML Report generated: ${pdfPath}`);
        } catch (pdfErr: any) {
          console.warn(`[Recharge UAT] HTML report generation: ${pdfErr.message}`);
        }
      } catch (reportErr: any) {
        console.error(`[Recharge UAT] Report generation failed: ${reportErr.message}`);
      }
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
      console.log('[Recharge UAT] ⚠️ Please check:');
      console.log('[Recharge UAT]   1. Your network connection');
      console.log('[Recharge UAT]   2. If the SWIFT CRM server is accessible');
      console.log('[Recharge UAT]   3. If you need to be on a specific VPN');
      console.log('[Recharge UAT]   4. Try accessing the URL manually in your browser:');
      console.log('[Recharge UAT]      https://swiftcrm.vodafoneidea.in/swift-portal/login');
      throw new Error('[Recharge UAT] ❌ Cannot access SWIFT CRM - check network connectivity');
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
    const loginSuccess = await handleLoginWithCaptcha();
    
    if (loginSuccess) {
      isLoggedIn = true;
      console.log('[Recharge UAT] ✅ Login successful!');
    } else {
      console.log('[Recharge UAT] ⚠️ Login not confirmed - waiting for manual login...');
      
      const maxWait = 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        try {
          const profileTab = await browser.$('a#ac_agent_profile');
          const isProfileDisplayed = await profileTab.isDisplayed();
          if (isProfileDisplayed) {
            isLoggedIn = true;
            console.log('[Recharge UAT] ✅ Manual login detected!');
            break;
          }
        } catch (_e) {}
        await browser.pause(1000);
      }
      
      if (!isLoggedIn) {
        console.log('[Recharge UAT] ⚠️ Still not logged in.');
        console.log('[Recharge UAT] Please login manually in the browser window.');
        console.log('[Recharge UAT] Continuing after 15 seconds...');
        await browser.pause(15000);
        
        try {
          const profileTab = await browser.$('a#ac_agent_profile');
          const isProfileDisplayed = await profileTab.isDisplayed();
          if (isProfileDisplayed) {
            isLoggedIn = true;
            console.log('[Recharge UAT] ✅ Login detected after wait!');
          }
        } catch (_e) {}
      }
    }

    if (!isLoggedIn) {
      console.error('[Recharge UAT] ❌ Could not login to SWIFT CRM. Please check your credentials.');
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

      try {
            // ════════════════════════════════════════════════════════════════════
            // 🔁 STEP 1: RECHARGE CONFIRMATION WAIT (BEFORE ANYTHING ELSE)
            // ════════════════════════════════════════════════════════════════════
            if (rechargeFlag === 'yes') {
              console.log(`[Recharge UAT] ✉️ Recharge=Yes — waiting for email confirmation for ${row.msisdn} BEFORE any tests...`);
              const txnId = `TXN-${row.msisdn}-${Date.now()}`;
              
              reportRowEvent('row_waiting_confirm', rowIndex, row.msisdn, { 
                transactionId: txnId,
                message: 'Waiting for recharge confirmation BEFORE tests...'
              });
              
              // Wait for recharge confirmation via file
              const result = await waitForRechargeConfirmation(row.msisdn, 300000);
              
              if (result.confirmed) {
                console.log(`[Recharge UAT] ✅ Recharge confirmed for ${row.msisdn} — proceeding with tests...`);
                reportRowEvent('row_recharge_confirmed', rowIndex, row.msisdn, {
                  transactionId: txnId
                });
                reportColStatus(rowIndex, row.msisdn, 'recharge', 'completed', 'Recharge confirmed via email');
              } else if (result.skipped) {
                console.log(`[Recharge UAT] ⏭ Recharge skipped for ${row.msisdn} — proceeding with tests...`);
                reportRowEvent('row_skipped', rowIndex, row.msisdn, {
                  reason: 'User skipped'
                });
                reportColStatus(rowIndex, row.msisdn, 'recharge', 'skipped', 'Recharge skipped by user');
              } else {
                console.warn(`[Recharge UAT] ⚠️ Recharge confirmation timeout for ${row.msisdn} — proceeding anyway...`);
                reportColStatus(rowIndex, row.msisdn, 'recharge', 'failed', 'Recharge confirmation timeout');
              }
            } else {
              reportColStatus(rowIndex, row.msisdn, 'recharge', 'skipped', 'Recharge not required');
            }

            // Report row start (after confirmation is done)
            reportRowEvent('row_start', rowIndex, row.msisdn);

            // --- MSISDN Entry ---
            await rechargePage.enterMSISDN(row.msisdn);
            await rechargePage.takeScreenshot(`Row${srNo}_Step1_Enter_MSISDN`);
        
        // --- Search ---
        await rechargePage.clickSearchButton();
        await rechargePage.takeScreenshot(`Row${srNo}_Step2_Click_Search`);
        
        // --- Subscriber Info ---
        const subscriberInfo = await rechargePage.captureSubscriberInfo(row.msisdn, srNo);
        await rechargePage.takeScreenshot(`Row${srNo}_Step3_Subscriber_Info`);
        
        console.log(`[Recharge UAT] Subscriber: ${subscriberInfo.customerName || 'N/A'}, Circle: ${subscriberInfo.circle || 'N/A'}`);
        console.log(`[Recharge UAT] Core Balance: ${subscriberInfo.coreBalance || 'N/A'}, Validity: ${subscriberInfo.serviceValidity || 'N/A'}`);
        
        // --- IN Test ---
        if (inFlag === 'yes') {
          console.log(`[Recharge UAT] 🔄 Running IN test for ${row.msisdn}`);
          reportColStatus(rowIndex, row.msisdn, 'in', 'running', 'IN test in progress');
          
          const inResults = await rechargePage.runINTest(row.msisdn, row.rechargeMRP);
          const inStatus = inResults.success ? 'completed' : 'failed';
          reportColStatus(rowIndex, row.msisdn, 'in', inStatus, inResults.success ? 'IN test passed' : 'IN test failed');
          
          const screenshots = rechargePage.getScreenshotsForMSISDN(row.msisdn);
          excelReportService.addUATResult({
            msisdn: row.msisdn,
            circle: row.circle,
            mrp: row.rechargeMRP,
            planName: row.planBenefit || 'N/A',
            rechargeNotification: row.rechargeNotification || 'N/A',
            inStatus: inResults.success ? 'Pass' : 'Fail',
            swiftStatus: 'Skip',
            viAppStatus: viAppFlag === 'yes' ? 'Pending' : 'Skip',
            transactionId: `IN-${row.msisdn}-${Date.now()}`,
            activationDateTime: new Date().toLocaleString(),
            validity: subscriberInfo.serviceValidity || '30 days',
            activationMode: 'IN Portal',
            currentCoreBalance: subscriberInfo.coreBalance || '0.00',
            etopupTransactionId: `ET-${Date.now()}`,
            retailerMsisdn: row.msisdn,
            name: subscriberInfo.customerName || 'N/A',
            category: 'IN Recharge',
            benefits: row.planBenefit || 'N/A',
            detailValidity: subscriberInfo.serviceValidity || '30 days',
            screenshots: screenshots
          });
          
          const screenshotEntries = rechargePage.getScreenshots().filter(s => s.msisdn === row.msisdn);
          excelReportService.addScreenshots(screenshotEntries);
          
          console.log(`[Recharge UAT] ✅ IN test completed: ${inResults.success ? 'PASS' : 'FAIL'}`);
        } else {
          reportColStatus(rowIndex, row.msisdn, 'in', 'skipped', 'IN not required');
        }

        // --- SWIFT Test ---
        if (swiftFlag === 'yes') {
          console.log(`[Recharge UAT] 🔄 Running SWIFT test for ${row.msisdn}`);
          reportColStatus(rowIndex, row.msisdn, 'swift', 'running', 'SWIFT test in progress');
          
          // Re-enter MSISDN and search for SWIFT test
          await rechargePage.enterMSISDN(row.msisdn);
          await rechargePage.clickSearchButton();
          await browser.pause(2000);
          
          const swiftResults = await rechargePage.runSwiftTest(row.msisdn, row.rechargeMRP);
          const swiftStatus = swiftResults.success ? 'completed' : 'failed';
          reportColStatus(rowIndex, row.msisdn, 'swift', swiftStatus, swiftResults.success ? 'SWIFT test passed' : 'SWIFT test failed');
          
          const screenshots = rechargePage.getScreenshotsForMSISDN(row.msisdn);
          
          const existingResult = (excelReportService as any)['uatResults']?.find((r: any) => r.msisdn === row.msisdn);
          if (existingResult) {
            existingResult.swiftStatus = swiftResults.success ? 'Pass' : 'Fail';
            existingResult.screenshots = [...(existingResult.screenshots || []), ...screenshots];
            existingResult.transactionId = `SWIFT-${row.msisdn}-${Date.now()}`;
            existingResult.benefits = row.planBenefit || 'N/A';
          } else {
            excelReportService.addUATResult({
              msisdn: row.msisdn,
              circle: row.circle,
              mrp: row.rechargeMRP,
              planName: row.planBenefit || 'N/A',
              rechargeNotification: row.rechargeNotification || 'N/A',
              inStatus: 'Skip',
              swiftStatus: swiftResults.success ? 'Pass' : 'Fail',
              viAppStatus: viAppFlag === 'yes' ? 'Pending' : 'Skip',
              transactionId: `SWIFT-${row.msisdn}-${Date.now()}`,
              activationDateTime: new Date().toLocaleString(),
              validity: subscriberInfo.serviceValidity || '30 days',
              activationMode: 'SWIFT Portal',
              currentCoreBalance: subscriberInfo.coreBalance || '0.00',
              etopupTransactionId: `ET-${Date.now()}`,
              retailerMsisdn: row.msisdn,
              name: subscriberInfo.customerName || 'N/A',
              category: 'SWIFT Recharge',
              benefits: row.planBenefit || 'N/A',
              detailValidity: subscriberInfo.serviceValidity || '30 days',
              screenshots: screenshots
            });
          }
          
          const screenshotEntries = rechargePage.getScreenshots().filter(s => s.msisdn === row.msisdn);
          excelReportService.addScreenshots(screenshotEntries);
          
          console.log(`[Recharge UAT] ✅ SWIFT test completed: ${swiftResults.success ? 'PASS' : 'FAIL'}`);
        } else {
          reportColStatus(rowIndex, row.msisdn, 'swift', 'skipped', 'SWIFT not required');
        }

        // --- Vi App Test ---
        if (viAppFlag === 'yes') {
          console.log(`[Vi App] ✅ Running Vi App flow for ${row.msisdn}`);
          reportColStatus(rowIndex, row.msisdn, 'viApp', 'running', 'Vi App test in progress');
          
          try {
            // Fix: runViAppFlow expects (msisdn, rechargeMRP, circle, matchedPlan, manualOtp)
            // We need to pass the matched plan info
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
            console.log(`[Vi App] ✅ Completed for ${row.msisdn}`);
            reportColStatus(rowIndex, row.msisdn, 'viApp', 'completed', 'Vi App test passed');
            
            const results = (excelReportService as any)['uatResults'] || [];
            const existing = results.find((r: any) => r.msisdn === row.msisdn);
            if (existing) {
              existing.viAppStatus = 'Pass';
            }
          } catch (viError: any) {
            console.error(`[Vi App] ❌ Failed for ${row.msisdn}: ${viError.message}`);
            reportColStatus(rowIndex, row.msisdn, 'viApp', 'failed', `Vi App test failed: ${viError.message}`);
            
            const results = (excelReportService as any)['uatResults'] || [];
            const existing = results.find((r: any) => r.msisdn === row.msisdn);
            if (existing) {
              existing.viAppStatus = 'Fail';
            }
          }
        } else {
          console.log(`[Vi App] ⏭ Vi App="${row.viApp}" — skipping`);
          reportColStatus(rowIndex, row.msisdn, 'viApp', 'skipped', 'Vi App not required');
        }

        // --- Handle case when neither IN nor SWIFT ---
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
            transactionId: `BASIC-${row.msisdn}-${Date.now()}`,
            activationDateTime: new Date().toLocaleString(),
            validity: subscriberInfo.serviceValidity || '30 days',
            activationMode: 'Manual',
            currentCoreBalance: subscriberInfo.coreBalance || '0.00',
            etopupTransactionId: `ET-${Date.now()}`,
            retailerMsisdn: row.msisdn,
            name: subscriberInfo.customerName || 'N/A',
            category: 'Basic',
            benefits: row.planBenefit || 'N/A',
            detailValidity: subscriberInfo.serviceValidity || '30 days',
            screenshots: screenshots
          });
          
          const screenshotEntries = rechargePage.getScreenshots().filter(s => s.msisdn === row.msisdn);
          excelReportService.addScreenshots(screenshotEntries);
        }

        // --- Row completion ---
        reportRowEvent('row_completed', rowIndex, row.msisdn, {
          message: 'Row processed successfully'
        });
        
        console.log(`[Recharge UAT] ✅ Row ${srNo} completed successfully\n`);
        
      } catch (rowErr: any) {
        console.error(`[Recharge UAT] ❌ Row ${srNo} (${row.msisdn}) failed: ${rowErr.message}`);
        reportRowEvent('row_failed', rowIndex, row.msisdn, {
          error: rowErr.message
        });
        
        const screenshots = rechargePage.getScreenshotsForMSISDN(row.msisdn);
        excelReportService.addUATResult({
          msisdn: row.msisdn,
          circle: row.circle,
          mrp: row.rechargeMRP,
          planName: row.planBenefit || 'N/A',
          rechargeNotification: row.rechargeNotification || 'N/A',
          inStatus: 'Fail',
          swiftStatus: 'Fail',
          viAppStatus: 'Fail',
          transactionId: `FAIL-${row.msisdn}-${Date.now()}`,
          activationDateTime: new Date().toLocaleString(),
          validity: 'N/A',
          activationMode: 'Error',
          currentCoreBalance: '0.00',
          etopupTransactionId: 'N/A',
          retailerMsisdn: row.msisdn,
          name: 'Error',
          category: 'Failed',
          benefits: row.planBenefit || 'N/A',
          detailValidity: 'N/A',
          screenshots: screenshots
        });
      }
    }

    console.log(`\n[Recharge UAT] 🎉 Batch complete — ${matchedRows.length} row(s) processed.`);
  });
});