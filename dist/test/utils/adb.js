"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adbShell = adbShell;
exports.startCall = startCall;
exports.endCallKey = endCallKey;
exports.listDevices = listDevices;
exports.downloadDataCurl = downloadDataCurl;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function adbShell(deviceId, command) {
    const { stdout } = await execAsync(`adb -s "${deviceId}" shell ${command}`);
    return stdout.trim();
}
async function startCall(deviceId, number) {
    await execAsync(`adb -s "${deviceId}" shell am start -a android.intent.action.CALL -d tel:${number}`);
}
async function endCallKey(deviceId) {
    await execAsync(`adb -s "${deviceId}" shell input keyevent KEYCODE_ENDCALL`);
}
async function listDevices() {
    const { stdout } = await execAsync('adb devices');
    return stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && l.endsWith('device'))
        .map((l) => l.split('\t')[0]);
}
async function downloadDataCurl(deviceId, url = 'http://speedtest.tele2.net/10MB.zip') {
    await adbShell(deviceId, `curl -s -o /dev/null "${url}"`);
}
