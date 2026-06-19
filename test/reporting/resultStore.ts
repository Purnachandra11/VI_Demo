import fs from 'fs';
import path from 'path';
import type { TestResultRow, ReportSuite } from './types';
import { RESULTS_TEMP_DIR, ensureTempDir } from './helpers';

function saveResult(suite: ReportSuite, row: TestResultRow): void {
  ensureTempDir();
  const id = Math.random().toString(36).substring(2, 15);
  const stamp = Date.now();
  const fileName = `${suite}_${stamp}_${id}.json`;
  const filePath = path.join(RESULTS_TEMP_DIR, fileName);
  
  const data = { ...row, testTimestamp: row.testTimestamp || new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getResults(suite: ReportSuite): TestResultRow[] {
  if (!fs.existsSync(RESULTS_TEMP_DIR)) return [];
  
  return fs.readdirSync(RESULTS_TEMP_DIR)
    .filter(file => file.startsWith(`${suite}_`) && file.endsWith('.json'))
    .map(file => {
      try {
        const content = fs.readFileSync(path.join(RESULTS_TEMP_DIR, file), 'utf8');
        return JSON.parse(content) as TestResultRow;
      } catch (e) {
        console.error(`[ResultStore] Error reading ${file}:`, e);
        return null;
      }
    })
    .filter((r): r is TestResultRow => r !== null);
}

export function addCallingResult(row: TestResultRow): void {
  saveResult('calling', row);
}

export function addSmsResult(row: TestResultRow): void {
  saveResult('sms', row);
}

export function addDataUsageResult(row: TestResultRow): void {
  saveResult('data', row);
}

export function addSimLatchResult(row: TestResultRow): void {
  saveResult('sim-latch', row);
}

export function getCallingResults(): TestResultRow[] {
  return getResults('calling');
}

export function getSmsResults(): TestResultRow[] {
  return getResults('sms');
}

export function getDataUsageResults(): TestResultRow[] {
  return getResults('data');
}

export function getSimLatchResults(): TestResultRow[] {
  return getResults('sim-latch');
}

export function clearResults(): void {
  if (fs.existsSync(RESULTS_TEMP_DIR)) {
    try {
      const files = fs.readdirSync(RESULTS_TEMP_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(RESULTS_TEMP_DIR, file));
      }
    } catch (e) {
      console.error('[ResultStore] Error clearing results:', e);
    }
  }
}

export function detectSuitesFromEnv(): ReportSuite[] {
  const specs = (process.env.WDIO_SPECS || '').toLowerCase();
  const suites: ReportSuite[] = [];
  if (specs.includes('calling')) suites.push('calling');
  if (specs.includes('sms')) suites.push('sms');
  if (specs.includes('data')) suites.push('data');
  if (specs.includes('sim-latch')) suites.push('sim-latch');
  if (!suites.length) suites.push('calling');
  return suites;
}
