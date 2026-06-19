"use strict";
/**
 * simple-test.ts
 *
 * Sanity-check script: verifies that all test modules can be imported correctly
 * before running the full SMS suite.
 *
 * Fixed:
 *   TS18046 — `error` in catch block typed as `unknown`
 *   TS7006  — `f` parameter in files.filter() typed as `string`
 *
 * Usage: npx ts-node test/specs/simple-test.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ─── helper: safely extract message from an unknown error ───────────────────
function errMsg(e) {
    return e instanceof Error ? e.message : String(e);
}
// ────────────────────────────────────────────────────────────────────────────
console.log('='.repeat(80));
console.log('🔧 Simple Test — Checking Setup');
console.log('='.repeat(80));
try {
    console.log('\n📦 Testing imports...');
    // Use require() so the check runs at startup, the same as the original file.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../driver/DriverManager');
    console.log('✅ DriverManager loaded');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../pages/MessagingPage');
    console.log('✅ MessagingPage loaded');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../verification/MessageVerifier');
    console.log('✅ MessageVerifier loaded');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../utils/DeviceManager');
    console.log('✅ DeviceManager loaded');
    console.log('\n✅ All modules loaded successfully!');
    console.log('\n📝 To run the full test:');
    console.log('   npx ts-node test/specs/run-sms-tests.ts');
}
catch (error) {
    // TS18046 fix: cast before accessing .message
    console.error('\n❌ Import failed:', errMsg(error));
    console.log('\n📁 Current directory:', __dirname);
    console.log('\n📂 Checking if test directory exists...');
    const testDir = path_1.default.join(__dirname, '..', '..'); // two levels up from test/specs/
    if (fs_1.default.existsSync(testDir)) {
        console.log(`✅ Project root found: ${testDir}`);
        const testSubDir = path_1.default.join(testDir, 'test');
        if (fs_1.default.existsSync(testSubDir)) {
            console.log('✅ test/ directory exists');
            const entries = fs_1.default.readdirSync(testSubDir);
            // TS7006 fix: explicitly type the `f` parameter as `string`
            const subdirs = entries.filter((f) => fs_1.default.statSync(path_1.default.join(testSubDir, f)).isDirectory());
            console.log('   Subdirectories:', subdirs.join(', '));
        }
        else {
            console.log('❌ test/ directory not found inside project root');
        }
    }
    else {
        console.log('❌ Could not resolve project root from __dirname:', __dirname);
    }
    console.log('\n💡 Make sure you are running from the project root:');
    console.log('   cd "D:\\New VI UAT PROJECT\\WIP\\Automation Folder\\VI Demo 31.05.2026\\VI Demo"');
    console.log('   npx ts-node test/specs/simple-test.ts');
    process.exit(1);
}
