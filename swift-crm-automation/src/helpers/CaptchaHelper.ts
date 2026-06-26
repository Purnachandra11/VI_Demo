import { browser, $ } from '@wdio/globals';
import * as fs from 'fs';
import * as path from 'path';

// ── Comm directory (inside swift-crm-automation/) ──────────────────────────
const COMM_DIR             = path.resolve('./comm');
const CAPTCHA_REQUEST_FILE = path.join(COMM_DIR, 'captcha_request.json');
const CAPTCHA_RESPONSE_FILE= path.join(COMM_DIR, 'captcha_response.json');

// ── Where timestamped CAPTCHA screenshots are saved ─────────────────────────
// Served by Express as  /captcha-images/<filename>
const CAPTCHA_SCREENSHOTS_DIR = path.resolve('./captcha_screenshots');

export class CaptchaHelper {

  // ─────────────────────────────────────────────────────────────────────────
  //  PUBLIC: solve()
  //  • Takes an element screenshot of  //*[@id="LoginCaptcha"]
  //  • Saves it as  captcha_<timestamp>.png
  //  • Writes { timestamp, filename, imageUrl } to captcha_request.json
  //  • Polls for captcha_response.json  { answer }
  // ─────────────────────────────────────────────────────────────────────────
  static async solve(): Promise<string> {

    // CI / pre-supplied override
    if (process.env.CAPTCHA_ANSWER) {
      console.log(`[CaptchaHelper] Using pre-supplied CAPTCHA: ${process.env.CAPTCHA_ANSWER}`);
      return process.env.CAPTCHA_ANSWER;
    }

    // ── 1. Locate the CAPTCHA image element via XPath ────────────────────
    const captchaEl = await $('//*[@id="LoginCaptcha"]');
    await captchaEl.waitForDisplayed({ timeout: 15000 });

    // ── 2. Screenshot the element, save with timestamp ───────────────────
    const filename = await CaptchaHelper.screenshotElement(captchaEl);
    const imageUrl = `/captcha-images/${filename}`;   // Express static route

    console.log(`[CaptchaHelper] ✅ Saved: ${filename}  →  ${imageUrl}`);

    // ── 3. Write request file — filename only, NO base64 ─────────────────
    fs.mkdirSync(COMM_DIR, { recursive: true });
    fs.writeFileSync(CAPTCHA_REQUEST_FILE, JSON.stringify({
      timestamp : Date.now(),
      filename  : filename,
      imageUrl  : imageUrl
    }, null, 2));

    // Remove any stale response
    if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) fs.unlinkSync(CAPTCHA_RESPONSE_FILE);

    // ── 4. Poll for user's answer (max 5 min) ────────────────────────────
    const maxWait  = 5 * 60 * 1000;
    const interval = 500;
    const start    = Date.now();
    let   answer   = '';

    while (!answer && (Date.now() - start) < maxWait) {
      if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
        try {
          const raw  = fs.readFileSync(CAPTCHA_RESPONSE_FILE, 'utf8');
          const data = JSON.parse(raw);
          if (data.answer) {
            answer = data.answer;
            console.log(`[CaptchaHelper]  Got answer: "${answer}"`);
          }
        } catch (_) { /* file may be mid-write, retry */ }
      }
      await browser.pause(interval);
    }

    // ── 5. Cleanup ────────────────────────────────────────────────────────
    [CAPTCHA_REQUEST_FILE, CAPTCHA_RESPONSE_FILE].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    if (!answer) throw new Error('[CaptchaHelper] Timeout — no CAPTCHA response within 5 minutes');

    return answer.trim();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PRIVATE: screenshotElement()
  //  WebdriverIO element.saveScreenshot() — no HTTP, no base64 in memory
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