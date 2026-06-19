import { exec } from 'child_process';
import { promisify } from 'util';
import {
  adbShell as shell,
  listDevices,
  startCall,
  endCallKey,
  downloadDataCurl
} from './adb';

const execAsync = promisify(exec);

/**  ADBHelper — static ADB utilities */
export class ADBHelper {
  static async executeCommand(command: string): Promise<string> {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  }

  static async getConnectedDevices(): Promise<string[]> {
    return listDevices();
  }

  static listDevices = listDevices;

  static async isDeviceConnected(deviceId: string): Promise<boolean> {
    const devices = await listDevices();
    return devices.includes(deviceId);
  }

  static adbShell = shell;

  static async getAndroidVersion(deviceId: string): Promise<string> {
    try {
      return await shell(deviceId, 'getprop ro.build.version.release');
    } catch {
      return '13';
    }
  }

  static async getDeviceModel(deviceId: string): Promise<string> {
    try {
      return await shell(deviceId, 'getprop ro.product.model');
    } catch {
      return 'Unknown';
    }
  }

  static async getNetworkType(deviceId: string): Promise<string> {
    try {
      return await shell(deviceId, 'getprop gsm.network.type');
    } catch {
      return 'UNKNOWN';
    }
  }

  static async grantPermissions(deviceId: string): Promise<void> {
    const perms = [
      'android.permission.CALL_PHONE',
      'android.permission.READ_SMS',
      'android.permission.SEND_SMS',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO'
    ];
    
    const packages = [
      'com.google.android.dialer',
      'com.google.android.apps.messaging'
    ];

    const promises: Promise<void>[] = [];
    
    for (const pkg of packages) {
      for (const p of perms) {
        promises.push(
          shell(deviceId, `pm grant ${pkg} ${p}`).catch(() => {}) as Promise<void>
        );
      }
    }
    
    await Promise.all(promises);
  }

  static async restartADBServer(): Promise<void> {
    await execAsync('adb kill-server').catch(() => {});
    await execAsync('adb start-server').catch(() => {});
  }

  static startCall = startCall;
  static endCallKey = endCallKey;
  static downloadDataCurl = downloadDataCurl;

  static getCommandLineDeviceIds(): {
    aPartyDevice: string;
    aPartyNumber: string;
    bPartyDevice: string;
    bPartyNumber: string;
  } {
    return {
      aPartyDevice: process.env.aPartyDevice || process.env.APARTY_DEVICE || '',
      aPartyNumber: process.env.aPartyNumber || process.env.APARTY_NUMBER || '',
      bPartyDevice: process.env.bPartyDevice || process.env.BPARTY_DEVICE || '',
      bPartyNumber: process.env.bPartyNumber || process.env.BPARTY_NUMBER || ''
    };
  }
}
