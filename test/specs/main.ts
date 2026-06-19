import { checkBalanceAndValidity } from '../utils/ussdService';

async function main(): Promise<void> {
  const deviceId = 'ZA2237FKXH';

  console.log(`Testing USSD on device: ${deviceId}`);
  console.log('======================================')
  ;

  // Full USSD Service
  
  console.log('Full USSD Service',':--');

  const detailedResult = await checkBalanceAndValidity(deviceId, '*199#');

  if (detailedResult.success) {
    console.log('SUCCESS!');
    console.log(`Phone           : ${detailedResult.phoneNumber ?? 'N/A'}`);
    console.log(`Balance         : ₹${detailedResult.balance ?? 'N/A'}`);
    console.log(`Numeric Balance : ${detailedResult.balanceNumeric ?? 'N/A'}`);

    if (detailedResult.validity != null) {
      console.log(`Validity        : ${detailedResult.validity}`);
    }

    // Summary
    console.log('\nDevice Status');
    console.log('----------------------------');
    console.log(`Device ID       : ${deviceId}`);
    console.log(`Connected       : ${detailedResult.deviceDisconnected ? 'Disconnected' : 'Connected'}`);
    // console.log(`Cached Result   : ${detailedResult.cachedFromPreviousTest ? 'Yes (from previous test)' : 'No (fresh fetch)'}`);
  } else {
    console.log(`FAILED: ${detailedResult.error ?? 'Unknown error'}`);
  }

  console.log('\n All tests completed!');
}

main().catch((err: Error) => {
  console.error('Unhandled error:', err.message);
  process.exit(1);
});