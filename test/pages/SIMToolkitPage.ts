import type { AndroidDriver } from '../types/driver';
import { SIMType, VI_BRANDING_TEXTS, FLASH_OPTION, ROAMING_OPTION, VODAFONE_IN_OPTION, INTERNATIONAL_OPTION } from '../config/SIMToolkitConfig';
import { ScreenshotUtils } from '../utils/ScreenshotUtils';
import { DeviceUtils } from '../utils/DeviceUtils';
import { reportSIMLatchProgress } from '../utils/progressReporter';

export class SIMToolkitPage {
  private readonly deviceUtils: DeviceUtils;

  constructor(
    private readonly driver: AndroidDriver,
    private readonly screenshotUtils: ScreenshotUtils,
    private readonly deviceId: string
  ) {
    this.deviceUtils = new DeviceUtils(driver);
  }

  async detectAndHandleSIMScenario(): Promise<SIMType> {
    console.log('┌─ Step 2: Detect & Handle SIM Scenario');
    await this.reportProgress('STARTED', 'Starting SIM Toolkit detection', 10);

    const simType = await this.deviceUtils.detectSIMType();
    console.log(`  Detected: ${simType}`);

    await this.captureScreenshot('Vi Menu Home');
    await this.reportProgress('COMPLETED', 'SIM scenario handled', 40);
    return simType;
  }

  async navigateToFlashOption(): Promise<void> {
    console.log('  → Navigate to Flash');
    await this.clickByText(FLASH_OPTION);
    await this.captureScreenshot('Flash Option');
    await this.deviceUtils.navigateBack();
  }

  async navigateToRoamingOption(): Promise<void> {
    console.log('  → Navigate to Roaming');
    await this.clickByText(ROAMING_OPTION);
    await this.captureScreenshot('Roaming Option');
  }

  async validateRoamingSubMenus(): Promise<void> {
    await this.clickByText(VODAFONE_IN_OPTION);
    await this.captureScreenshot('Vodafone IN');
    await this.deviceUtils.navigateBack();
    await this.clickByText(INTERNATIONAL_OPTION);
    await this.captureScreenshot('International Roaming');
    await this.deviceUtils.navigateBack();
    await this.deviceUtils.navigateBack();
  }

  async verifyViBranding(): Promise<boolean> {
    for (const text of VI_BRANDING_TEXTS) {
      if (await this.deviceUtils.isElementPresent(text)) {
        await this.captureScreenshot('Vi Branding Verified');
        return true;
      }
    }
    return false;
  }

  async completeSIMToolkitTest(): Promise<void> {
    await this.detectAndHandleSIMScenario();
    await this.verifyViBranding();
    await this.navigateToFlashOption();
    await this.navigateToRoamingOption();
    await this.validateRoamingSubMenus();
  }

  async captureScreenshot(stepName: string): Promise<void> {
    await this.screenshotUtils.captureScreenshot(stepName);
  }

  private async clickByText(text: string): Promise<void> {
    const el = await this.driver.$(`//*[contains(@text, "${text}")]`);
    await el.waitForDisplayed({ timeout: 15_000 });
    await el.click();
    await this.driver.pause(1000);
  }

  private async reportProgress(action: string, status: string, pct: number): Promise<void> {
    await reportSIMLatchProgress(this.deviceId, action, status, pct);
  }
}
