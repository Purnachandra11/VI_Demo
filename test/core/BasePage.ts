import type { AndroidDriver } from '../types/driver';
import { ScreenshotUtils } from '../utils/ScreenshotUtils';

/**  com.telecom.core.BasePage */
export abstract class BasePage {
  protected readonly waitTimeoutMs = 30_000;

  constructor(
    protected readonly driver: AndroidDriver,
    protected readonly screenshotUtils?: ScreenshotUtils
  ) {}

  protected async click(selector: string, screenshotName?: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: this.waitTimeoutMs });
    await el.click();
    await this.driver.pause(1500);
    if (screenshotName && this.screenshotUtils) {
      await this.screenshotUtils.captureScreenshot(screenshotName);
    }
  }

  protected async isDisplayed(selector: string): Promise<boolean> {
    try {
      const el = await this.driver.$(selector);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  protected async getText(selector: string): Promise<string | null> {
    try {
      const el = await this.driver.$(selector);
      await el.waitForDisplayed({ timeout: this.waitTimeoutMs });
      return await el.getText();
    } catch {
      return null;
    }
  }
}
