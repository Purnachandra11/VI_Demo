"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestSummarizer = void 0;
exports.recordAiFailure = recordAiFailure;
exports.clearAiFailures = clearAiFailures;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const wdio_shared_1 = require("../../config/wdio.shared");
const AI_FAILURES_FILE = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'reports', 'ai-failures.json');
/** Gen AI–aware execution summary — extends Java ReportGenerator post-run output */
class TestSummarizer {
    writeSummary(outputPath, extras = {}) {
        const junitDir = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'reports', 'junit');
        const manifestPath = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'test-output', 'comprehensive-reports', 'latest-manifest.json');
        const summary = {
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
        if (fs_1.default.existsSync(junitDir)) {
            summary.junitFiles = fs_1.default.readdirSync(junitDir).filter(f => f.endsWith('.xml'));
        }
        if (fs_1.default.existsSync(manifestPath)) {
            try {
                const manifest = JSON.parse(fs_1.default.readFileSync(manifestPath, 'utf8'));
                for (const [suite, files] of Object.entries(manifest)) {
                    summary.suites.push(suite);
                    summary.reports.push({ suite, excel: files.excel, html: files.html });
                }
            }
            catch {
                /* ignore */
            }
        }
        if (fs_1.default.existsSync(AI_FAILURES_FILE)) {
            try {
                const ai = JSON.parse(fs_1.default.readFileSync(AI_FAILURES_FILE, 'utf8'));
                summary.aiInsights = ai;
            }
            catch {
                /* ignore */
            }
        }
        fs_1.default.mkdirSync(path_1.default.dirname(outputPath), { recursive: true });
        fs_1.default.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
        const htmlPath = outputPath.replace(/\.json$/i, '.html');
        fs_1.default.writeFileSync(htmlPath, this.buildHtmlSummary(summary), 'utf8');
        console.log(`[Reports] Execution summary HTML → ${htmlPath}`);
        return summary;
    }
    buildHtmlSummary(summary) {
        var _a, _b;
        const reportRows = summary.reports
            .map(r => `<tr><td>${r.suite}</td><td>${r.excel ? path_1.default.basename(r.excel) : '—'}</td>
<td>${r.html ? `<a href="${path_1.default.basename(r.html)}">${path_1.default.basename(r.html)}</a>` : '—'}</td></tr>`)
            .join('');
        const aiBlock = ((_b = (_a = summary.aiInsights) === null || _a === void 0 ? void 0 : _a.failures) === null || _b === void 0 ? void 0 : _b.length)
            ? `<div class="ai-box"><h2>Gen AI Failure Analysis</h2>
${summary.aiInsights.failures
                .map(f => `<div class="ai-item"><strong>${f.test}</strong> [${f.category}]<br>
<span>${f.rootCause}</span><ul>${f.suggestions.map(s => `<li>${s}</li>`).join('')}</ul></div>`)
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
exports.TestSummarizer = TestSummarizer;
function recordAiFailure(entry) {
    const dir = path_1.default.dirname(AI_FAILURES_FILE);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    let data = {
        enabled: process.env.AI_ENABLED === 'true',
        failures: []
    };
    if (fs_1.default.existsSync(AI_FAILURES_FILE)) {
        try {
            data = JSON.parse(fs_1.default.readFileSync(AI_FAILURES_FILE, 'utf8'));
        }
        catch {
            /* reset */
        }
    }
    data.failures = data.failures || [];
    data.failures.push(entry);
    fs_1.default.writeFileSync(AI_FAILURES_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function clearAiFailures() {
    if (fs_1.default.existsSync(AI_FAILURES_FILE))
        fs_1.default.unlinkSync(AI_FAILURES_FILE);
}
