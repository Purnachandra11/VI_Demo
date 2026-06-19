/**
 * reveal_error.js — drop in project root, run with: node reveal_error.js
 * Forces ts-node to load the spec file the same way WDIO does,
 * and prints the actual error instead of silently skipping.
 */

const path = require('path');

// Register ts-node
require('ts-node').register({
  project: path.resolve(__dirname, 'tsconfig.json'),
  transpileOnly: true,
});

console.log('ts-node registered OK');

// Try loading each file in the import chain
const files = [
  'test/config/siebel.config.ts',
  'test/utils/SiebelSelectors.ts',
  'test/utils/SiebelHelper.ts',
  'test/pages/SiebelLoginPage.ts',
  'test/pages/SiebelSubscriptionsPage.ts',
  'test/pages/SiebelBillingPDFPage.ts',
  'test/pages/Siebelbillingpage.ts',
  'test/services/ExcelDataService.ts',
  'test/specs/siebel_invoice_validation.spec.ts',
];

for (const f of files) {
  try {
    require(path.resolve(__dirname, f));
    console.log(`✅  ${f}`);
  } catch (e) {
    console.error(`\n❌  FAILED: ${f}`);
    console.error(`    ${e.message}`);
    if (e.code) console.error(`    code: ${e.code}`);
    process.exit(1);
  }
}

console.log('\nAll files loaded successfully.');