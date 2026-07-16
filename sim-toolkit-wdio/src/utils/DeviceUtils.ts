// TypeScript port of com.telecom.utils.DeviceUtils
import { SIMToolkitConfig, SIMType } from '../config/SIMToolkitConfig';
import { ADBLauncher } from './ADBLauncher';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class DeviceUtils {
    /**
     * Launch SIM Toolkit with multiple fallback methods.
     */
    async launchSIMToolkit(deviceId?: string): Promise<boolean> {
        console.log('\n🚀 Launching SIM Toolkit...');

        console.log('  Method 1: ADB monkey command (with device ID)');
        if (deviceId && (await ADBLauncher.launchSIMToolkit(deviceId))) {
            await sleep(5000);
            if (await this.isSIMToolkitVisible()) {
                console.log('  ✅ SIM Toolkit launched successfully');
                return true;
            }
        }

        console.log('  Method 2: ADB monkey command (without device ID)');
        if (await ADBLauncher.launchSIMToolkit()) {
            await sleep(5000);
            if (await this.isSIMToolkitVisible()) {
                console.log('  ✅ SIM Toolkit launched successfully');
                return true;
            }
        }

        console.log('  Method 3: ADB activity launch');
        if (await ADBLauncher.launchSIMToolkitViaActivity(deviceId)) {
            await sleep(5000);
            if (await this.isSIMToolkitVisible()) {
                console.log('  ✅ SIM Toolkit launched successfully');
                return true;
            }
        }

        console.log('  Method 4: Appium activity launch');
        try {
            await this.launchApp(SIMToolkitConfig.SIM_TOOLKIT_PACKAGE, SIMToolkitConfig.SIM_TOOLKIT_ACTIVITY);
            await sleep(5000);
            if (await this.isSIMToolkitVisible()) {
                console.log('  ✅ SIM Toolkit launched successfully');
                return true;
            }
        } catch (e) {
            console.error(`  ❌ Appium launch failed: ${(e as Error).message}`);
        }

        console.error('  ❌ All launch methods failed!');
        return false;
    }

    /**
     * Check if SIM Toolkit is visible on screen.
     */
    private async isSIMToolkitVisible(): Promise<boolean> {
        try {
            const indicators = [
                'SIM Toolkit', 'STK', 'SIM Menu', 'SIM',
                'Vi', 'Vodafone', 'Menu', 'USSD', 'Vodafone Services'
            ];

            for (const indicator of indicators) {
                if (await this.isElementPresent(indicator)) {
                    console.log(`  Found indicator: ${indicator}`);
                    return true;
                }
            }

            const pageSource = (await driver.getPageSource()).toLowerCase();
            if (
                pageSource.includes('sim') ||
                pageSource.includes('stk') ||
                pageSource.includes('vodafone') ||
                pageSource.includes('vi')
            ) {
                console.log('  SIM Toolkit content found in page source');
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Detect the SIM scenario (single / dual mixed / dual Vi).
     *
     * FIX applied vs. the original Java: the old logic used
     * text.toLowerCase().contains('vi'), which false-matches common
     * substrings like "Device", "Activity", "Previous", "Service" etc,
     * and counted any clickable-looking element containing generic
     * "SIM"/"Menu"/"Vi" text as a SIM option. This version:
     *   1) only considers elements that are actually clickable,
     *   2) matches Vi branding against whole tokens from
     *      SIMToolkitConfig.VI_BRANDING_TEXTS instead of raw substrings,
     *   3) waits for elements to actually appear instead of a blind sleep.
     */
    async detectSIMType(): Promise<SIMType> {
        try {
            await this.waitForSimOptionsToAppear(10000);

            const simOptions = await $$(
                "//*[@clickable='true' and (contains(@text,'SIM') or contains(@text,'Vodafone') or contains(@text,'Vi'))]"
            );

            let viCount = 0;
            for (const element of simOptions) {
                const text = await this.getSafeText(element);
                if (text && this.isViBranded(text)) {
                    viCount++;
                }
            }

            console.log('  Detection Analysis:');
            console.log(`    Total selectable SIM options found: ${simOptions.length}`);
            console.log(`    Vi-branded options: ${viCount}`);

            if (simOptions.length <= 1) {
                return SIMType.SINGLE_SIM;
            } else if (viCount >= 2) {
                return SIMType.DUAL_SIM_VI;
            } else if (viCount >= 1) {
                return SIMType.DUAL_SIM_MIXED;
            } else {
                return SIMType.SINGLE_SIM;
            }
        } catch (e) {
            console.error(`Error detecting SIM type: ${(e as Error).message}`);
            return SIMType.SINGLE_SIM;
        }
    }

    /**
     * Word-boundary-safe Vi brand check, replacing the old raw
     * `.contains('vi')` substring match that false-positived on
     * unrelated text like "Device" or "Activity".
     */
    private isViBranded(text: string): boolean {
        const normalized = ` ${text.trim().toLowerCase()} `;
        return SIMToolkitConfig.VI_BRANDING_TEXTS.some((brand) =>
            normalized.includes(` ${brand.toLowerCase()} `)
        );
    }

    private async waitForSimOptionsToAppear(timeoutMs: number): Promise<void> {
        try {
            await browser.waitUntil(
                async () => {
                    const els = await $$(
                        "//*[contains(@text,'SIM') or contains(@text,'Vodafone') or contains(@text,'Vi')]"
                    );
                    return els.length > 0;
                },
                { timeout: timeoutMs, timeoutMsg: 'SIM selection elements never appeared' }
            );
        } catch {
            // Fall through - detectSIMType() will just see an empty list
            // and classify as SINGLE_SIM, matching prior fallback behavior.
        }
    }

    async findElementWithText(text: string, partial: boolean): Promise<WebdriverIO.Element | null> {
        try {
            const xpath = partial ? `//*[contains(@text, '${text}')]` : `//*[@text='${text}']`;
            const el = await $(xpath);
            await el.waitForExist({ timeout: 10000 });
            return el;
        } catch {
            return null;
        }
    }

    async findElementsWithText(text: string, partial: boolean): Promise<WebdriverIO.ElementArray | null> {
        try {
            const xpath = partial ? `//*[contains(@text, '${text}')]` : `//*[@text='${text}']`;
            return await $$(xpath);
        } catch {
            return null;
        }
    }

    async navigateBack(): Promise<void> {
        try {
            await driver.back();
            await sleep(1500);
            console.log('  ✓ Navigated back');
        } catch (e) {
            console.error(`Error navigating back: ${(e as Error).message}`);
        }
    }

    async launchApp(appPackage: string, appActivity: string): Promise<void> {
        try {
            await driver.execute('mobile: startActivity', {
                component: `${appPackage}/${appActivity}`
            });
            await sleep(3000);
            console.log(`  ✓ App launched: ${appPackage}`);
        } catch (e) {
            console.error(`Error launching app: ${(e as Error).message}`);
            throw new Error('Failed to launch app');
        }
    }

    async isElementPresent(text: string): Promise<boolean> {
        try {
            const element = await this.findElementWithText(text, true);
            return element !== null && (await element.isDisplayed());
        } catch {
            return false;
        }
    }

    /**
     * Close current application by sending BACK key events via ADB.
     */
    async closeAppUsingBackKey(deviceId?: string): Promise<void> {
        try {
            console.log('\n🛑 Closing app using BACK key events...');

            const baseArgs = deviceId ? ['-s', deviceId] : [];

            // Press BACK multiple times to ensure app exits
            for (let i = 0; i < 4; i++) {
                await execFileAsync('adb', [...baseArgs, 'shell', 'input', 'keyevent', 'KEYCODE_BACK']);
                await sleep(1000);
            }

            console.log('  ✅ App closed using BACK key');
        } catch (e) {
            console.error(`Error closing app using BACK key: ${(e as Error).message}`);
        }
    }

    private async getSafeText(element: WebdriverIO.Element): Promise<string | null> {
        try {
            return await element.getText();
        } catch {
            return null;
        }
    }
}
