"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrPerformPreTestUSSD = getOrPerformPreTestUSSD;
exports.performPostTestUSSD = performPostTestUSSD;
exports.checkBalanceAndValidity = checkBalanceAndValidity;
exports.toLegacyResponse = toLegacyResponse;
const child_process_1 = require("child_process");
const util_1 = require("util");
const exec = (0, util_1.promisify)(child_process_1.exec);
//  Cache 
const lastPostTestUSSDCache = new Map();
//  XPaths to find the USSD popup text 
const USSD_XPATHS = [
    '//*[@resource-id="com.android.phone:id/message"]', // Samsung
    '//*[@resource-id="android:id/message"]', // Motorola / Pixel
    '//android.widget.TextView[contains(@text,"MSISDN")]',
    '//android.widget.TextView[contains(@text,"Balance")]',
    '//android.widget.TextView', // fallback
];
const CLOSE_XPATHS = [
    '//android.widget.Button[@text="OK"]',
    '//android.widget.Button[@text="Dismiss"]',
    '//android.widget.Button[@text="CANCEL"]',
    '//android.widget.Button[@resource-id="android:id/button1"]',
    '//android.widget.Button[@resource-id="android:id/button2"]',
    '//android.widget.Button', // fallback
];
//  Core: dial USSD and scrape popup 
async function dialAndScrapeUSSD(deviceId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    // Import dynamically so the file stays usable even if @wdio/appium-service
    // is not installed in every environment.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createDriver } = require('../utils/appiumDriver');
    console.log(`Dialing USSD on device: ${deviceId}`);
    const driver = await createDriver(deviceId);
    // Dial *199# via ADB intent (same as getSimNumberViaUSSD)
    await exec(`adb -s ${deviceId} shell am start -a android.intent.action.CALL -d tel:*199%23`);
    console.log('Waiting for USSD popup...');
    //  Wait up to 15 s for the popup 
    const deadline = Date.now() + 15000;
    let popupText = '';
    while (Date.now() < deadline) {
        for (const xp of USSD_XPATHS) {
            try {
                const el = await driver.$(xp);
                if (await el.isDisplayed()) {
                    const text = await el.getText();
                    if (text.toLowerCase().includes('running') ||
                        text.toLowerCase().includes('loading')) {
                        continue; // still loading
                    }
                    popupText = text;
                    break;
                }
            }
            catch (_) { /* element not found yet */ }
        }
        if (popupText)
            break;
        await driver.pause(400);
    }
    console.log('[USSD] 📋 Raw popup text:');
    console.log(popupText);
    //  Parse fields from popup text 
    const lines = popupText.split('\n').map(l => l.trim()).filter(Boolean);
    // MSISDN: 9672417412
    const sim = (_c = (_b = (_a = lines
        .find(l => l.toLowerCase().includes('msisdn'))) === null || _a === void 0 ? void 0 : _a.split(':')[1]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : null;
    // Main Balance: Rs 61.0
    const rawBalance = (_f = (_e = (_d = lines
        .find(l => l.toLowerCase().includes('balance'))) === null || _d === void 0 ? void 0 : _d.split(':')[1]) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : null;
    // Strip "Rs " prefix if present → "61.0"
    const balance = (rawBalance === null || rawBalance === void 0 ? void 0 : rawBalance.startsWith('Rs '))
        ? rawBalance.substring(3).trim()
        : rawBalance !== null && rawBalance !== void 0 ? rawBalance : undefined;
    // UL Vldty: 05-07-2026
    const validity = (_j = (_h = (_g = lines
        .find(l => l.toLowerCase().includes('vldty') || l.toLowerCase().includes('validity'))) === null || _g === void 0 ? void 0 : _g.split(':')[1]) === null || _h === void 0 ? void 0 : _h.trim()) !== null && _j !== void 0 ? _j : undefined;
    //  Log exactly as requested 
    console.log('SIM:', sim);
    console.log('BALANCE:', rawBalance); // original wording e.g. "Rs 61.0"
    console.log('VALIDITY:', validity); // e.g. "05-07-2026"
    //  Close the popup ─
    await closeUssdPopup(driver);
    await clearResidualUssdPopups(driver);
    if (!sim && !balance) {
        return { success: false, error: 'USSD popup did not return usable data' };
    }
    const balanceNumeric = parseBalance(balance);
    return {
        success: true,
        phoneNumber: sim !== null && sim !== void 0 ? sim : undefined,
        balance: balance !== null && balance !== void 0 ? balance : undefined,
        balanceNumeric: balanceNumeric !== null && balanceNumeric !== void 0 ? balanceNumeric : undefined,
        validity,
    };
}
//  Close popup helpers 
async function closeUssdPopup(driver) {
    for (const xpath of CLOSE_XPATHS) {
        try {
            const btn = await driver.$(xpath);
            if (await btn.isDisplayed()) {
                await btn.click();
                return true;
            }
        }
        catch (_) { /* not found */ }
    }
    return false;
}
async function clearResidualUssdPopups(driver) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        try {
            const msg = await driver.$('//*[@resource-id="android:id/message"]');
            if (await msg.isDisplayed()) {
                console.log('[USSD] Closing secondary USSD popup...');
                await closeUssdPopup(driver);
                await driver.pause(500);
                continue;
            }
        }
        catch (_) { /* gone */ }
        await driver.pause(300);
    }
}
//  Retry wrapper 
const MAX_RETRIES = 2;
async function performUSSDWithRetry(deviceId) {
    var _a;
    let lastError = '';
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${MAX_RETRIES} for device: ${deviceId}`);
            const result = await dialAndScrapeUSSD(deviceId);
            if (result.success)
                return result;
            lastError = (_a = result.error) !== null && _a !== void 0 ? _a : 'Unknown error';
        }
        catch (e) {
            lastError = e.message;
            console.error(`[USSD]  Attempt ${attempt} failed: ${lastError}`);
        }
        if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    return { success: false, error: lastError };
}
//  Public API 
/** Pre-test: reuse cache when phone number matches, otherwise fresh dial */
async function getOrPerformPreTestUSSD(deviceId, phoneNumber) {
    var _a;
    const cleanExpected = cleanNumber(phoneNumber);
    const cached = lastPostTestUSSDCache.get(deviceId);
    if (cached) {
        const cleanCached = cleanNumber((_a = cached.phoneNumber) !== null && _a !== void 0 ? _a : '');
        if (cleanExpected === cleanCached) {
            console.log(`Reusing cached balance for ${deviceId}: ₹${cached.balance}`);
            return { ...cached, cachedFromPreviousTest: true };
        }
    }
    console.log(`Performing fresh balance check for ${deviceId}...`);
    return performUSSDWithRetry(deviceId);
}
/** Post-test: always fresh dial, update cache on success */
async function performPostTestUSSD(deviceId, phoneNumber) {
    console.log(`Performing post-test balance check for ${deviceId}...`);
    const result = await performUSSDWithRetry(deviceId);
    if (result.success) {
        lastPostTestUSSDCache.set(deviceId, { ...result, cachedTimestamp: Date.now() });
    }
    else {
        lastPostTestUSSDCache.delete(deviceId);
    }
    return result;
}
/** Direct alias matching Java's USSDService.checkBalanceAndValidity() */
async function checkBalanceAndValidity(deviceId, ussdCode // accepted for API parity; USSD code is always *199#
) {
    void ussdCode;
    console.log(`checkBalanceAndValidity called for device: ${deviceId}`);
    return performUSSDWithRetry(deviceId);
}
//  Helpers 
function cleanNumber(num) {
    const cleaned = num.replace(/[^0-9]/g, '');
    return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
}
function parseBalance(val) {
    if (val === null || val === undefined)
        return null;
    const str = String(val).replace(/[Rs₹INR,\s]/g, '').trim();
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
}
function parseValidityToIso(text) {
    const t = String(text).trim();
    const m1 = t.match(/(\d{2})[\-/](\d{2})[\-/](\d{4})/);
    if (m1) {
        const dt = new Date(`${m1[3]}-${m1[2]}-${m1[1]}`);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }
    const m2 = t.match(/(\d{2})[\-/](\d{2})[\-/](\d{2})/);
    if (m2) {
        const yy = parseInt(m2[3], 10);
        const year = yy + (yy >= 70 ? 1900 : 2000);
        const dt = new Date(`${year}-${m2[2]}-${m2[1]}`);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }
    return null;
}
function toLegacyResponse(result) {
    const validityDate = result.validity ? parseValidityToIso(result.validity) : null;
    const validityIsFuture = validityDate ? new Date(validityDate) > new Date() : null;
    return {
        success: result.success,
        phoneNumber: result.phoneNumber,
        balance: result.balance != null ? `₹${result.balance}` : undefined,
        validityDate,
        validityIsFuture,
        error: result.error
    };
}
