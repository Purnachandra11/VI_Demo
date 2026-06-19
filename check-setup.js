const { execSync } = require('child_process');
const fs = require('fs');

console.log('='.repeat(80));
console.log('🔍 System Diagnostic');
console.log('='.repeat(80));

// Node version
console.log(`\n📦 Node version: ${process.version}`);

// Check ADB
console.log('\n📱 ADB Check:');
try {
    const adbVersion = execSync('adb version', { encoding: 'utf8' }).split('\n')[0];
    console.log(`   ${adbVersion}`);
    
    const devices = execSync('adb devices', { encoding: 'utf8' });
    console.log('\n   Connected devices:');
    devices.split('\n').forEach(line => {
        if (line.trim() && !line.includes('List of devices')) {
            console.log(`   - ${line}`);
        }
    });
} catch (error) {
    console.log('   ❌ ADB not found. Add Android SDK to PATH');
}

// Check Appium
console.log('\n🚀 Appium Check:');
try {
    const appiumVersion = execSync('appium --version', { encoding: 'utf8' }).trim();
    console.log(`   ✅ Appium version: ${appiumVersion}`);
} catch (error) {
    console.log('   ❌ Appium not found. Run: npm install -g appium');
}

// Check project files
console.log('\n📁 Project Files:');
const requiredFiles = [
    'test/driver/DriverManager.js',
    'test/driver/DriverManager.ts',
    'test/pages/MessagingPage.js',
    'test/pages/MessagingPage.ts',
    'test/verification/MessageVerifier.js',
    'test/verification/MessageVerifier.ts'
];

requiredFiles.forEach(file => {
    const jsExists = fs.existsSync(file);
    const tsExists = fs.existsSync(file.replace('.js', '.ts'));
    const exists = jsExists || tsExists;
    const status = exists ? '✅' : '❌';
    const type = jsExists ? 'JS' : (tsExists ? 'TS' : 'Missing');
    console.log(`   ${status} ${file} (${type})`);
});

console.log('\n' + '='.repeat(80));
