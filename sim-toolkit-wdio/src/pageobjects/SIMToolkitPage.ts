// TypeScript port of com.telecom.pages.SIMToolkitPage
import { SIMToolkitConfig, SIMType, SIM_TYPE_DESCRIPTIONS } from '../config/SIMToolkitConfig';
import { DeviceUtils } from '../utils/DeviceUtils';
import { ScreenshotUtils } from '../utils/ScreenshotUtils';
import * as ProgressReporter from '../utils/ProgressReporter';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Selectors, mirroring the original @AndroidFindBy annotations.
// NOTE: the simMenuOptions / viMenuElements xpaths are tightened to
// require @clickable='true' to avoid false-matching generic system
// text (e.g. "Device", "Activity") the way the original substring
// match on "vi" did - see the SIM-detection bug fix discussed earlier.
const SELECTORS = {
    simMenuOptions:
        "//*[@clickable='true' and (contains(@text, 'SIM') or contains(@text, 'Menu') or contains(@text, 'Vi'))]",
    viMenuElements: "//*[@clickable='true' and (contains(@text, 'Vi') or contains(@text, 'Vodafone'))]",
    viMenuHeader: "//*[contains(@text, 'Vi Menu') or contains(@text, 'Vodafone Menu')]",
    flashOption: "//*[@text='FLASH!' or contains(@text,'FLASH')]",
    roamingOption: "//*[@text='Roaming' or contains(@text, 'Roaming')]",
    vodafoneInOption: "//*[@text='Vodafone IN' or contains(@text, 'Vodafone IN')]",
    internationalOption: "//*[@text='International' or contains(@text, 'International')]",
    okButton: 'android:id/button1',
    cancelButton: 'android:id/button2'
};

export class SIMToolkitPage {
    private deviceId?: string;
    private screenshotUtils: ScreenshotUtils;
    private deviceUtils: DeviceUtils;

    constructor(screenshotUtils: ScreenshotUtils, deviceId?: string) {
        this.deviceId = deviceId;
        this.screenshotUtils = screenshotUtils;
        this.deviceUtils = new DeviceUtils();
    }

    async detectAndHandleSIMScenario(): Promise<SIMType> {
        console.log('┌─ Step 2: Detect & Handle SIM Scenario');
        await this.reportProgress('STARTED', 'Starting SIM Toolkit detection', 10);

        const simType = await this.deviceUtils.detectSIMType();
        console.log(`  Detected: ${SIM_TYPE_DESCRIPTIONS[simType]}`);
        await this.reportProgress('SIM_DETECTED', `SIM Type: ${SIM_TYPE_DESCRIPTIONS[simType]}`, 20);

        switch (simType) {
            case SIMType.SINGLE_SIM:
                await this.reportProgress('HANDLING_SINGLE_SIM', 'Handling single SIM scenario', 30);
                await this.handleSingleSIM();
                break;
            case SIMType.DUAL_SIM_MIXED:
                await this.reportProgress('HANDLING_DUAL_SIM_MIXED', 'Handling dual SIM mixed scenario', 30);
                await this.handleDualSIMMixed();
                break;
            case SIMType.DUAL_SIM_VI:
                await this.reportProgress('HANDLING_DUAL_SIM_VI', 'Handling dual SIM Vi scenario', 30);
                await this.handleDualSIMVi();
                break;
        }

        console.log('└─ ✅ SIM scenario handled\n');
        await this.reportProgress('COMPLETED', 'SIM scenario handled successfully', 40);
        return simType;
    }

    private async handleSingleSIM(): Promise<void> {
        console.log('  → Scenario A: Single SIM Device');
        await this.reportProgress('SINGLE_SIM', 'Processing single SIM device', 50);
        await this.captureScreenshot('Vi Menu Home');
        await this.reportProgress('SCREENSHOT_CAPTURED', 'Screenshot captured for single SIM', 60);
    }

