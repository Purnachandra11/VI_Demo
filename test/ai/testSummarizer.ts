import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../../config/wdio.shared';

export interface ExecutionSummary {
  generatedAt: string;
  framework: string;
  deviceId?: string;
  phoneNumber?: string;
  suites: string[];
  reports: {
    suite: string;
    excel?: string;
    html?: string;
  }[];
  junitFiles: string[];
  aiInsights?: {
    enabled: boolean;
    failures: Array<{
      test: string;
      category: string;
      rootCause: string;
      suggestions: string[];
    }>;
    summary?: string;
  };
  allureHint: string;
}

const AI_FAILURES_FILE = path.join(PROJECT_ROOT, 'reports', 'ai-failures.json');

/** Gen AI–aware execution summary — extends Java ReportGenerator post-run output */
export class TestSummarizer {
  writeSummary(outputPath: string, extras: Partial<ExecutionSummary> = {}): ExecutionSummary {
    const junitDir = path.join(PROJECT_ROOT, 'reports', 'junit');
    const manifestPath = path.join(
      PROJECT_ROOT,
      'test-output',
      'comprehensive-reports',
      'latest-manifest.json'
    );

    const summary: ExecutionSummary = {
      generatedAt: new Date().toISOString(),
      framework: 'WebdriverIO + TypeScript + Gen AI',
      deviceId: process.env.APARTY_DEVICE || process.env.DEVICE_ID,
      phoneNumber: process.env.APARTY_NUMBER || process.env.A_PARTY_NUMBER,
      suites: [],
      reports: [],
      junitFiles: [],
      allureHint: 'npm run report:allure:open',
      ...extras
    };

    if (fs.existsSync(junitDir)) {
      summary.junitFiles = fs.readdirSync(junitDir).filter(f => f.endsWith('.xml'));
    }

    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<
          string,
          { excel?: string; html?: string }
        >;
        for (const [suite, files] of Object.entries(manifest)) {
          summary.suites.push(suite);
          summary.reports.push({ suite, excel: files.excel, html: files.html });
        }
      } catch {
        /* ignore */
      }
    }

    if (fs.existsSync(AI_FAILURES_FILE)) {
      try {
        const ai = JSON.parse(fs.readFileSync(AI_FAILURES_FILE, 'utf8')) as ExecutionSummary['aiInsights'];
        summary.aiInsights = ai;
      } catch {
        /* ignore */
      }
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');

    const htmlPath = outputPath.replace(/\.json$/i, '.html');
    fs.writeFileSync(htmlPath, this.buildHtmlSummary(summary), 'utf8');
    console.log(`[Reports] Execution summary HTML → ${htmlPath}`);

    return summary;
  }

  private buildHtmlSummary(summary: ExecutionSummary): string {
    const reportRows = summary.reports
      .map(
        r => `<tr><td>${r.suite}</td><td>${r.excel ? path.basename(r.excel) : '—'}</td>
<td>${r.html ? `<a href="${path.basename(r.html)}">${path.basename(r.html)}</a>` : '—'}</td></tr>`
      )
      .join('');

    const aiBlock = summary.aiInsights?.failures?.length
      ? `<div class="ai-box"><h2>Gen AI Failure Analysis</h2>
${summary.aiInsights.failures
  .map(
    f => `<div class="ai-item"><strong>${f.test}</strong> [${f.category}]<br>
<span>${f.rootCause}</span><ul>${f.suggestions.map(s => `<li>${s}</li>`).join('')}</ul></div>`
  )
  .join('')}</div>`
      : '<p class="muted">No AI failure analysis (all tests passed or AI disabled).</p>';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Execution Summary</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:24px;background:#f4f6f8;color:#1a1a1a}
.card{background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
h1{color:#e60000;margin-top:0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#1f4e79;color:#fff}.ai-box{background:#fff8e6;border-left:4px solid #f59e0b;padding:12px;border-radius:6px}
.ai-item{margin-bottom:12px}.muted{color:#666}
</style></head><body>
<h1>Telecom UAT — Execution Summary</h1>
<div class="card"><p><strong>Framework:</strong> ${summary.framework}</p>
<p><strong>Device:</strong> ${summary.deviceId || 'N/A'} | <strong>Number:</strong> ${summary.phoneNumber || 'N/A'}</p>
<p><strong>Generated:</strong> ${summary.generatedAt}</p></div>
<div class="card"><h2>Reports</h2><table><thead><tr><th>Suite</th><th>Excel</th><th>HTML</th></tr></thead><tbody>
${reportRows || '<tr><td colspan="3">No suite reports generated</td></tr>'}
</tbody></table></div>
<div class="card">${aiBlock}</div>
<div class="card"><p><strong>Allure:</strong> ${summary.allureHint}</p></div>
</body></html>`;
  }
}

export function recordAiFailure(entry: {
  test: string;
  category: string;
  rootCause: string;
  suggestions: string[];
}): void {
  const dir = path.dirname(AI_FAILURES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let data: ExecutionSummary['aiInsights'] = {
    enabled: process.env.AI_ENABLED === 'true',
    failures: []
  };

  if (fs.existsSync(AI_FAILURES_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(AI_FAILURES_FILE, 'utf8'));
    } catch {
      /* reset */
    }
  }

  data!.failures = data!.failures || [];
  data!.failures.push(entry);
  fs.writeFileSync(AI_FAILURES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function clearAiFailures(): void {
  if (fs.existsSync(AI_FAILURES_FILE)) fs.unlinkSync(AI_FAILURES_FILE);
}
