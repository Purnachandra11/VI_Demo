/** USSD constants —  USSDConfig */

export const BALANCE_CHECK_CODE = '*199#';
export const USSD_DIAL_TIMEOUT = 30_000;
export const USSD_RESPONSE_TIMEOUT = 45_000;
export const USSD_COMPLETION_TIMEOUT = 60_000;
export const BALANCE_UPDATE_WAIT = 8_000;

export const COMPLETION_INDICATORS = [
  'main balance',
  'balance',
  'valid till',
  'validity',
  'rs.',
  '₹'
];

export const ERROR_INDICATORS = [
  'connection problem',
  'not available',
  'failed',
  'error',
  'try again'
];

export const USSD_APP_PACKAGES = [
  'com.android.phone',
  'com.google.android.dialer',
  'com.android.stk'
];
