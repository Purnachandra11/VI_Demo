import { browser, $ } from '@wdio/globals';
import * as fs from 'fs';
import * as path from 'path';

// ── Comm directory (inside swift-crm-automation/) ──────────────────────────
const COMM_DIR             = path.resolve('./comm');
const CAPTCHA_REQUEST_FILE = path.join(COMM_DIR, 'captcha_request.json');
const CAPTCHA_RESPONSE_FILE= path.join(COMM_DIR, 'captcha_response.json');

// ── Where timestamped CAPTCHA screenshots are saved ─────────────────────────
const CAPTCHA_SCREENSHOTS_DIR = path.resolve('./captcha_screenshots');

export class CaptchaHelper {

  static async solve(): Promise<{ captcha: string; username: string; password: string }> {
    // CI / pre-supplied override
    if (process.env.CAPTCHA_ANSWER) {
      console.log(`[CaptchaHelper] Using pre-supplied CAPTCHA: ${process.env.CAPTCHA_ANSWER}`);
      return {
        captcha: process.env.CAPTCHA_ANSWER,
        username: process.env.SWIFT_USERNAME || '',
        password: process.env.SWIFT_PASSWORD || ''
      };
    }

    // ── 1. Locate the CAPTCHA image element ──────────────────────────────
    const captchaEl = await $('//*[@id="LoginCaptcha"]');
    await captchaEl.waitForDisplayed({ timeout: 15000 });

    // ── 2. Screenshot the element ────────────────────────────────────────
    const filename = await CaptchaHelper.screenshotElement(captchaEl);
    const imageUrl = `/captcha-images/${filename}`;

    console.log(`[CaptchaHelper] Saved: ${filename}  →  ${imageUrl}`);

    // ── 3. Write request file with credentials request ───────────────────
    fs.mkdirSync(COMM_DIR, { recursive: true });
    fs.writeFileSync(CAPTCHA_REQUEST_FILE, JSON.stringify({
      timestamp: Date.now(),
      filename: filename,
      imageUrl: imageUrl,
      requiresCredentials: true,  // Flag to show username/password fields
    }, null, 2));

    // Remove any stale response
    if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) fs.unlinkSync(CAPTCHA_RESPONSE_FILE);

    // ── 4. Poll for user's response (max 5 min) ──────────────────────────
    const maxWait  = 5 * 60 * 1000;
    const interval = 500;
    const start    = Date.now();
    let response   = null;

    while (!response && (Date.now() - start) < maxWait) {
      if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
        try {
          const raw  = fs.readFileSync(CAPTCHA_RESPONSE_FILE, 'utf8');
          const data = JSON.parse(raw);
          if (data.answer && data.username && data.password) {
            response = {
              captcha: data.answer,
              username: data.username,
              password: data.password
            };
            console.log(`[CaptchaHelper] Got credentials for user: ${data.username}`);
          } else if (data.answer) {
            // Fallback: only CAPTCHA provided
            response = {
              captcha: data.answer,
              username: '',
              password: ''
            };
          }
        } catch (_) { /* file may be mid-write, retry */ }
      }
      await browser.pause(interval);
    }

    // ── 5. Cleanup ────────────────────────────────────────────────────────
    [CAPTCHA_REQUEST_FILE, CAPTCHA_RESPONSE_FILE].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    if (!response) throw new Error('[CaptchaHelper] Timeout — no response within 5 minutes');
    if (!response.captcha) throw new Error('[CaptchaHelper] No CAPTCHA answer provided');

    return response;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PRIVATE: screenshotElement()
  // ─────────────────────────────────────────────────────────────────────────
  private static async screenshotElement(el: WebdriverIO.Element): Promise<string> {
    fs.mkdirSync(CAPTCHA_SCREENSHOTS_DIR, { recursive: true });

    const timestamp = Date.now();
    const filename  = `captcha_${timestamp}.png`;
    const filepath  = path.join(CAPTCHA_SCREENSHOTS_DIR, filename);

    await el.saveScreenshot(filepath);
    console.log(`[CaptchaHelper] Element screenshot saved → ${filepath}`);

    return filename;
  }
}