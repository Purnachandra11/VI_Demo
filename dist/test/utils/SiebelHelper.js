"use strict";
// test/utils/SiebelHelper.ts
// FIXED VERSION
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiebelHelper = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const globals_1 = require("@wdio/globals");
class SiebelHelper {
    static async screenshot(label) {
        const dir = path.resolve(process.cwd(), 'screenshots', 'invoice');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${label}_${timestamp}.png`;
        const fullPath = path.join(dir, filename);
        await globals_1.browser.saveScreenshot(fullPath);
        console.log(`   📸 Screenshot: ${path.basename(fullPath)}`);
        return fullPath;
    }
    static async waitForBodyText(text, timeoutMs = 20000) {
        await globals_1.browser.waitUntil(async () => {
            const body = await (0, globals_1.$)('body');
            const bodyText = await body.getText();
            return bodyText.toLowerCase().includes(text.toLowerCase());
        }, {
            timeout: timeoutMs,
            interval: 500,
            timeoutMsg: `Text "${text}" not found in body within ${timeoutMs / 1000}s`,
        });
    }
    static async waitForElement(xpath, timeoutMs = 15000) {
        const el = await (0, globals_1.$)(xpath);
        await el.waitForDisplayed({ timeout: timeoutMs });
        return el;
    }
    static async safeClick(xpath, timeoutMs = 10000) {
        const el = await (0, globals_1.$)(xpath);
        await el.waitForClickable({ timeout: timeoutMs });
        await el.scrollIntoView();
        await el.click();
    }
    static async safeSetValue(xpath, value) {
        const el = await (0, globals_1.$)(xpath);
        await el.waitForDisplayed({ timeout: 10000 });
        await el.clearValue();
        await el.setValue(value);
    }
    static async getText(xpath) {
        try {
            const el = await (0, globals_1.$)(xpath);
            await el.waitForDisplayed({ timeout: 5000 });
            return await el.getText();
        }
        catch {
            return '';
        }
    }
    static async isElementVisible(xpath) {
        try {
            const el = await (0, globals_1.$)(xpath);
            return await el.isDisplayed();
        }
        catch {
            return false;
        }
    }
    static async waitForPDFLoad(timeoutMs = 30000) {
        try {
            await globals_1.browser.waitUntil(async () => {
                const url = await globals_1.browser.getUrl();
                if (url.toLowerCase().includes('.pdf'))
                    return true;
                const embed = await (0, globals_1.$)('embed[type="application/pdf"]');
                if (await embed.isExisting())
                    return true;
                const iframe = await (0, globals_1.$)('iframe[src*=".pdf"]');
                if (await iframe.isExisting())
                    return true;
                return false;
            }, { timeout: timeoutMs, interval: 1000 });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.SiebelHelper = SiebelHelper;
