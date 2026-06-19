import path from 'path';
import { PROJECT_ROOT } from '../../config/wdio.shared';

/**  SIMToolkitConfig */

export const SIM_TOOLKIT_PACKAGE = 'com.android.stk';
export const SIM_TOOLKIT_ACTIVITY = '.StkLauncherActivity';

export const DEFAULT_TIMEOUT = 30;
export const SHORT_TIMEOUT = 5;
export const LONG_TIMEOUT = 60;

export const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'test-output', 'screenshots');
export const REPORT_DIR = path.join(PROJECT_ROOT, 'test-output', 'comprehensive-reports');

export const VI_BRANDING_TEXTS = ['Vi', 'Vodafone Idea', 'Vodafone IN', 'VI'];
export const SIM_TOOLKIT_TEXTS = ['SIM Toolkit', 'STK', 'SIM Menu', 'USSD'];

export const FLASH_OPTION = 'FLASH!';
export const ROAMING_OPTION = 'Roaming';
export const VODAFONE_IN_OPTION = 'Vodafone IN';
export const INTERNATIONAL_OPTION = 'International';

export const OK_BUTTON = 'OK';
export const CANCEL_BUTTON = 'Cancel';

export const BACK_BUTTON_KEYCODE = 4;
export const HOME_BUTTON_KEYCODE = 3;
export const MENU_BUTTON_KEYCODE = 82;

export enum SIMType {
  SINGLE_SIM = 'Single SIM Device',
  DUAL_SIM_MIXED = 'Dual SIM (Vi + Other)',
  DUAL_SIM_VI = 'Dual SIM (Both Vi)'
}

export function simTypeDescription(type: SIMType): string {
  return type;
}

/** Namespace object for spec imports: SIMToolkitConfig.SIMType */
export const SIMToolkitConfig = {
  SIM_TOOLKIT_PACKAGE,
  SIM_TOOLKIT_ACTIVITY,
  DEFAULT_TIMEOUT,
  SHORT_TIMEOUT,
  LONG_TIMEOUT,
  SCREENSHOT_DIR,
  REPORT_DIR,
  VI_BRANDING_TEXTS,
  SIM_TOOLKIT_TEXTS,
  FLASH_OPTION,
  ROAMING_OPTION,
  VODAFONE_IN_OPTION,
  INTERNATIONAL_OPTION,
  OK_BUTTON,
  CANCEL_BUTTON,
  BACK_BUTTON_KEYCODE,
  HOME_BUTTON_KEYCODE,
  MENU_BUTTON_KEYCODE,
  SIMType
};

export default SIMToolkitConfig;
