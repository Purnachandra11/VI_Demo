console.log('='.repeat(80));
console.log('🔧 Simple Test - Checking Setup');
console.log('='.repeat(80));

// Check if we can import modules
try {
    console.log('\n📦 Testing imports...');
    
    const DriverManager = require('./test/driver/DriverManager');
    console.log('✅ DriverManager loaded');
    
    const MessagingPage = require('./test/pages/MessagingPage');
    console.log('✅ MessagingPage loaded');
    
    const MessageVerifier = require('./test/verification/MessageVerifier');
    console.log('✅ MessageVerifier loaded');
    
    const DeviceManager = require('./test/utils/DeviceManager');
    console.log('✅ DeviceManager loaded');
    
    console.log('\n✅ All modules loaded successfully!');
    console.log('\n📝 To run the full test:');
    console.log('   node run-sms-test.js');
    
} catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.log('\n📁 Current directory:', __dirname);
    
    const fs = require('fs');
    console.log('\n📂 Checking directory structure:');
    
    if (fs.existsSync('./test')) {
        console.log('✅ test directory exists');
        const items = fs.readdirSync('./test');
        console.log('   Contents:', items.join(', '));
    } else {
        console.log('❌ test directory not found!');
    }
}
