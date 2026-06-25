"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADBHelper = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const adb_1 = require("./adb");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**  ADBHelper — static ADB utilities */
class ADBHelper {
    static async executeCommand(command) {
        const { stdout } = await execAsync(command);
        return stdout.trim();
    }
    static async getConnectedDevices() {
        return (0, adb_1.listDevices)();
    }
    static async isDeviceConnected(deviceId) {
        const devices = await (0, adb_1.listDevices)();
        return devices.includes(deviceId);
    }
    static async getAndroidVersion(deviceId) {
        try {
            return await (0, adb_1.adbShell)(deviceId, 'getprop ro.build.version.release');
        }
        catch {
            return '13';
        }
    }
    static async getDeviceModel(deviceId) {
        try {
            return await (0, adb_1.adbShell)(deviceId, 'getprop ro.product.model');
        }
        catch {
            return 'Unknown';
        }
    }
    static async getNetworkType(deviceId) {
        try {
            return await (0, adb_1.adbShell)(deviceId, 'getprop gsm.network.type');
        }
        catch {
            return 'UNKNOWN';
        }
    }
    static async grantPermissions(deviceId) {
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
        const promises = [];
        for (const pkg of packages) {
            for (const p of perms) {
                promises.push((0, adb_1.adbShell)(deviceId, `pm grant ${pkg} ${p}`).catch(() => { }));
            }
        }
        await Promise.all(promises);
    }
    static async restartADBServer() {
        await execAsync('adb kill-server').catch(() => { });
        await execAsync('adb start-server').catch(() => { });
    }
    static getCommandLineDeviceIds() {
        return {
            aPartyDevice: process.env.aPartyDevice || process.env.APARTY_DEVICE || '',
            aPartyNumber: process.env.aPartyNumber || process.env.APARTY_NUMBER || '',
            bPartyDevice: process.env.bPartyDevice || process.env.BPARTY_DEVICE || '',
            bPartyNumber: process.env.bPartyNumber || process.env.BPARTY_NUMBER || ''
        };
    }
}
exports.ADBHelper = ADBHelper;
ADBHelper.listDevices = adb_1.listDevices;
ADBHelper.adbShell = adb_1.adbShell;
ADBHelper.startCall = adb_1.startCall;
ADBHelper.endCallKey = adb_1.endCallKey;
ADBHelper.downloadDataCurl = adb_1.downloadDataCurl;
