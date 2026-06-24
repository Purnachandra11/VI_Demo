// test/utils/SiebelHelper.ts
// FIXED VERSION

import * as fs from 'fs';
import * as path from 'path';
import { browser, $ } from '@wdio/globals';

export class SiebelHelper {

  static async screenshot(label: string): Promise<string> {
    const dir = path.resolve(process.cwd(), 'screenshots', 'invoice');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${label}_${timestamp}.png`;
    const fullPath = path.join(dir, filename);

    await browser.saveScreenshot(fullPath);
    console.log(`   📸 Screenshot: ${path.basename(fullPath)}`);
    return fullPath;
  }

  static async waitForBodyText(text: string, timeoutMs = 20000): Promise<void> {
    await browser.waitUntil(
      async () => {
        const body = await $('body');
        const bodyText = await body.getText();
        return bodyText.toLowerCase().includes(text.toLowerCase());
      },
      {
        timeout: timeoutMs,
        interval: 500,
        timeoutMsg: `Text "${text}" not found in body within ${timeoutMs / 1000}s`,
      }
    );
  }

  static async waitForElement(xpath: string, timeoutMs = 15000) {
    const el = await $(xpath);
    await el.waitForDisplayed({ timeout: timeoutMs });
    return el;
  }

  static async safeClick(xpath: string, timeoutMs = 10000): Promise<void> {
    const el = await $(xpath);
    await el.waitForClickable({ timeout: timeoutMs });
    await el.scrollIntoView();
    await el.click();
  }

  static async safeSetValue(xpath: string, value: string): Promise<void> {
    const el = await $(xpath);
    await el.waitForDisplayed({ timeout: 10000 });
    await el.clearValue();
    await el.setValue(value);
  }

  static async getText(xpath: string): Promise<string> {
    try {
      const el = await $(xpath);
      await el.waitForDisplayed({ timeout: 5000 });
      return await el.getText();
    } catch {
      return '';
    }
  }

  static async isElementVisible(xpath: string): Promise<boolean> {
    try {
      const el = await $(xpath);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  static async waitForPDFLoad(timeoutMs = 30000): Promise<boolean> {
    try {
      await browser.waitUntil(
        async () => {
          const url = await browser.getUrl();
          if (url.toLowerCase().includes('.pdf')) return true;
          const embed = await $('embed[type="application/pdf"]');
          if (await embed.isExisting()) return true;
          const iframe = await $('iframe[src*=".pdf"]');
          if (await iframe.isExisting()) return true;
          return false;
        },
        { timeout: timeoutMs, interval: 1000 }
      );
      return true;
    } catch {
      return false;
    }
  }
}