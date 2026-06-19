"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigReader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const wdio_shared_1 = require("../../config/wdio.shared");
const CONFIG_PATH = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'src', 'test', 'resources', 'config.properties');
let properties = {};
function loadProperties() {
    if (Object.keys(properties).length)
        return;
    try {
        const raw = fs_1.default.readFileSync(CONFIG_PATH, 'utf8');
        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const eq = trimmed.indexOf('=');
            if (eq > 0) {
                properties[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
            }
        }
    }
    catch (e) {
        console.warn(`[ConfigReader] Could not load ${CONFIG_PATH}: ${e.message}`);
        properties = {};
    }
}
class ConfigReader {
    static getProperty(key, defaultValue = '') {
        var _a, _b;
        loadProperties();
        return (_b = (_a = process.env[key]) !== null && _a !== void 0 ? _a : properties[key]) !== null && _b !== void 0 ? _b : defaultValue;
    }
    static getAppPackage() {
        return this.getProperty('appPackage', 'com.google.android.dialer');
    }
    static getAppActivity() {
        return this.getProperty('appActivity', 'com.google.android.dialer.extensions.GoogleDialtactsActivity');
    }
    static getMessageAppPackage() {
        return this.getProperty('messageAppPackage', 'com.google.android.apps.messaging');
    }
    static getMessageAppActivity() {
        return this.getProperty('messageAppActivity', 'com.google.android.apps.messaging.ui.ConversationListActivity');
    }
    static getCallDuration() {
        return parseInt(this.getProperty('call.duration', '7'), 10) || 7;
    }
    static getSMSWaitTime() {
        return parseInt(this.getProperty('sms.wait.time', '5'), 10) || 5;
    }
    static isVPNEnabled() {
        return this.getProperty('vpn.enabled', 'false').toLowerCase() === 'true';
    }
    static isEmailEnabled() {
        return this.getProperty('email.enabled', 'false').toLowerCase() === 'true';
    }
    static isVolteEnabled() {
        return this.getProperty('volte.enabled', 'false').toLowerCase() === 'true';
    }
    static getDialingNumber() {
        const fromEnv = process.env.aPartyNumber ||
            process.env.APARTY_NUMBER ||
            process.env.A_PARTY_NUMBER;
        if (fromEnv === null || fromEnv === void 0 ? void 0 : fromEnv.trim())
            return fromEnv.trim();
        return this.getProperty('dialing.number', '');
    }
    static getExcelFilePath() {
        const fromEnv = process.env.EXCEL_FILE;
        if (fromEnv === null || fromEnv === void 0 ? void 0 : fromEnv.trim())
            return path_1.default.resolve(fromEnv.trim());
        const configured = this.getProperty('excelFilePath', 'src/test/resources/contacts.xlsx');
        return path_1.default.isAbsolute(configured)
            ? configured
            : path_1.default.join(wdio_shared_1.PROJECT_ROOT, configured);
    }
    static getMaxCallAttempts() {
        return parseInt(this.getProperty('max.call.attempts', '3'), 10) || 3;
    }
    static getCPartyNumber() {
        return this.getProperty('cparty.number', '');
    }
    static getSMSMessageTemplate() {
        return this.getProperty('smsMessageTemplate', 'Hello {name}, this is an automated test message from Telecom Automation Framework.');
    }
}
exports.ConfigReader = ConfigReader;
