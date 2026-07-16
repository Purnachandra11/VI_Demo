// TypeScript port of com.telecom.utils.ADBLauncher
// (Reconstructed from its usage in DeviceUtils.java - adjust package/activity
// names or monkey args to match your original implementation if it differs.)
import { execFile } from 'child_process';
import { promisify } from 'util';
import { SIMToolkitConfig } from '../config/SIMToolkitConfig';

const execFileAsync = promisify(execFile);

async function runAdb(args: string[]): Promise<boolean> {
    try {
        const { stdout, stderr } = await execFileAsync('adb', args);
        if (stderr && stderr.toLowerCase().includes('error')) {
            console.error(`  ADB error: ${stderr.trim()}`);
            return false;
        }
        if (stdout) {
            console.log(`  ADB: ${stdout.trim()}`);
        }
        return true;
    } catch (e) {
        console.error(`  ADB command failed: ${(e as Error).message}`);
        return false;
    }
}

export class ADBLauncher {
    /**
     * Launch SIM Toolkit via `adb -s <deviceId> shell monkey`.
     */
    static async launchSIMToolkit(deviceId?: string): Promise<boolean> {
        const args = deviceId ? ['-s', deviceId] : [];
        args.push(
            'shell',
            'monkey',
            '-p',
            SIMToolkitConfig.SIM_TOOLKIT_PACKAGE,
            '-c',
            'android.intent.category.LAUNCHER',
            '1'
        );
        return runAdb(args);
    }

    /**
     * Launch SIM Toolkit via explicit activity start: `adb shell am start -n pkg/activity`.
     */
    static async launchSIMToolkitViaActivity(deviceId?: string): Promise<boolean> {
        const args = deviceId ? ['-s', deviceId] : [];
        args.push(
            'shell',
            'am',
            'start',
            '-n',
            `${SIMToolkitConfig.SIM_TOOLKIT_PACKAGE}/${SIMToolkitConfig.SIM_TOOLKIT_ACTIVITY}`
        );
        return runAdb(args);
    }
}
