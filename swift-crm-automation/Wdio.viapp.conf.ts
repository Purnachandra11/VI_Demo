import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config();

// ─── Dynamic device detection ──────────────────────────────────────────────
function getConnectedDevices(): string[] {
    try {
        const output = execSync('adb devices', { encoding: 'utf8' });
        const lines = output.split('\n').filter(line => line.trim() !== '');
        // Skip the first line "List of devices attached"
        const deviceLines = lines.slice(1);
        const devices = deviceLines
            .filter(line => line.includes('\tdevice'))
            .map(line => line.split('\t')[0].trim())
            .filter(serial => serial !== '');
        
        if (devices.length === 0) {
            console.warn('[Config] No Android devices connected.');
            return [];
        }
        
        console.log(`[Config] Connected devices: ${devices.join(', ')}`);
        return devices;
    } catch (error: any) {
        console.warn(`[Config] Failed to get connected devices: ${error.message}`);
        return [];
    }
}

// ─── Device selection logic ─────────────────────────────────────────────────
function getDeviceSerial(): string {
    const connectedDevices = getConnectedDevices();
    
    // 1. Check if device is specified in environment variable
    if (process.env.DEVICE_SERIAL) {
        const envDevice = process.env.DEVICE_SERIAL.trim();
        if (connectedDevices.includes(envDevice)) {
            console.log(`[Config] Using device from env: ${envDevice}`);
            return envDevice;
        } else if (connectedDevices.length > 0) {
            console.warn(`[Config] Device ${envDevice} from env not found in connected devices.`);
            console.warn(`[Config] Available devices: ${connectedDevices.join(', ')}`);
            console.log(`[Config] Falling back to first connected device: ${connectedDevices[0]}`);
            return connectedDevices[0];
        } else {
            console.warn(`[Config] No devices connected. Using fallback device from env: ${envDevice}`);
            return envDevice; // Use the env device as fallback
        }
    }
    
    // 2. Use first connected device
    if (connectedDevices.length > 0) {
        console.log(`[Config] Using first connected device: ${connectedDevices[0]}`);
        return connectedDevices[0];
    }
    
    // 3. Fallback to default device
    const fallbackDevice = 'LFMVIBEMW8HUR4XK';
    console.warn(`[Config] No devices found. Using fallback device: ${fallbackDevice}`);
    return fallbackDevice;
}

// ─── Get the device serial ──────────────────────────────────────────────────
const DEVICE_SERIAL = getDeviceSerial();
const APPIUM_HOST   = process.env.APPIUM_HOST   || 'localhost';
const APPIUM_PORT   = Number(process.env.APPIUM_PORT || 4723);

// ─── Export config ──────────────────────────────────────────────────────────
export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./src/specs/vi_app_spec.ts'],
  exclude: [],
  maxInstances: 1,

  // ── Appium capabilities for Android ────────────────────────────────────────
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': DEVICE_SERIAL,
      'appium:udid': DEVICE_SERIAL,
      'appium:appPackage': 'com.mventus.selfcare.activity',
      'appium:appActivity': 'com.mventus.selfcare.activity.MainActivity',
      'appium:noReset': true,
      'appium:fullReset': false,
      'appium:autoGrantPermissions': true,
      'appium:newCommandTimeout': 300,
      'appium:disableHiddenApiPolicy': true,
      'appium:ignoreHiddenApiPolicyError': true,
      'appium:skipDeviceInitialization': true,
      'appium:skipAndroidDeviceInitialization': true,
    },
  ],

  // ── Appium server ───────────────────────────────────────────────────────────
  hostname: APPIUM_HOST,
  port: APPIUM_PORT,
  path: '/',

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 300000,   // 5 min — allows time for OTP + login
  },

  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json',
    },
  },

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  before: async () => {
    const screenshotsDir = path.resolve('./screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    console.log(`[Vi App Config] Device  : ${DEVICE_SERIAL}`);
    console.log(`[Vi App Config] Appium  : ${APPIUM_HOST}:${APPIUM_PORT}`);
    console.log(`[Vi App Config] OTP mode: ${process.env.VI_APP_OTP ? 'manual (env var)' : 'auto (SIM on device)'}`);
    
    // Verify device is still connected at test start
    try {
      const devices = getConnectedDevices();
      if (devices.length > 0 && !devices.includes(DEVICE_SERIAL)) {
        console.warn(`[Vi App Config] ⚠️ Device ${DEVICE_SERIAL} might have been disconnected!`);
        console.warn(`[Vi App Config] Currently connected: ${devices.join(', ')}`);
      } else if (devices.length > 0) {
        console.log(`[Vi App Config] ✅ Device ${DEVICE_SERIAL} is connected`);
      }
    } catch (error) {
      console.warn(`[Vi App Config] ⚠️ Could not verify device connection: ${error}`);
    }
  },

  afterTest: async (test: any, _context: any, { error }: any) => {
    if (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.resolve(
        `./screenshots/FAILED_ViApp_${test.title.replace(/\s+/g, '_')}_${timestamp}.png`
      );
      try {
        await browser.saveScreenshot(screenshotPath);
        console.error(`[Hook] Screenshot saved: ${screenshotPath}`);
      } catch (e) {
        console.warn('[Hook] Could not save screenshot:', e);
      }
    }
  },

  logLevel: 'info',
  bail: 0,
  waitforTimeout: 30000,         
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
};

export default config;