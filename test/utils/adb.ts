import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function adbShell(deviceId: string, command: string): Promise<string> {
  const { stdout } = await execAsync(`adb -s "${deviceId}" shell ${command}`);
  return stdout.trim();
}

export async function startCall(deviceId: string, number: string): Promise<void> {
  await execAsync(
    `adb -s "${deviceId}" shell am start -a android.intent.action.CALL -d tel:${number}`
  );
}

export async function endCallKey(deviceId: string): Promise<void> {
  await execAsync(`adb -s "${deviceId}" shell input keyevent KEYCODE_ENDCALL`);
}

export async function listDevices(): Promise<string[]> {
  const { stdout } = await execAsync('adb devices');
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l.endsWith('device'))
    .map((l) => l.split('\t')[0]);
}

export async function downloadDataCurl(
  deviceId: string,
  url = 'http://speedtest.tele2.net/10MB.zip'
): Promise<void> {
  await adbShell(deviceId, `curl -s -o /dev/null "${url}"`);
}
