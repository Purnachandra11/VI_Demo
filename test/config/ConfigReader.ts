import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../../config/wdio.shared';

const CONFIG_PATH = path.join(PROJECT_ROOT, 'src', 'test', 'resources', 'config.properties');

let properties: Record<string, string> = {};

function loadProperties(): void {
  if (Object.keys(properties).length) return;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        properties[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      }
    }
  } catch (e) {
    console.warn(`[ConfigReader] Could not load ${CONFIG_PATH}: ${(e as Error).message}`);
    properties = {};
  }
}

export class ConfigReader {
  static getProperty(key: string, defaultValue = ''): string {
    loadProperties();
    return process.env[key] ?? properties[key] ?? defaultValue;
  }

  static getAppPackage(): string {
    return this.getProperty('appPackage', 'com.google.android.dialer');
  }

  static getAppActivity(): string {
    return this.getProperty(
      'appActivity',
      'com.google.android.dialer.extensions.GoogleDialtactsActivity'
    );
  }

  static getMessageAppPackage(): string {
    return this.getProperty('messageAppPackage', 'com.google.android.apps.messaging');
  }

  static getMessageAppActivity(): string {
    return this.getProperty(
      'messageAppActivity',
      'com.google.android.apps.messaging.ui.ConversationListActivity'
    );
  }

  static getCallDuration(): number {
    return parseInt(this.getProperty('call.duration', '7'), 10) || 7;
  }

  static getSMSWaitTime(): number {
    return parseInt(this.getProperty('sms.wait.time', '5'), 10) || 5;
  }

  static isVPNEnabled(): boolean {
    return this.getProperty('vpn.enabled', 'false').toLowerCase() === 'true';
  }

  static isEmailEnabled(): boolean {
    return this.getProperty('email.enabled', 'false').toLowerCase() === 'true';
  }

  static isVolteEnabled(): boolean {
    return this.getProperty('volte.enabled', 'false').toLowerCase() === 'true';
  }

  static getDialingNumber(): string {
    const fromEnv =
      process.env.aPartyNumber ||
      process.env.APARTY_NUMBER ||
      process.env.A_PARTY_NUMBER;
    if (fromEnv?.trim()) return fromEnv.trim();
    return this.getProperty('dialing.number', '');
  }

  static getExcelFilePath(): string {
    const fromEnv = process.env.EXCEL_FILE;
    if (fromEnv?.trim()) return path.resolve(fromEnv.trim());
    const configured = this.getProperty('excelFilePath', 'src/test/resources/contacts.xlsx');
    return path.isAbsolute(configured)
      ? configured
      : path.join(PROJECT_ROOT, configured);
  }

  static getMaxCallAttempts(): number {
    return parseInt(this.getProperty('max.call.attempts', '3'), 10) || 3;
  }

  static getCPartyNumber(): string {
    return this.getProperty('cparty.number', '');
  }

  static getSMSMessageTemplate(): string {
    return this.getProperty(
      'smsMessageTemplate',
      'Hello {name}, this is an automated test message from Telecom Automation Framework.'
    );
  }
}
