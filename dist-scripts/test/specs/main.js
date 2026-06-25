"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ussdService_1 = require("../utils/ussdService");
async function main() {
    var _a, _b, _c, _d;
    const deviceId = 'ZA2237FKXH';
    console.log(`Testing USSD on device: ${deviceId}`);
    console.log('======================================');
    // Full USSD Service
    console.log('Full USSD Service', ':--');
    const detailedResult = await (0, ussdService_1.checkBalanceAndValidity)(deviceId, '*199#');
    if (detailedResult.success) {
        console.log('SUCCESS!');
        console.log(`Phone           : ${(_a = detailedResult.phoneNumber) !== null && _a !== void 0 ? _a : 'N/A'}`);
        console.log(`Balance         : ₹${(_b = detailedResult.balance) !== null && _b !== void 0 ? _b : 'N/A'}`);
        console.log(`Numeric Balance : ${(_c = detailedResult.balanceNumeric) !== null && _c !== void 0 ? _c : 'N/A'}`);
        if (detailedResult.validity != null) {
            console.log(`Validity        : ${detailedResult.validity}`);
        }
        // Summary
        console.log('\nDevice Status');
        console.log('----------------------------');
        console.log(`Device ID       : ${deviceId}`);
        console.log(`Connected       : ${detailedResult.deviceDisconnected ? 'Disconnected' : 'Connected'}`);
        // console.log(`Cached Result   : ${detailedResult.cachedFromPreviousTest ? 'Yes (from previous test)' : 'No (fresh fetch)'}`);
    }
    else {
        console.log(`FAILED: ${(_d = detailedResult.error) !== null && _d !== void 0 ? _d : 'Unknown error'}`);
    }
    console.log('\n All tests completed!');
}
main().catch((err) => {
    console.error('Unhandled error:', err.message);
    process.exit(1);
});
