"use strict";
/**
 * siebel.config.ts
 * Runtime configuration for all Siebel Web automation steps.
 *
 * Set these in your .env file or as environment variables:
 *
 *   SIEBEL_URL           Full Siebel URL (defaults to VI production URL)
 *   SIEBEL_USERNAME      Siebel login username
 *   SIEBEL_PASSWORD      Siebel login password
 *   SIEBEL_OTP           Pre-set OTP/answer (leave blank for manual 30 s pause)
 *   SIEBEL_OTP_PAUSE_MS  Manual pause duration in ms (default 30000 = 30 s)
 *   SIEBEL_MSISDN        Mobile number to search in Step 4
 *   ANTHROPIC_API_KEY    Claude API key for Step 7 PDF reading
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiebelConfig = getSiebelConfig;
const DEFAULT_URL = 'https://sumeru-south.vodafoneidea.in:6100/ecommunications_enu/start.swe' +
    '?SWECmd=GotoView' +
    '&SWEView=CUT+Home+Page+View+(CME)' +
    '&SWERF=1' +
    '&SWEHo=sumeru-south.vodafoneidea.in' +
    '&SWEBU=1' +
    '&SWEApplet0=Salutation+Applet+(WCC+Home)' +
    '&SWERowId0=VRId-0';
function getSiebelConfig() {
    var _a, _b, _c, _d, _e, _f, _g;
    return {
        url: (_a = process.env.SIEBEL_URL) !== null && _a !== void 0 ? _a : DEFAULT_URL,
        username: (_b = process.env.SIEBEL_USERNAME) !== null && _b !== void 0 ? _b : 'COR4055772',
        password: (_c = process.env.SIEBEL_PASSWORD) !== null && _c !== void 0 ? _c : 'Test@123456789!',
        otp: (_d = process.env.SIEBEL_OTP) !== null && _d !== void 0 ? _d : '',
        otpPauseMs: parseInt((_e = process.env.SIEBEL_OTP_PAUSE_MS) !== null && _e !== void 0 ? _e : '30000', 10),
        msisdn: (_f = process.env.SIEBEL_MSISDN) !== null && _f !== void 0 ? _f : '',
        homePageTimeoutMs: parseInt((_g = process.env.SIEBEL_HOME_TIMEOUT_MS) !== null && _g !== void 0 ? _g : '60000', 10),
    };
}
