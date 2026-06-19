/**
 * Filters WDIO/Appium stdout for dashboard display — hides technical noise.
 */

const HIDE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+(WARN|ERROR|INFO)\s+webdriver:/i,
  /Initiate new session using the WebDriver protocol/i,
  /Connecting to existing driver at/i,
  /cannot be proxied to UiAutomator2/i,
  /instrumentation process is not running/i,
  /local port #\d+ is busy/i,
  /socket hang up/i,
  /stale element/i,
  /no such element/i,
  /^> telecom-wdio/i,
  /^> cross-env/i,
  /^> wdio run/i,
  /^npm run /i,
  /Execution of \d+ workers started/i,
  /RUNNING in Android on Android/i,
  /PASSED in Android on Android/i,
  /^"spec" Reporter:/i,
  /^Spec Files:/i,
  /Session ID:/i,
  /^\[Android #0-0\]\s*»/i,
  /^\[Android #0-0\]\s*Running:/i,
  /^\[Android #0-0\]\s*\d+ passing/i,
  /^\[Android #0-0\]\s*$/i,
  /^-{10,}$/,
  /^={10,}$/,
  /\[INFO\] WS_PROGRESS:/i,
  /\[WDIO\] Starting:/i,
  /\[WDIO\] Test passed:/i,
  /\[Reports\]/i,
  /\[WDIO\] Execution summary/i,
  /allure-results/i,
  /\[DriverManager\]/i,
  /\[DeviceManager\]/i,
  /DATA \{/,
  /RESULT \{/,
  /COMMAND findElement/i,
  /COMMAND isElementDisplayed/i,
  /Retrying \d+\/\d+/i,
  /@wdio\/utils:/i
];

const SHOW_HINTS = [
  /\[USSD\]/i,
  /USSD SUCCESS/i,
  /Phone\s*:/i,
  /Balance\s*:/i,
  /Main Balance/i,
  /MSISDN/i,
  /Validity/i,
  /SIM:/i,
  /BALANCE:/i,
  /VALIDITY:/i,
  /📞||💰||❌|||🔄|📤||💬|TEST \d+\//i,
  /EXECUTING ALL|CALLING TEST|SMS|DATA USAGE/i,
  /Pre-balance|Dialing|connected|SKIPPING|Success Rate/i,
  /Excel report|HTML report/i,
  /CLEANUP|Setup completed/i,
  /Call did not connect|Call Connected|Test Completed/i
];

function shouldShowUserLog(line) {
  const t = (line || '').trim();
  if (!t) return false;

  for (const p of SHOW_HINTS) {
    if (p.test(t)) return true;
  }

  for (const p of HIDE_PATTERNS) {
    if (p.test(t)) return false;
  }

  if (/^\[[\d-]+\]\s*$/.test(t)) return false;
  if (t.startsWith('at ') && t.includes('node_modules')) return false;

  return true;
}

function formatUserLogLine(line) {
  let t = (line || '').trim();
  t = t.replace(/^\[[\d-]+\]\s*\[0-0\]\s*/, '');
  t = t.replace(/^\[0-0\]\s*/, '');
  t = t.replace(/^\[[\d-]+\]\s*/, '');
  return t;
}

function inferLogType(line) {
  const t = line || '';
  if (/❌|ERROR|FAILED|failed/i.test(t) && !/not failed/i.test(t)) return 'error';
  if (/|WARNING|SKIPPING/i.test(t)) return 'warning';
  if (/|SUCCESS|passed|connected successfully/i.test(t)) return 'success';
  return 'info';
}

/** User-facing one-liner for progress WebSocket events (calling / sms / data) */
function formatProgressLog(testType, progress) {
  if (!progress?.action) return '';

  const phone = progress.phoneNumber || progress.number || '';
  const pct =
    progress.percentage != null ? ` (${Math.round(progress.percentage)}%)` : '';

  const icons = { calling: '📞', sms: '💬', data: '', 'sim-latch': '📡' };
  const icon = icons[testType] || '📊';

  return `${icon} ${progress.action}${phone ? ` — ${phone}` : ''}${pct}`;
}

module.exports = {
  shouldShowUserLog,
  formatUserLogLine,
  inferLogType,
  formatProgressLog
};