    private async handleDualSIMMixed(): Promise<void> {
        console.log('  → Scenario B: Dual SIM (Vi + Other)');
        await this.reportProgress('DUAL_SIM_MIXED', 'Processing dual SIM mixed', 50);

        await this.captureScreenshot('SIM Selection Screen');
        await this.reportProgress('SCREENSHOT_1', 'SIM selection screen captured', 60);

        await this.selectViMenu();
        await this.reportProgress('VI_MENU_SELECTED', 'Vi menu selected', 70);

        await this.captureScreenshot('Vi Menu Home');
        await this.reportProgress('SCREENSHOT_2', 'Vi Menu home captured', 80);
    }

    private async handleDualSIMVi(): Promise<void> {
        console.log('  → Scenario C: Dual SIM (Both Vi)');
        await this.reportProgress('DUAL_SIM_VI', 'Processing dual SIM Vi', 50);

        await this.captureScreenshot('SIM Selection Screen');
        await this.reportProgress('SCREENSHOT_1', 'SIM selection screen captured', 60);

        // FIX vs. original Java: previously clicked simMenuOptions[0]
        // unconditionally, which could hit a non-SIM clickable element
        // matching the broad "SIM"/"Menu"/"Vi" selector. Now picks the
        // first element that actually contains Vi-branded text, same
        // as selectViMenu() below.
        const options = await $$(SELECTORS.simMenuOptions);
        if (options.length > 0) {
            const target = await this.findFirstViBrandedElement(options);
            if (target) {
                await this.clickWithoutScreenshot(target);
                await this.reportProgress('MENU_CLICKED', 'Clicked on SIM menu option', 70);
            }
        }

        await this.captureScreenshot('Vi Menu Home');
        await this.reportProgress('SCREENSHOT_2', 'Vi Menu home captured', 80);
    }

    private async selectViMenu(): Promise<void> {
        const options = await $$(SELECTORS.simMenuOptions);
        for (const menuOption of options) {
            const text = await this.getText(menuOption);
            if (text && (text.includes('Vi') || text.includes('Vodafone'))) {
                await this.clickWithoutScreenshot(menuOption);
                break;
            }
        }
    }

    private async findFirstViBrandedElement(
        elements: WebdriverIO.ElementArray
    ): Promise<WebdriverIO.Element | null> {
        for (const el of elements) {
            const text = await this.getText(el);
            if (text && (text.includes('Vi') || text.includes('Vodafone'))) {
                return el;
            }
        }
        return null;
    }

    async navigateToFlashOption(): Promise<void> {
        console.log('┌─ Step 3: Flash Option');
        await this.reportProgress('FLASH_OPTION', 'Navigating to Flash option', 45);

        try {
            const flashOption = await $(SELECTORS.flashOption);
            if (await this.isDisplayed(flashOption)) {
                await this.reportProgress('FLASH_FOUND', 'Flash option found', 50);
                await this.click(flashOption, 'Flash Option');
                await this.deviceUtils.navigateBack();
                console.log('└─ ✅ Flash option captured\n');
                await this.reportProgress('FLASH_COMPLETED', 'Flash option tested successfully', 55);
            } else {
                await this.captureScreenshot('Flash Option Not Found');
                console.log('└─ ⚠ Flash option not found\n');
                await this.reportProgress('FLASH_NOT_FOUND', 'Flash option not found', 55);
            }
        } catch (e) {
            console.error(`└─ ❌ Error: ${(e as Error).message}`);
            await this.reportProgress('FLASH_ERROR', `Error: ${(e as Error).message}`, 0);
        }
    }

    async navigateToRoamingOption(): Promise<void> {
        console.log('┌─ Step 4: Roaming Option');
        await this.reportProgress('ROAMING_OPTION', 'Navigating to Roaming option', 60);

        try {
            const roamingOption = await $(SELECTORS.roamingOption);
            if (await this.isDisplayed(roamingOption)) {
                await this.reportProgress('ROAMING_FOUND', 'Roaming option found', 65);
                await this.click(roamingOption, 'Roaming Menu');
                console.log('└─ ✅ Roaming menu captured\n');
                await this.reportProgress('ROAMING_ENTERED', 'Entered Roaming menu', 70);
            } else {
                console.log('└─ ⚠ Roaming option not found\n');
                await this.reportProgress('ROAMING_NOT_FOUND', 'Roaming option not found', 70);
            }
        } catch (e) {
            console.error(`└─ ❌ Error: ${(e as Error).message}`);
            await this.reportProgress('ROAMING_ERROR', `Error: ${(e as Error).message}`, 0);
        }
    }

