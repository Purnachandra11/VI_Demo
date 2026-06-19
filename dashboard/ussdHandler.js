const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
let ussdModule = null;

// Configuration
const USSD_CONFIG = {
  code: '*199#',
  maxRetries: 2,
  retryDelay: 1000,
  tsNodeOptions: {
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
      target: 'ES2019',
      skipLibCheck: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      strict: false
    }
  }
};

// Path resolution - cache for performance
const getPossiblePaths = () => [
  path.join(PROJECT_ROOT, 'dist', 'test', 'utils', 'ussdService.js'),
  path.join(PROJECT_ROOT, 'test', 'utils', 'ussdService.ts'),
  path.join(PROJECT_ROOT, 'test', 'utils', 'ussdService.js'),
  path.join(__dirname, '..', 'test', 'utils', 'ussdService.ts'),
];

function findUssdServicePath() {
  for (const p of getPossiblePaths()) {
    if (fs.existsSync(p)) {
      console.log(`USSD Found service at: ${p}`);
      return p;
    }
  }
  return null;
}

function registerTsNode() {
  try {
    process.env.TS_NODE_IGNORE_DEPRECATIONS = '6.0';
    process.env.TS_NODE_TRANSPILE_ONLY = 'true';
    process.env.TS_NODE_SKIP_IGNORE = 'true';

    const tsNode = require('ts-node');
    tsNode.register(USSD_CONFIG.tsNodeOptions);
    return true;
  } catch (error) {
    console.log('USSD  Programmatic registration failed, trying fallback...');
    
    const registerPath = path.join(PROJECT_ROOT, 'node_modules', 'ts-node', 'register', 'transpile-only.js');
    if (fs.existsSync(registerPath)) {
      require(registerPath);
      return true;
    }
    
    throw new Error('ts-node not found. Run "npm install" first.');
  }
}

function loadUssdService() {
  if (ussdModule) {
    return ussdModule;
  }

  const ussdPath = findUssdServicePath();
  if (!ussdPath) {
    throw new Error('USSD service file not found');
  }

  if (ussdPath.endsWith('.ts')) {
    registerTsNode();
  }

  delete require.cache[ussdPath];
  ussdModule = require(ussdPath);

  const requiredExports = ['checkBalanceAndValidity', 'toLegacyResponse'];
  const missingExports = requiredExports.filter(exp => !ussdModule[exp]);
  
  if (missingExports.length > 0) {
    throw new Error(`Module missing exports: ${missingExports.join(', ')}`);
  }

  console.log('USSD Service loaded successfully');
  return ussdModule;
}

async function retryOperation(operation, maxRetries = USSD_CONFIG.maxRetries) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt <= maxRetries) {
        console.log(`USSD Retry ${attempt}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, USSD_CONFIG.retryDelay));
        ussdModule = null;
      }
    }
  }
  
  throw lastError;
}

async function getSimNumberViaUSSD(deviceId, res = null) {
  console.log(`USSD check for device ${deviceId}`);

  const send = res 
    ? data => res.write(`data: ${JSON.stringify(data)}\n\n`)
    : () => {};

  send({ status: 'Dialing USSD', progress: 10 });

  try {
    const module = await retryOperation(() => loadUssdService());
    
    console.log('USSD Dialing!');
    const result = await module.checkBalanceAndValidity(deviceId, USSD_CONFIG.code);
    
    if (!result || !result.success) {
      throw new Error(result?.error || 'USSD request failed');
    }

    const legacy = module.toLegacyResponse(result);
    const phoneNumber = legacy.phoneNumber ?? null;
    const balance = legacy.balance ?? null;
    const validityDate = legacy.validityDate ?? null;
    const validityIsFuture = legacy.validityIsFuture ?? null;

    console.log(`Phone: ${phoneNumber}`);
    console.log(`Balance: ₹${balance}`);
    console.log(`Validity: ${validityDate}`);

    send({
      status: 'Device Ready',
      balance,
      validityDate,
      validityIsFuture,
      progress: 30
    });

    return {
      phoneNumber,
      sim: phoneNumber,
      balance,
      balanceNumeric: result.balanceNumeric ?? null,
      validity: result.validity ?? null,
      validityDate,
      validityIsFuture,
      success: true,
      error: null
    };

  } catch (error) {
    console.error(`USSD Failed: ${error.message}`);
    
    send({ 
      status: 'Failed', 
      progress: 0,
      error: error.message 
    });

    return {
      phoneNumber: null,
      sim: null,
      balance: null,
      balanceNumeric: null,
      validity: null,
      validityDate: null,
      validityIsFuture: null,
      success: false,
      error: error.message
    };
  }
}

module.exports = { 
  getSimNumberViaUSSD, 
  loadUssdService,
  USSD_CONFIG
};