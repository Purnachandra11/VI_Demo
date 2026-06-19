/**
 * diagnose.js  — run with:  node diagnose.js
 * Checks everything WDIO needs to compile and run TypeScript specs.
 */

const fs   = require('fs');
const path = require('path');

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

// 1. ts-node installed?
check('ts-node installed', () => {
  require.resolve('ts-node');
  return require('ts-node/package.json').version;
});

// 2. typescript installed?
check('typescript installed', () => {
  require.resolve('typescript');
  return require('typescript/package.json').version;
});

// 3. tsconfig.json exists?
check('tsconfig.json exists', () => {
  const p = path.join(cwd, 'tsconfig.json');
  if (!fs.existsSync(p)) throw new Error('NOT FOUND at ' + p);
  return p;
});

// 4. tsconfig.json is valid JSON?
check('tsconfig.json is valid', () => {
  const raw = fs.readFileSync(path.join(cwd, 'tsconfig.json'), 'utf8');
  // strip comments for JSON.parse
  const stripped = raw.replace(/\/\/.*$/mg, '').replace(/\/\*[\s\S]*?\*\//g, '');
  JSON.parse(stripped);
  return 'valid';
});

// 5. tsconfig target is NOT ES2022?
check('tsconfig target is ES2019 or lower', () => {
  const raw = fs.readFileSync(path.join(cwd, 'tsconfig.json'), 'utf8');
  const stripped = raw.replace(/\/\/.*$/mg, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const cfg = JSON.parse(stripped);
  const target = cfg.compilerOptions?.target ?? '(not set)';
  if (target === 'ES2022') throw new Error('Still ES2022! Change it to ES2019.');
  return target;
});

// 6. tsconfig has downlevelIteration?
check('tsconfig has downlevelIteration: true', () => {
  const raw = fs.readFileSync(path.join(cwd, 'tsconfig.json'), 'utf8');
  const stripped = raw.replace(/\/\/.*$/mg, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const cfg = JSON.parse(stripped);
  const val = cfg.compilerOptions?.downlevelIteration;
  if (!val) throw new Error('downlevelIteration is missing or false');
  return String(val);
});

// 7. wdio.siebel.conf.ts has autoCompileOpts?
check('wdio.siebel.conf.ts has autoCompileOpts', () => {
  const confPath = path.join(cwd, 'test', 'config', 'wdio.siebel.conf.ts');
  if (!fs.existsSync(confPath)) throw new Error('NOT FOUND: ' + confPath);
  const src = fs.readFileSync(confPath, 'utf8');
  if (!src.includes('autoCompileOpts')) throw new Error('autoCompileOpts block is MISSING from wdio.siebel.conf.ts');
  if (!src.includes('transpileOnly')) throw new Error('transpileOnly is missing from autoCompileOpts');
  return 'present';
});

// 8. spec file exists?
check('siebel_invoice_validation.spec.ts exists', () => {
  const p = path.join(cwd, 'test', 'specs', 'siebel_invoice_validation.spec.ts');
  if (!fs.existsSync(p)) throw new Error('NOT FOUND: ' + p);
  return p;
});

// 9. SiebelSubscriptionsPage has .to.contain (not .toContain)?
check('SiebelSubscriptionsPage uses .to.contain (chai style)', () => {
  const p = path.join(cwd, 'test', 'pages', 'SiebelSubscriptionsPage.ts');
  if (!fs.existsSync(p)) throw new Error('NOT FOUND: ' + p);
  const src = fs.readFileSync(p, 'utf8');
  const bad = (src.match(/\.toContain\(/g) ?? []).length;
  if (bad > 0) throw new Error(`Found ${bad} occurrence(s) of .toContain() — must be .to.contain()`);
  return 'clean';
});

// Print results
console.log('\n' + '='.repeat(60));
console.log('WDIO TypeScript Diagnostic');
console.log('='.repeat(60));
for (const c of checks) {
  const icon = c.ok ? '✅' : '❌';
  console.log(`${icon}  ${c.label}`);
  if (c.detail) console.log(`       ${c.detail}`);
}

const failures = checks.filter(c => !c.ok);
console.log('='.repeat(60));
if (failures.length === 0) {
  console.log('All checks passed — run npx tsc --noEmit next.');
} else {
  console.log(`${failures.length} check(s) failed — fix them, then re-run.`);
}
console.log('='.repeat(60) + '\n');