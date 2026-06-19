import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../../config/wdio.shared';
import type { GeneratedReports, ReportSuite, TestResultRow } from './types';
import {
  getCallingResults,
  getSmsResults,
  getDataUsageResults,
  getSimLatchResults,
  detectSuitesFromEnv,
  clearResults
} from './resultStore';
import * as excel from './excelReports';
import * as html from './htmlReports';

export {
  addCallingResult,
  addSmsResult,
  addDataUsageResult,
  addSimLatchResult,
  clearResults
} from './resultStore';

/** TypeScript port of com.telecom.utils.ReportGenerator */
export const ReportGenerator = {
  generateCallingExcelReport: excel.generateCallingExcelReport,
  generateCallingHTMLReport: (results: TestResultRow[]) =>
    Promise.resolve(html.generateCallingHTMLReport(results)),
  generateSMSExcelReport: excel.generateSMSExcelReport,
  generateSMSTestReport: (
    results: TestResultRow[],
    deviceId: string,
    deviceNumber: string
  ) => Promise.resolve(html.generateSMSTestReport(results, deviceId, deviceNumber)),
  generateDataUsageExcelReport: excel.generateDataUsageExcelReport,
  generateDataUsageHTMLReport: (results: TestResultRow[]) =>
    Promise.resolve(html.generateDataUsageHTMLReport(results)),
  generateSIMAutoLatchExcelReport: excel.generateSIMAutoLatchExcelReport,
  generateSIMAutoLatchHTMLReport: (results: TestResultRow[]) =>
    Promise.resolve(html.generateSIMAutoLatchHTMLReport(results))
};

async function generateSuiteReports(suite: ReportSuite): Promise<GeneratedReports> {
  const deviceId = process.env.APARTY_DEVICE || '';
  const deviceNumber = process.env.APARTY_NUMBER || '';
  const out: GeneratedReports = { allureDir: path.join(PROJECT_ROOT, 'allure-results') };

  if (suite === 'calling') {
    const results = getCallingResults();
    if (results.length) {
      out.excel = (await ReportGenerator.generateCallingExcelReport(results)) || undefined;
      out.html = await ReportGenerator.generateCallingHTMLReport(results);
    }
  }

  if (suite === 'sms') {
    const results = getSmsResults();
    if (results.length) {
      out.excel = (await ReportGenerator.generateSMSExcelReport(results)) || undefined;
      out.html = await ReportGenerator.generateSMSTestReport(results, deviceId, deviceNumber);
    }
  }

  if (suite === 'data') {
    const results = getDataUsageResults();
    if (results.length) {
      out.excel = (await ReportGenerator.generateDataUsageExcelReport(results)) || undefined;
      out.html = await ReportGenerator.generateDataUsageHTMLReport(results);
    }
  }

  if (suite === 'sim-latch') {
    const results = getSimLatchResults();
    if (results.length) {
      out.excel = (await ReportGenerator.generateSIMAutoLatchExcelReport(results)) || undefined;
      out.html = await ReportGenerator.generateSIMAutoLatchHTMLReport(results);
    }
  }

  return out;
}

/** Called from WDIO onComplete — writes Excel + HTML for executed suites */
export async function flushReports(): Promise<Record<string, GeneratedReports>> {
  const suites: ReportSuite[] = ['calling', 'sms', 'data', 'sim-latch'];
  const manifest: Record<string, GeneratedReports> = {};

  for (const suite of suites) {
    const report = await generateSuiteReports(suite);
    if (report.excel || report.html) {
      manifest[suite] = report;
      if (report.excel) console.log(`[Reports] ${suite} Excel → ${report.excel}`);
      if (report.html) console.log(`[Reports] ${suite} HTML → ${report.html}`);
    }
  }

  const indexPath = path.join(PROJECT_ROOT, 'test-output', 'comprehensive-reports', 'latest-manifest.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(manifest, null, 2), 'utf8');

  return manifest;
}