    async validateRoamingSubMenus(): Promise<void> {
        console.log('┌─ Step 5-6: Roaming Sub-Menus');
        await this.reportProgress('ROAMING_SUBMENUS', 'Validating roaming sub-menus', 75);

        await this.validateVodafoneIN();

        // Re-open Roaming menu before validating International option
        await this.reOpenRoamingMenu();

        await this.validateInternational();

        console.log('└─ ✅ Sub-menus validated\n');
        await this.reportProgress('SUB_MENUS_COMPLETED', 'Roaming sub-menus validated', 85);
    }

    private async reOpenRoamingMenu(): Promise<void> {
        console.log('  → Re-opening Roaming Menu');
        await this.reportProgress('REOPEN_ROAMING', 'Re-opening Roaming menu for International option', 72);

        try {
            const roamingOption = await $(SELECTORS.roamingOption);
            if (await this.isDisplayed(roamingOption)) {
                await this.reportProgress('ROAMING_FOUND', 'Roaming option found', 45);
                await this.click(roamingOption, 'Roaming Menu');
                console.log('└─ ✅ Roaming menu captured\n');
                await this.reportProgress('ROAMING_ENTERED', 'Entered Roaming menu', 50);
            } else {
                console.log('└─ ⚠ Roaming option not found\n');
                await this.reportProgress('ROAMING_NOT_FOUND', 'Roaming option not found', 50);
            }
        } catch (e) {
            console.error(`└─ ❌ Error: ${(e as Error).message}`);
            await this.reportProgress('ROAMING_ERROR', `Error: ${(e as Error).message}`, 0);
        }
    }

    private async validateVodafoneIN(): Promise<void> {
        console.log('  → Vodafone IN Option');
        await this.reportProgress('VODAFONE_IN', 'Validating Vodafone IN option', 76);

        try {
            const vodafoneInOption = await $(SELECTORS.vodafoneInOption);
            if (await this.isDisplayed(vodafoneInOption)) {
                await this.reportProgress('VODAFONE_IN_FOUND', 'Vodafone IN option found', 78);
                await this.click(vodafoneInOption, 'Vodafone IN');
                await this.handlePopup(true);
                await this.reportProgress('VODAFONE_IN_TESTED', 'Vodafone IN option tested', 80);
            } else {
                console.log('    ⚠ Vodafone IN not found');
                await this.reportProgress('VODAFONE_IN_NOT_FOUND', 'Vodafone IN option not found', 80);
            }
        } catch (e) {
            console.error(`    ✗ Error: ${(e as Error).message}`);
            await this.reportProgress('VODAFONE_IN_ERROR', `Error: ${(e as Error).message}`, 0);
        }
    }

    private async validateInternational(): Promise<void> {
        console.log('  → International Option');
        await this.reportProgress('INTERNATIONAL', 'Validating International option', 82);

        try {
            const internationalOption = await $(SELECTORS.internationalOption);
            if (await this.isDisplayed(internationalOption)) {
                await this.reportProgress('INTERNATIONAL_FOUND', 'International option found', 84);
                await this.click(internationalOption, 'International');
                await this.handlePopup(true);
                await this.reportProgress('INTERNATIONAL_TESTED', 'International option tested', 86);
            } else {
                console.log('    ⚠ International not found');
                await this.reportProgress('INTERNATIONAL_NOT_FOUND', 'International option not found', 86);
            }
        } catch (e) {
            console.error(`    ✗ Error: ${(e as Error).message}`);
            await this.reportProgress('INTERNATIONAL_ERROR', `Error: ${(e as Error).message}`, 0);
        }
    }

