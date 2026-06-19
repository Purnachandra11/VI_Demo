/** Appium server helpers —  AppiumConfig (WDIO usually manages the server externally) */

const DEFAULT_HOST = process.env.APPIUM_HOST || '127.0.0.1';
const DEFAULT_PORT = parseInt(process.env.APPIUM_PORT || '4723', 10);

export class AppiumConfig {
  static getAppiumServerURL(): string {
    return `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
  }

  static async isServerRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${this.getAppiumServerURL()}/status`, {
        signal: AbortSignal.timeout(3000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  static async startAppiumServer(): Promise<void> {
    if (await this.isServerRunning()) {
      console.log('[AppiumConfig] Server already running');
      return;
    }
    console.warn(
      '[AppiumConfig] Start Appium manually: appium — or set APPIUM_HOST/APPIUM_PORT'
    );
  }

  static async stopAppiumServer(): Promise<void> {
    console.log('[AppiumConfig] WDIO does not stop external Appium — leave server running for dashboard');
  }
}
