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

const DEFAULT_URL =
  'https://sumeru-south.vodafoneidea.in:6100/ecommunications_enu/start.swe' +
  '?SWECmd=GotoView' +
  '&SWEView=CUT+Home+Page+View+(CME)' +
  '&SWERF=1' +
  '&SWEHo=sumeru-south.vodafoneidea.in' +
  '&SWEBU=1' +
  '&SWEApplet0=Salutation+Applet+(WCC+Home)' +
  '&SWERowId0=VRId-0';

export interface SiebelConfig {
  url:                string;
  username:           string;
  password:           string;
  /** Pre-set OTP or security answer. Empty = pause for manual entry. */
  otp:                string;
  /** Milliseconds to pause waiting for manual OTP/answer entry. */
  otpPauseMs:         number;
  /** MSISDN to search in Step 4. */
  msisdn:             string;
  /** Max wait for Siebel Home page to load after login (ms). */
  homePageTimeoutMs:  number;
}

export function getSiebelConfig(): SiebelConfig {
  return {
    url:               process.env.SIEBEL_URL              ?? DEFAULT_URL,
    username:          process.env.SIEBEL_USERNAME         ?? 'COR4055772',
    password:          process.env.SIEBEL_PASSWORD         ?? 'Test@123456789!',
    otp:               process.env.SIEBEL_OTP              ?? '',
    otpPauseMs:        parseInt(process.env.SIEBEL_OTP_PAUSE_MS   ?? '30000', 10),
    msisdn:            process.env.SIEBEL_MSISDN           ?? '',
    homePageTimeoutMs: parseInt(process.env.SIEBEL_HOME_TIMEOUT_MS ?? '60000', 10),
  };
}