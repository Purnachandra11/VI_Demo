/**
 * wdioRunner.js
 * Runs WebdriverIO + TypeScript specs from the dashboard (replaces mvn test).
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SIEBEL_PROJECT_ROOT = path.resolve(__dirname, '..', 'siebel-crm-automation');

/** npm script or WDIO_SPECS override per dashboard test type */
const TEST_MAP = {
  calling: { specs: './test/specs/calling.spec.ts' },
  sms: { specs: './test/specs/sms.spec.ts' },
  data: { specs: './test/specs/data.spec.ts' },
  latch: { specs: './test/specs/sim-latch.spec.ts' },
  'sim-auto-latch': { specs: './test/specs/sim-latch.spec.ts' },
  simToolkit: { specs: './test/specs/sim-toolkit.spec.ts' },
  'calling-sms': { specs: './test/specs/calling.spec.ts,./test/specs/sms.spec.ts' },
  incomingsms: { specs: './test/specs/calling.spec.ts,./test/specs/sms.spec.ts' },
  all: { specs: './test/specs/calling.spec.ts,./test/specs/sms.spec.ts,./test/specs/data.spec.ts' },
  'calling-data': {
    specs: './test/specs/calling.spec.ts,./test/specs/data.spec.ts'
  },
  'sms-data': {
    specs: './test/specs/sms.spec.ts,./test/specs/data.spec.ts'
  }
};

