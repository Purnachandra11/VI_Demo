"use strict";
/** USSD constants —  USSDConfig */
Object.defineProperty(exports, "__esModule", { value: true });
exports.USSD_APP_PACKAGES = exports.ERROR_INDICATORS = exports.COMPLETION_INDICATORS = exports.BALANCE_UPDATE_WAIT = exports.USSD_COMPLETION_TIMEOUT = exports.USSD_RESPONSE_TIMEOUT = exports.USSD_DIAL_TIMEOUT = exports.BALANCE_CHECK_CODE = void 0;
exports.BALANCE_CHECK_CODE = '*199#';
exports.USSD_DIAL_TIMEOUT = 30000;
exports.USSD_RESPONSE_TIMEOUT = 45000;
exports.USSD_COMPLETION_TIMEOUT = 60000;
exports.BALANCE_UPDATE_WAIT = 8000;
exports.COMPLETION_INDICATORS = [
    'main balance',
    'balance',
    'valid till',
    'validity',
    'rs.',
    '₹'
];
exports.ERROR_INDICATORS = [
    'connection problem',
    'not available',
    'failed',
    'error',
    'try again'
];
exports.USSD_APP_PACKAGES = [
    'com.android.phone',
    'com.google.android.dialer',
    'com.android.stk'
];
