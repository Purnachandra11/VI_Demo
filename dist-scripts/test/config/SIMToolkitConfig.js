"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIMToolkitConfig = exports.SIMType = exports.MENU_BUTTON_KEYCODE = exports.HOME_BUTTON_KEYCODE = exports.BACK_BUTTON_KEYCODE = exports.CANCEL_BUTTON = exports.OK_BUTTON = exports.INTERNATIONAL_OPTION = exports.VODAFONE_IN_OPTION = exports.ROAMING_OPTION = exports.FLASH_OPTION = exports.SIM_TOOLKIT_TEXTS = exports.VI_BRANDING_TEXTS = exports.REPORT_DIR = exports.SCREENSHOT_DIR = exports.LONG_TIMEOUT = exports.SHORT_TIMEOUT = exports.DEFAULT_TIMEOUT = exports.SIM_TOOLKIT_ACTIVITY = exports.SIM_TOOLKIT_PACKAGE = void 0;
exports.simTypeDescription = simTypeDescription;
const path_1 = __importDefault(require("path"));
const wdio_shared_1 = require("../../config/wdio.shared");
/**  SIMToolkitConfig */
exports.SIM_TOOLKIT_PACKAGE = 'com.android.stk';
exports.SIM_TOOLKIT_ACTIVITY = '.StkLauncherActivity';
exports.DEFAULT_TIMEOUT = 30;
exports.SHORT_TIMEOUT = 5;
exports.LONG_TIMEOUT = 60;
exports.SCREENSHOT_DIR = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'test-output', 'screenshots');
exports.REPORT_DIR = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'test-output', 'comprehensive-reports');
exports.VI_BRANDING_TEXTS = ['Vi', 'Vodafone Idea', 'Vodafone IN', 'VI'];
exports.SIM_TOOLKIT_TEXTS = ['SIM Toolkit', 'STK', 'SIM Menu', 'USSD'];
exports.FLASH_OPTION = 'FLASH!';
exports.ROAMING_OPTION = 'Roaming';
exports.VODAFONE_IN_OPTION = 'Vodafone IN';
exports.INTERNATIONAL_OPTION = 'International';
exports.OK_BUTTON = 'OK';
exports.CANCEL_BUTTON = 'Cancel';
exports.BACK_BUTTON_KEYCODE = 4;
exports.HOME_BUTTON_KEYCODE = 3;
exports.MENU_BUTTON_KEYCODE = 82;
var SIMType;
(function (SIMType) {
    SIMType["SINGLE_SIM"] = "Single SIM Device";
    SIMType["DUAL_SIM_MIXED"] = "Dual SIM (Vi + Other)";
    SIMType["DUAL_SIM_VI"] = "Dual SIM (Both Vi)";
})(SIMType || (exports.SIMType = SIMType = {}));
function simTypeDescription(type) {
    return type;
}
/** Namespace object for spec imports: SIMToolkitConfig.SIMType */
exports.SIMToolkitConfig = {
    SIM_TOOLKIT_PACKAGE: exports.SIM_TOOLKIT_PACKAGE,
    SIM_TOOLKIT_ACTIVITY: exports.SIM_TOOLKIT_ACTIVITY,
    DEFAULT_TIMEOUT: exports.DEFAULT_TIMEOUT,
    SHORT_TIMEOUT: exports.SHORT_TIMEOUT,
    LONG_TIMEOUT: exports.LONG_TIMEOUT,
    SCREENSHOT_DIR: exports.SCREENSHOT_DIR,
    REPORT_DIR: exports.REPORT_DIR,
    VI_BRANDING_TEXTS: exports.VI_BRANDING_TEXTS,
    SIM_TOOLKIT_TEXTS: exports.SIM_TOOLKIT_TEXTS,
    FLASH_OPTION: exports.FLASH_OPTION,
    ROAMING_OPTION: exports.ROAMING_OPTION,
    VODAFONE_IN_OPTION: exports.VODAFONE_IN_OPTION,
    INTERNATIONAL_OPTION: exports.INTERNATIONAL_OPTION,
    OK_BUTTON: exports.OK_BUTTON,
    CANCEL_BUTTON: exports.CANCEL_BUTTON,
    BACK_BUTTON_KEYCODE: exports.BACK_BUTTON_KEYCODE,
    HOME_BUTTON_KEYCODE: exports.HOME_BUTTON_KEYCODE,
    MENU_BUTTON_KEYCODE: exports.MENU_BUTTON_KEYCODE,
    SIMType
};
exports.default = exports.SIMToolkitConfig;
