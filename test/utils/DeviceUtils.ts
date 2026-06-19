import type { AndroidDriver } from '../types/driver';
import { SIMType } from '../config/SIMToolkitConfig';

/**  DeviceUtils */
export class DeviceUtils {
  constructor(private readonly driver: AndroidDriver) {}

  async detectSIMType(): Promise<SIMType> {
    try {
      const source = (await this.driver.getPageSource()).toLowerCase();
      const viCount = (source.match(/vi|vodafone/g) || []).length;
      if (viCount >= 2) return SIMType.DUAL_SIM_VI;
      if (source.includes('sim') && viCount >= 1) return SIMType.DUAL_SIM_MIXED;
    } catch {
      /* fallback */
    }
    return SIMType.SINGLE_SIM;
  }

  async isElementPresent(text: string): Promise<boolean> {
    try {
      const el = await this.driver.$(`//*[contains(@text, "${text}")]`);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  async navigateBack(): Promise<void> {
    try {
      await this.driver.back();
    } catch {
      await this.driver.pressKeyCode(4);
    }
    await this.driver.pause(500);
  }

  async launchApp(appPackage: string, appActivity: string): Promise<void> {
    await this.driver.execute('mobile: shell', {
      command: 'am',
      args: ['start', '-n', `${appPackage}/${appActivity}`]
    });
  }
}
