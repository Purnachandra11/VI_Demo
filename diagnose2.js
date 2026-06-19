/**
 * diagnose2.js  — run with:  node diagnose2.js
 * WDIO v9-aware diagnostic
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cwd = process.cwd();
const checks = [];

function check(label, fn) {
  try {
    const result = fn();
    checks.push({ ok: true,  label, detail: result ?? '' });
  } catch (e) {
    checks.push({ ok: false, label, detail: e.message });
  }
}

// 1. WDIO version
check('WDIO version', () => {
  return require('@wdio/cli/package.json').version;
});

// 2. tsconfig target
check('tsconfig target is NOT ES2022', () => {
  const raw = fs.readFileSync(path.join(cwd, 'tsconfig.json'), 'utf8');
  const stripped = raw.replace(/\/\/.*$/mg, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const cfg = JSON.parse(stripped);
  const target = cfg.compilerOptions?.target ?? '(not set)';
  if (target === 'ES2022') throw new Error('Still ES2022 — change to ES2019');
  return target;
});

// 3. wdio conf does NOT have autoCompileOpts (removed in v9)
check('wdio.siebel.conf.ts does NOT have autoCompileOpts (v9 removed it)', () => {
  const confPath = path.join(cwd, 'test', 'config', 'wdio.siebel.conf.ts');
  const src = fs.readFileSync(confPath, 'utf8');
  if (src.includes('autoCompileOpts')) {
    throw new Error('autoCompileOpts is present — REMOVE IT (not valid in WDIO v9, causes TS2353 error which causes SKIPPED)');
  }
  return 'clean';
});

// 4. SiebelBillingPDFPage exists
check('SiebelBillingPDFPage.ts exists', () => {
  const p = path.join(cwd, 'test', 'pages', 'SiebelBillingPDFPage.ts');
  if (!fs.existsSync(p)) throw new Error('NOT FOUND — this file is imported by Siebelbillingpage.ts');
  return 'found';
});

// 5. invoice.types.ts exists
check('invoice.types.ts exists', () => {
  const p = path.join(cwd, 'test', 'types', 'invoice.types.ts');
  if (!fs.existsSync(p)) throw new Error('NOT FOUND — imported by multiple files');
  return 'found';
});

// 6. Run tsc --noEmit and capture errors
check('npx tsc --noEmit (zero errors)', () => {
  try {
    execSync('npx tsc --noEmit', { cwd, stdio: 'pipe' });
    return 'zero errors';
  } catch (e) {
    const out = e.stdout?.toString() ?? '';
    const errCount = (out.match(/error TS/g) ?? []).length;
    throw new Error(`${errCount} TypeScript error(s):\n${out.substring(0, 3000)}`);
  }
});

// Print results
console.log('\n' + '='.repeat(70));
console.log('WDIO v9 TypeScript Diagnostic');
console.log('='.repeat(70));
for (const c of checks) {
  const icon = c.ok ? '✅' : '❌';
  console.log(`\n${icon}  ${c.label}`);
  if (c.detail) {
    c.detail.split('\n').forEach(line => console.log(`       ${line}`));
  }
}

const failures = checks.filter(c => !c.ok);
console.log('\n' + '='.repeat(70));
if (failures.length === 0) {
  console.log('All checks passed.');
} else {
  console.log(`${failures.length} check(s) failed.`);
}
console.log('='.repeat(70) + '\n');