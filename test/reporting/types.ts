/** Row payload aligned with Java ReportGenerator Map<String, Object> keys */
export type TestResultRow = Record<string, unknown>;

export type ReportSuite = 'calling' | 'sms' | 'data' | 'sim-latch' | 'all';

export interface GeneratedReports {
  excel?: string;
  html?: string;
  allureDir: string;
}