    private async handlePopup(clickOK: boolean): Promise<void> {
        try {
            await sleep(2000);

            const okButton = await $(SELECTORS.okButton);
            const cancelButton = await $(SELECTORS.cancelButton);

            if (clickOK && (await this.isDisplayed(okButton))) {
                await this.clickWithoutScreenshot(okButton);
                await sleep(1500);
                console.log('    ✓ Clicked OK');
            } else if (!clickOK && (await this.isDisplayed(cancelButton))) {
                await this.clickWithoutScreenshot(cancelButton);
                console.log('    ✓ Clicked Cancel');
            }
        } catch (e) {
            console.error(`    ✗ Popup handling error: ${(e as Error).message}`);
        }
    }

    async verifyViBranding(): Promise<boolean> {
        try {
            await this.reportProgress('BRANDING_CHECK', 'Verifying Vi branding', 90);

            const viElements = await $$(SELECTORS.viMenuElements);
            for (const viElement of viElements) {
                if (await this.isDisplayed(viElement)) {
                    const text = await this.getText(viElement);
                    if (text) {
                        for (const branding of SIMToolkitConfig.VI_BRANDING_TEXTS) {
                            if (text.includes(branding)) {
                                console.log(`✅ Vi branding verified: ${text}`);
                                await this.reportProgress('BRANDING_VERIFIED', `Vi branding verified: ${text}`, 95);
                                return true;
                            }
                        }
                    }
                }
            }

            await this.reportProgress('BRANDING_NOT_FOUND', 'Vi branding not found', 95);
            return false;
        } catch (e) {
            await this.reportProgress('BRANDING_ERROR', `Error verifying branding: ${(e as Error).message}`, 0);
            return false;
        }
    }

    async completeSIMToolkitTest(): Promise<void> {
        console.log('┌─ SIM Toolkit Test Complete');
        await this.reportProgress('TEST_COMPLETE', 'SIM Toolkit test completed successfully', 100);
        console.log('└─ ✅ All SIM Toolkit steps completed\n');
    }

    // ── Helper methods ──────────────────────────────────────────────

    protected async click(element: WebdriverIO.Element, screenshotName?: string): Promise<void> {
        try {
            await element.waitForClickable({ timeout: 10000 });
            await element.click();
            console.log('  ✓ Clicked element');

            await sleep(1500);

            if (screenshotName) {
                await this.screenshotUtils.captureScreenshot(screenshotName);
            }
        } catch (e) {
            console.error(`  ✗ Error clicking element: ${(e as Error).message}`);
            throw new Error('Failed to click element');
        }
    }

    protected async clickWithoutScreenshot(element: WebdriverIO.Element): Promise<void> {
        try {
            await element.waitForClickable({ timeout: 10000 });
            await element.click();
            await sleep(1000);
        } catch (e) {
            console.error(`Error clicking element: ${(e as Error).message}`);
        }
    }

    protected async isDisplayed(element: WebdriverIO.Element): Promise<boolean> {
        try {
            return element !== null && (await element.isDisplayed());
        } catch {
            return false;
        }
    }

    protected async getText(element: WebdriverIO.Element): Promise<string | null> {
        try {
            await element.waitForDisplayed({ timeout: 10000 });
            return await element.getText();
        } catch {
            return null;
        }
    }

    async captureScreenshot(stepName: string): Promise<void> {
        if (stepName && stepName.trim().length > 0) {
            await this.screenshotUtils.captureScreenshot(stepName);
        }
    }

    /**
     * Helper method to report SIM Toolkit progress.
     */
    private async reportProgress(action: string, status: string, percentage: number): Promise<void> {
        if (this.deviceId) {
            try {
                await ProgressReporter.reportCallingProgress(
                    this.deviceId,
                    'SIM_Toolkit', // phoneNumber parameter - used as identifier
                    action,
                    status,
                    0, // duration (not applicable for SIM Toolkit)
                    percentage
                );
            } catch (e) {
                // Silently fail - don't disrupt test execution
                console.error(`SIM Toolkit progress report failed: ${(e as Error).message}`);
            }
        }
    }
}