function loadDeviceSimMap() {
  const mapPath = path.join(PROJECT_ROOT, 'automation', 'controller', 'device-sim-map.json');
  if (!fs.existsSync(mapPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch {
    return [];
  }
}

function buildTestEnv(options = {}) {
  const {
    deviceId,
    phone,
    bPartyDevice,
    bPartyNumber,
    cPartyDevice,
    cPartyNumber,
    callDuration,
    networkType,
    volteEnabled
  } = options;

  const env = {
    ...process.env,
    APARTY_DEVICE: deviceId || '',
    A_PARTY_DEVICE: deviceId || '',
    DEVICE_ID: deviceId || '',
    APARTY_NUMBER: phone || '',
    A_PARTY_NUMBER: phone || '',
    BPARTY_DEVICE: bPartyDevice || '',
    B_PARTY_DEVICE: bPartyDevice || '',
    BPARTY_NUMBER: bPartyNumber || '',
    B_PARTY_NUMBER: bPartyNumber || '',
    CPARTY_DEVICE: cPartyDevice || '',
    C_PARTY_DEVICE: cPartyDevice || '',
    CPARTY_NUMBER: cPartyNumber || '',
    C_PARTY_NUMBER: cPartyNumber || '',
    UDID: deviceId || '',
    PROGRESS_ENDPOINT:
      process.env.PROGRESS_ENDPOINT || 'http://localhost:5174/api/progress/update'
  };

  if (callDuration != null) env.CALL_DURATION = String(callDuration);
  if (networkType) env.NETWORK_TYPE = String(networkType);
  if (volteEnabled != null) env.VOLTE_ENABLED = String(volteEnabled);

  return env;
}

function enrichPartiesFromDeviceMap(deviceId, phone) {
  const map = loadDeviceSimMap();
  const others = map.filter(entry => entry.id !== deviceId);
  const alpha = ['b', 'c', 'd'];
  const extra = {};

  others.slice(0, 3).forEach((entry, index) => {
    const letter = alpha[index];
    extra[`${letter}PartyDevice`] = entry.id;
    extra[`${letter}PartyNumber`] = entry.sim;
  });

  return {
    deviceId,
    phone,
    bPartyDevice: extra.bPartyDevice,
    bPartyNumber: extra.bPartyNumber,
    cPartyDevice: extra.cPartyDevice,
    cPartyNumber: extra.cPartyNumber,
    ...extra
  };
}

/* Previous (Commented out):
function resolveNpmCommand() {
  const isWin = os.platform() === 'win32';
  return {
    command: isWin ? 'npm.cmd' : 'npm',
    shell: isWin
  };
}
*/

function resolveWdioCommand(cwd = PROJECT_ROOT) {
  const isWin = os.platform() === 'win32';
  // Use local wdio binary directly to avoid npm/cross-env overhead (saves ~10-20s on Windows)
  let localWdio = path.join(cwd, 'node_modules', '.bin', isWin ? 'wdio.cmd' : 'wdio');
  
  if (fs.existsSync(localWdio)) {
    return {
      command: localWdio,
      shell: isWin
    };
  }

  // Fallback to npx if local binary not found
  return {
    command: isWin ? 'npx.cmd' : 'npx',
    argsPrefix: ['wdio'],
    shell: isWin
  };
}

/**
 * Spawn WDIO test run. Returns child process for streaming stdout/stderr.
 */
function runWdioTest(testType, options = {}, callbacks = {}) {
  const isSiebel = options.deviceId === 'SIEBEL_SCRM';
  const cwd = isSiebel ? SIEBEL_PROJECT_ROOT : PROJECT_ROOT;
  const mapping = isSiebel ? { specs: './specs/siebel_invoice_validation.spec.ts' } : TEST_MAP[testType];
  if (!mapping) {
    throw new Error(`Invalid test type: ${testType}`);
  }

  const enriched = isSiebel ? {} : enrichPartiesFromDeviceMap(options.deviceId, options.phone);
  const merged = { ...enriched, ...options };
  const env = buildTestEnv(merged);
  const { command, shell, argsPrefix = [] } = resolveWdioCommand(cwd);

  const configPath = isSiebel 
    ? path.join(SIEBEL_PROJECT_ROOT, 'config', 'wdio.siebel.conf.ts') 
    : path.join(PROJECT_ROOT, 'config', 'wdio.android.conf.ts');
  let args = [...argsPrefix, 'run', configPath];

  // Pass specs via environment variable as defined in TEST_MAP
  if (options.specs) {
    env.WDIO_SPECS = options.specs;
  } else if (mapping.specs) {
    env.WDIO_SPECS = mapping.specs;
  } else if (mapping.npmScript) {
    // Legacy support for npm scripts if still needed, but we prefer direct specs
    const { command: npmCmd } = resolveNpmCommand();
    return spawn(npmCmd, ['run', mapping.npmScript], { cwd, env, shell: true });
  } else {
    throw new Error(`No run configuration for test type: ${testType}`);
  }

  console.log(`[WDIO] ${command} ${args.join(' ')} (type=${testType}, device=${merged.deviceId})`);

  const child = spawn(command, args, {
    cwd,
    env,
    shell
  });

  if (callbacks.onStdout) {
    child.stdout.on('data', data => callbacks.onStdout(data.toString()));
  }
  if (callbacks.onStderr) {
    child.stderr.on('data', data => callbacks.onStderr(data.toString()));
  }
  if (callbacks.onClose) {
    child.on('close', code => callbacks.onClose(code));
  }
  if (callbacks.onError) {
    child.on('error', err => callbacks.onError(err));
  }

  return child;
}

/**
 * Promise wrapper for one-shot execution (TestOrchestrator).
 */
function runWdioTestAsync(testType, options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    runWdioTest(testType, options, {
      onStdout: chunk => { stdout += chunk; },
      onStderr: chunk => { stderr += chunk; },
      onClose: code => {
        if (code === 0) {
          resolve({ code, stdout, stderr });
        } else {
          const err = new Error(`WDIO exited with code ${code}`);
          err.code = code;
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        }
      },
      onError: reject
    });
  });
}

module.exports = {
  TEST_MAP,
  buildTestEnv,
  enrichPartiesFromDeviceMap,
  runWdioTest,
  runWdioTestAsync,
  PROJECT_ROOT
};
