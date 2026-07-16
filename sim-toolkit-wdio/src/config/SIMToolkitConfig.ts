// TypeScript port of com.telecom.config.SIMToolkitConfig

export enum SIMType {
    SINGLE_SIM = 'SINGLE_SIM',
    DUAL_SIM_MIXED = 'DUAL_SIM_MIXED',
    DUAL_SIM_VI = 'DUAL_SIM_VI'
}

export const SIM_TYPE_DESCRIPTIONS: Record<SIMType, string> = {
    [SIMType.SINGLE_SIM]: 'Single SIM Device',
    [SIMType.DUAL_SIM_MIXED]: 'Dual SIM (Vi + Other)',
    [SIMType.DUAL_SIM_VI]: 'Dual SIM (Both Vi)'
};

export class SIMToolkitConfig {
    // App Configuration
    static readonly SIM_TOOLKIT_PACKAGE = 'com.android.stk';
    static readonly SIM_TOOLKIT_ACTIVITY = '.StkLauncherActivity';

    // Timeouts (ms, matching Java's seconds * 1000)
    static readonly DEFAULT_TIMEOUT = 30_000;
    static readonly SHORT_TIMEOUT = 5_000;
    static readonly LONG_TIMEOUT = 60_000;

    // Screenshot / report configuration
    static readonly SCREENSHOT_DIR = 'test-output/screenshots/';
    static readonly REPORT_DIR = 'test-output/comprehensive-reports/';

    // Expected texts for validation
    // NOTE: kept as exact brand tokens, not loose substrings - see DeviceUtils.isViBranded()
    static readonly VI_BRANDING_TEXTS: string[] = ['Vi', 'Vodafone Idea', 'Vodafone IN', 'VI'];

    static readonly SIM_TOOLKIT_TEXTS: string[] = ['SIM Toolkit', 'STK', 'SIM Menu', 'USSD'];

    // Menu option labels
    static readonly FLASH_OPTION = 'FLASH!';
    static readonly ROAMING_OPTION = 'Roaming';
    static readonly VODAFONE_IN_OPTION = 'Vodafone IN';
    static readonly INTERNATIONAL_OPTION = 'International';

    // Button texts
    static readonly OK_BUTTON = 'OK';
    static readonly CANCEL_BUTTON = 'Cancel';
    static readonly SELECT_BUTTON = 'Select';

    // Android key codes
    static readonly BACK_BUTTON_KEYCODE = 4;
    static readonly HOME_BUTTON_KEYCODE = 3;
    static readonly MENU_BUTTON_KEYCODE = 82;
}
