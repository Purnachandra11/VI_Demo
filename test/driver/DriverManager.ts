// D:\New VI UAT PROJECT\WIP\Automation Folder\VI Demo 31.05.2026\VI Demo\test\driver\DriverManager.ts

import { remote } from 'webdriverio';
import { browser as wdioBrowser } from '@wdio/globals';
import { ConfigReader } from '../config/ConfigReader';
import { ADBHelper } from '../utils/ADBHelper';
import type { AndroidDriver } from '../types/driver';
import { androidCapabilities, PROJECT_ROOT } from '../../config/wdio.shared';
import path from 'path';

const APPIUM_URL =
  process.env.APPIUM_URL ||
  `http://${process.env.APPIUM_HOST || '127.0.0.1'}:${process.env.APPIUM_PORT || '4723'}`;

let extraDriver: AndroidDriver | undefined;
let usingWdioSession = false;

function systemPortForDevice(deviceId: string): number {
  const hash = Math.abs(
    deviceId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  );
  return 8300 + (hash % 699);
}

/** DriverManager — WDIO-native session handling */
export class DriverManager {
  static async startAppiumService(): Promise<void> {
    try {
      const res = await fetch(`${APPIUM_URL}/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        console.log('[DriverManager] Appium server is running');
        return;
      }
    } catch {
      console.warn('[DriverManager] Appium not reachable — start with: appium');
    }
  }

  static async stopAppiumService(): Promise<void> {
    console.log('[DriverManager] Leaving Appium server running (dashboard reuse)');
  }

  static isServiceRunning(): boolean {
    return true;
  }

  private static baseCaps(deviceId: string, platformVersion: string) {
    return {
      ...androidCapabilities(deviceId),
      'appium:platformVersion': platformVersion,
      'appium:systemPort': systemPortForDevice(deviceId)
    };
  }

  /** Use WDIO global session when inside a WDIO test; otherwise create remote */
  private static async resolveBrowser(
    deviceId: string,
    platformVersion: string,
    appPackage?: string,
    appActivity?: string
  ): Promise<AndroidDriver> {
    try {
      if (wdioBrowser?.sessionId) {
        usingWdioSession = true;
        return wdioBrowser as AndroidDriver;
      }
    } catch {
      /* not in WDIO context */
    }

    const caps: WebdriverIO.Capabilities = {
      ...this.baseCaps(deviceId, platformVersion),
      ...(appPackage
        ? {
            'appium:appPackage': appPackage,
            'appium:appActivity': appActivity
          }
        : {})
    };

    extraDriver = (await remote({
      hostname: new URL(APPIUM_URL).hostname,
      port: parseInt(new URL(APPIUM_URL).port || '4723', 10),
      path: '/',
      capabilities: caps,
      logLevel: 'warn'
    })) as AndroidDriver;

    usingWdioSession = false;
    return extraDriver;
  }

  static async initializeDriver(
    deviceId: string,
    platformVersion: string
  ): Promise<AndroidDriver> {
    await ADBHelper.grantPermissions(deviceId);
    return this.resolveBrowser(
      deviceId,
      platformVersion,
      ConfigReader.getAppPackage(),
      ConfigReader.getAppActivity()
    );
  }

  static async initializeDriverForMessaging(
    deviceId: string,
    platformVersion: string
  ): Promise<AndroidDriver> {
    await ADBHelper.grantPermissions(deviceId);
    return this.resolveBrowser(
      deviceId,
      platformVersion,
      ConfigReader.getMessageAppPackage(),
      ConfigReader.getMessageAppActivity()
    );
  }

  static async initializeDriverForDataUsage(
    deviceId: string,
    platformVersion: string
  ): Promise<AndroidDriver> {
    return this.resolveBrowser(deviceId, platformVersion);
  }

  static async createDriverWithCapabilities(
    capabilities: WebdriverIO.Capabilities
  ): Promise<AndroidDriver> {
    extraDriver = (await remote({
      hostname: new URL(APPIUM_URL).hostname,
      port: parseInt(new URL(APPIUM_URL).port || '4723', 10),
      path: '/',
      capabilities,
      logLevel: 'warn'
    })) as AndroidDriver;
    usingWdioSession = false;
    return extraDriver;
  }

  static getDriver(): AndroidDriver | undefined {
    if (usingWdioSession) return wdioBrowser as AndroidDriver;
    return extraDriver;
  }

  static async quitDriver(): Promise<void> {
    if (extraDriver && !usingWdioSession) {
      await extraDriver.deleteSession();
      extraDriver = undefined;
    }
  }

  static getScreenshotRoot(): string {
    return path.join(PROJECT_ROOT, 'screenshots');
  }
}