// swiftCrmOrchestrator.js - Updated with IN and SWIFT support

"use strict";

const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");

const browserSession = {
  isLoggedIn: false,
  lastLoginAt: null,
  lastActivityAt: null,
};

class SwiftCrmOrchestrator {
  constructor(
    excelFilePath,
    wsClients,
    uploadDir,
    viAppOtp = null,
    matchedRowsFromFrontend = null,
  ) {
    this.excelFilePath = excelFilePath;
    this.wsClients = wsClients;
    this.uploadDir = uploadDir;
    this.swiftDir = path.join(__dirname, "..", "swift-crm-automation");
    this.commDir = path.join(this.swiftDir, "comm");
    this.viAppOtp = viAppOtp;
    this.matchedRowsFromFrontend = matchedRowsFromFrontend;

    // Comm files
    this.captchaRequestFile = path.join(this.commDir, "captcha_request.json");
    this.captchaResponseFile = path.join(this.commDir, "captcha_response.json");
    this.otpRequestFile = path.join(this.commDir, "otp_request.json");
    this.otpResponseFile = path.join(this.commDir, "otp_response.json");
    this.rechargeConfirmFile = path.join(this.commDir, "recharge_confirmed.json");
    this.matchedRowsFile = path.join(this.commDir, "matched_rows.json");
    this.loginStateFile = path.join(this.commDir, "login_state.json");

    // Runtime state
    this.testData = null;
    this.matchedRows = [];
    this.screenshots = [];
    this.reportPath = null;
    this.currentWdioProcess = null;
    this.rowStatuses = [];
    this.planData = [];

    // Polling intervals
    this.captchaPollingInterval = null;
    this.otpPollingInterval = null;
    this._loginStatusInterval = null;

    // Modal de-dup guards
    this.lastCaptchaTimestamp = null;
    this.captchaModalShown = false;
    this.lastOtpTimestamp = null;
    this.otpModalShown = false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // BROADCAST HELPERS
  // ══════════════════════════════════════════════════════════════════════

  broadcast(data) {
    const msg = JSON.stringify(data);
    this.wsClients.forEach((c) => {
      if (c.readyState === 1) c.send(msg);
    });
  }

  log(message, logType = "info") {
    this.broadcast({
      type: "log",
      message,
      logType,
      timestamp: new Date().toISOString(),
    });
  }

  progress(percentage, action, status = "") {
    this.broadcast({
      type: "progress",
      progress: { percentage, action, status },
    });
  }

  broadcastRowPlan(rows) {
    this.broadcast({
      type: "row_plan",
      rows: rows.map((r, i) => ({
        rowIndex: r.rowIndex !== undefined ? r.rowIndex : i,
        srNo: i + 1,
        msisdn: r.msisdn,
        rechargeMRP: r.rechargeMRP,
        recharge: r.recharge,
        inFlag: r.inFlag,
        swift: r.swift,
        viApp: r.viApp,
        circle: r.circle,
        status: "pending",
      })),
    });
  }

  broadcastRowStatus(rowIndex, status, extra = {}) {
    const entry = this.rowStatuses.find((r) => r.rowIndex === rowIndex);
    if (entry) entry.status = status;
    this.broadcast({ type: "row_status", rowIndex, status, ...extra });
  }

  broadcastLoginStatus(status, detail = "") {
    this.broadcast({
      type: "login_status",
      status,
      detail,
      timestamp: new Date().toISOString(),
    });
    const lt = status === "logged_in" ? "success" : "info";
    this.log(`[Login] ${status}${detail ? ": " + detail : ""}`, lt);
  }

  static setLatestReportPath(fp) {
    if (global.setSwiftLatestReport) global.setSwiftLatestReport(fp);
  }

  // ══════════════════════════════════════════════════════════════════════
  // INITIALIZE — resolve which rows we will actually run
  // ══════════════════════════════════════════════════════════════════════

  async initialize() {
    this.log("Initializing UAT Automation…", "info");
    this.progress(5, "Initializing", "Reading Excel");

    if (!fs.existsSync(this.swiftDir)) {
      throw new Error(`SWIFT CRM directory not found: ${this.swiftDir}`);
    }

    // Parse Excel
    this.testData = this.parseExcelData(this.excelFilePath);
    this.planData = this.parsePlanData(this.excelFilePath);
    this.matchedRows = this.resolveMatchedRows();

    // Enrich with plan data
    const planMap = new Map();
    this.planData.forEach(p => {
      planMap.set(String(p.newMRP), {
        benefit: p.benefit,
        rechargeNotification: p.rechargeNotification,
        circle: p.circle,
        mode: p.mode,
        cat: p.cat
      });
    });

    this.matchedRows = this.matchedRows.map(row => {
      const plan = planMap.get(String(row.rechargeMRP));
      return {
        ...row,
        planBenefit: plan?.benefit || 'N/A',
        rechargeNotification: plan?.rechargeNotification || 'N/A'
      };
    });

    this.log(
      `Resolved ${this.matchedRows.length} row(s) to execute ` +
      `(IN-Yes: ${this.matchedRows.filter(r => r.inFlag?.toLowerCase() === 'yes').length}, ` +
      `SWIFT-Yes: ${this.matchedRows.filter(r => r.swift?.toLowerCase() === 'yes').length})`,
      "success"
    );
    this.progress(10, "Excel Loaded", "Validating");
    return true;
  }

  parseExcelData(filePath) {
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets["Input excel"];
    if (!sheet) throw new Error('Sheet "Input excel" not found in workbook');
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const normalised = rows.map((r, i) => ({
      _rawIndex: i,
      msisdn: String(r["MSISDN"] ?? "").trim(),
      circle: String(r["CIRCLE"] ?? "").trim(),
      rechargeMRP: String(r["Recharge MRP"] ?? "").trim(),
      recharge: String(r["Recharge"] ?? "").trim(),
      swift: String(r["SWIFT"] ?? "").trim(),
      inFlag: String(r["IN"] ?? "").trim(),
      viApp: String(r["Vi App"] ?? "").trim(),
    }));

    return { allRows: rows, normalisedRows: normalised };
  }

  parsePlanData(filePath) {
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets["Recharge Plans"];
    if (!sheet) return [];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    return rows.map(r => ({
      srNo: Number(r["Sr. No."] || 0),
      newMRP: String(r["New MRP"] || "").trim(),
      circle: String(r["Circle"] || "").trim(),
      mode: String(r["Mode"] || "").trim(),
      cat: String(r["CAT"] || "").trim(),
      benefit: String(r["Benefit (Open)"] || "").trim(),
      rechargeNotification: String(r["Recharge Notification"] || "").trim(),
    }));
  }

  resolveMatchedRows() {
    const byMsisdn = new Map(
      this.testData.normalisedRows.map((r) => [r.msisdn, r])
    );

    if (
      Array.isArray(this.matchedRowsFromFrontend) &&
      this.matchedRowsFromFrontend.length > 0
    ) {
      return this.matchedRowsFromFrontend.map((r, idx) => {
        const msisdn = String(r.msisdn || "").trim();
        const excelRow = byMsisdn.get(msisdn) || {};
        return {
          rowIndex: r.rowIndex !== undefined ? r.rowIndex : idx,
          srNo: idx + 1,
          msisdn,
          circle: r.circle || excelRow.circle || "",
          rechargeMRP: String(r.rechargeMRP ?? excelRow.rechargeMRP ?? "").trim(),
          recharge: String(r.recharge ?? excelRow.recharge ?? "").trim(),
          inFlag: String(r.inFlag ?? excelRow.inFlag ?? "").trim(),
          swift: String(r.swift ?? excelRow.swift ?? "").trim(),
          viApp: String(r.viApp ?? excelRow.viApp ?? "").trim(),
        };
      });
    }

    // Fallback: filter on SWIFT=Yes or IN=Yes
    this.log(
      "⚠️ No frontend-validated matched rows — falling back to Excel filtering.",
      "warning"
    );

    return this.testData.normalisedRows
      .filter((r) => r.swift.toLowerCase() === "yes" || r.inFlag.toLowerCase() === "yes")
      .map((r, idx) => ({
        rowIndex: idx,
        srNo: idx + 1,
        msisdn: r.msisdn,
        circle: r.circle,
        rechargeMRP: r.rechargeMRP,
        recharge: r.recharge,
        inFlag: r.inFlag,
        swift: r.swift,
        viApp: r.viApp,
      }));
  }

  // In swiftCrmOrchestrator.js, add a method to check for recharge confirmation

async waitForRechargeConfirmation(msisdn, timeoutMs = 300000) {
  console.log(`[Orchestrator] ⏳ Waiting for recharge confirmation for ${msisdn}...`);
  
  const confirmFile = path.join(this.commDir, 'recharge_confirmed.json');
  const skipFile = path.join(this.commDir, 'recharge_skipped.json');
  
  // Clean up old files
  if (fs.existsSync(confirmFile)) fs.unlinkSync(confirmFile);
  if (fs.existsSync(skipFile)) fs.unlinkSync(skipFile);
  
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    // Check for confirmation
    if (fs.existsSync(confirmFile)) {
      try {
        const raw = fs.readFileSync(confirmFile, 'utf8');
        const data = JSON.parse(raw);
        if (data.msisdn === msisdn && data.confirmed === true) {
          console.log(`[Orchestrator] ✅ Recharge confirmed for ${msisdn}`);
          fs.unlinkSync(confirmFile);
          return { confirmed: true, skipped: false };
        }
      } catch (parseErr) {
        // File may be mid-write
      }
    }
    
    // Check for skip
    if (fs.existsSync(skipFile)) {
      try {
        const raw = fs.readFileSync(skipFile, 'utf8');
        const data = JSON.parse(raw);
        if (data.msisdn === msisdn && data.skipped === true) {
          console.log(`[Orchestrator] ⏭ Recharge skipped for ${msisdn}: ${data.reason || 'User skipped'}`);
          fs.unlinkSync(skipFile);
          return { confirmed: false, skipped: true };
        }
      } catch (parseErr) {
        // File may be mid-write
      }
    }
    
    await this.sleep(1000);
  }
  
  console.warn(`[Orchestrator] ⚠️ Timeout waiting for recharge confirmation for ${msisdn}`);
  return { confirmed: false, skipped: false };
}

sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

  // ══════════════════════════════════════════════════════════════════════
  // SESSION STATE MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════

  markLoggedIn() {
    browserSession.isLoggedIn = true;
    browserSession.lastLoginAt = Date.now();
    browserSession.lastActivityAt = Date.now();
    this.broadcastLoginStatus("logged_in");
  }

  markLoggedOut(reason = "") {
    browserSession.isLoggedIn = false;
    this.broadcastLoginStatus("logged_out", reason);
  }

  startLoginStatusPolling() {
    const eventFile = path.join(this.commDir, "session_event.json");
    this._loginStatusInterval = setInterval(() => {
      try {
        if (!fs.existsSync(eventFile)) return;
        const ev = JSON.parse(fs.readFileSync(eventFile, "utf8"));
        if (ev._handled) return;
        ev._handled = true;
        fs.writeFileSync(eventFile, JSON.stringify(ev, null, 2));
        if (ev.event === "login_success") {
          this.markLoggedIn();
        } else if (ev.event === "logout_detected") {
          this.markLoggedOut("auto-logout detected — re-login scheduled");
        }
      } catch (_) {}
    }, 500);
  }

  stopLoginStatusPolling() {
    if (this._loginStatusInterval) {
      clearInterval(this._loginStatusInterval);
      this._loginStatusInterval = null;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // MAIN RUNNER
  // ══════════════════════════════════════════════════════════════════════

  async runRechargeUAT() {
    try {
      await this.initialize();

      if (this.matchedRows.length === 0) {
        this.log("No matched rows to execute", "warning");
        this.broadcast({
          type: "complete",
          success: false,
          message: "No matched test data to run",
        });
        return;
      }

      this.log(
        `${this.matchedRows.length} matched row(s) will be executed in a single browser session`,
        "info"
      );

      // Broadcast the row plan
      this.broadcastRowPlan(this.matchedRows);
      this.rowStatuses = this.matchedRows.map((r) => ({
        rowIndex: r.rowIndex,
        msisdn: r.msisdn,
        rechargeMRP: r.rechargeMRP,
        recharge: r.recharge,
        inFlag: r.inFlag,
        swift: r.swift,
        status: "pending",
        offerData: [],
      }));

      // Comm + working dirs
      fs.mkdirSync(this.commDir, { recursive: true });
      ["screenshots", "reports"].forEach((d) => {
        const p = path.join(this.swiftDir, d);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      });

      // Write the matched rows for WDIO
      fs.writeFileSync(
        this.matchedRowsFile,
        JSON.stringify(this.matchedRows, null, 2)
      );
      this.log(
        `Wrote ${this.matchedRows.length} matched row(s) to matched_rows.json for WDIO`,
        "info"
      );

      // Start polling for CAPTCHA/OTP
      this.startPolling();
      this.startLoginStatusPolling();

      // Notify frontend about login status
      this.broadcastLoginStatus(
        "not_logged_in",
        "Please login manually via the SWIFT CRM page"
      );

      this.progress(
        15,
        "Launching browser",
        `Running ${this.matchedRows.length} row(s)`
      );

      // ── ONE WDIO launch for the entire batch ──────────────────────────
      await this.runBatch();

      this.stopPolling();
      this.stopLoginStatusPolling();

      this.progress(95, "Generating Report", "Finalizing…");
      await this.generateFinalReport();
      this.progress(100, "Complete", "Done");

      this.broadcast({
        type: "complete",
        success: true,
        message: "UAT completed successfully",
        reportPath: this.reportPath,
        screenshots: this.screenshots,
      });
    } catch (error) {
      this.stopPolling();
      this.stopLoginStatusPolling();
      this.log(`UAT failed: ${error.message}`, "error");
      this.broadcast({
        type: "complete",
        success: false,
        message: error.message,
      });
      throw error;
    }
  }

  runBatch() {
    return new Promise((resolve, reject) => {
      const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

      const env = {
        ...process.env,
        ...(this.viAppOtp ? { VI_APP_OTP: this.viAppOtp } : {}),
        SWIFT_MANUAL_LOGIN: "true",
      };

      this.log(
        `Launching WDIO once for ${this.matchedRows.length} row(s) (manual login mode)…`,
        "info"
      );

      const child = exec(`${npmCmd} run test:recharge`, {
        cwd: this.swiftDir,
        env,
        maxBuffer: 1024 * 1024 * 50,
      });
      this.currentWdioProcess = child;

      child.stdout.on("data", (d) => this.processOutput(d.toString()));
      child.stderr.on("data", (d) => this.processOutput(d.toString(), true));

      child.on("close", (code) => {
        this.currentWdioProcess = null;
        this.collectScreenshots();
        this.log(
          `WDIO batch exited (code ${code})`,
          code <= 1 ? "info" : "warning"
        );

        if (code === 0 || code === 1) {
          resolve();
        } else {
          reject(new Error(`WDIO exited with unexpected code ${code}`));
        }
      });

      child.on("error", (err) => {
        this.currentWdioProcess = null;
        reject(err);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // CAPTCHA / OTP POLLING
  // ══════════════════════════════════════════════════════════════════════

  startPolling() {
    this.cleanupCommFiles();
    this.log("Starting CAPTCHA / OTP polling…", "info");
    this.lastCaptchaTimestamp = null;
    this.captchaModalShown = false;
    this.lastOtpTimestamp = null;
    this.otpModalShown = false;
    this.captchaPollingInterval = setInterval(
      () => this.checkForCaptchaRequest(),
      500
    );
    this.otpPollingInterval = setInterval(() => this.checkForOtpRequest(), 500);
  }

  stopPolling() {
    if (this.captchaPollingInterval) {
      clearInterval(this.captchaPollingInterval);
      this.captchaPollingInterval = null;
    }
    if (this.otpPollingInterval) {
      clearInterval(this.otpPollingInterval);
      this.otpPollingInterval = null;
    }
    this.cleanupCommFiles();
    this.lastCaptchaTimestamp = null;
    this.captchaModalShown = false;
    this.lastOtpTimestamp = null;
    this.otpModalShown = false;
  }

  cleanupCommFiles() {
    [
      this.captchaRequestFile,
      this.captchaResponseFile,
      this.otpRequestFile,
      this.otpResponseFile,
    ].forEach((f) => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) {}
    });
  }

  checkForCaptchaRequest() {
    try {
      if (this.captchaModalShown || !fs.existsSync(this.captchaRequestFile))
        return;
      const req = JSON.parse(fs.readFileSync(this.captchaRequestFile, "utf8"));
      if (req.timestamp === this.lastCaptchaTimestamp) return;
      this.lastCaptchaTimestamp = req.timestamp;
      this.captchaModalShown = true;

      this.log(`📸 CAPTCHA ready: ${req.filename}`, "info");
      this.broadcast({
        type: "captcha",
        action: "show",
        imageUrl: `http://localhost:5174${req.imageUrl}`,
        timestamp: req.timestamp,
        requiresCredentials: req.requiresCredentials || false,
      });
    } catch (_) {}
  }

  checkForOtpRequest() {
    try {
      if (this.otpModalShown || !fs.existsSync(this.otpRequestFile)) return;
      const req = JSON.parse(fs.readFileSync(this.otpRequestFile, "utf8"));
      if (req.timestamp === this.lastOtpTimestamp) return;
      this.lastOtpTimestamp = req.timestamp;
      this.otpModalShown = true;
      this.log("OTP request — showing modal…", "info");
      this.broadcast({
        type: "otp",
        action: "show",
        message: req.message,
        timestamp: req.timestamp,
      });
    } catch (_) {}
  }

  async setOtp(otp) {
    try {
      fs.mkdirSync(this.commDir, { recursive: true });
      fs.writeFileSync(
        this.otpResponseFile,
        JSON.stringify({ timestamp: Date.now(), otp }, null, 2)
      );
      this.log(`OTP saved: ${otp}`, "success");
      this.otpModalShown = false;
    } catch (e) {
      this.log(`Failed to save OTP: ${e.message}`, "error");
    }
  }

  async setCaptchaAnswer(answer) {
    try {
      fs.mkdirSync(this.commDir, { recursive: true });
      const data = { timestamp: Date.now(), answer };
      if (this._pendingLoginCredentials) {
        data.username = this._pendingLoginCredentials.username;
        data.password = this._pendingLoginCredentials.password;
        this._pendingLoginCredentials = null;
      }
      fs.writeFileSync(this.captchaResponseFile, JSON.stringify(data, null, 2));
      this.log(`CAPTCHA saved: ${answer}`, "success");
      this.captchaModalShown = false;
    } catch (e) {
      this.log(`Failed to save CAPTCHA: ${e.message}`, "error");
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // STDOUT PROCESSING
  // ══════════════════════════════════════════════════════════════════════

  processOutput(output, isError = false) {
    output.split('\n').filter(l => l.trim()).forEach(line => {
      const t = isError ? 'error' : 'info';

      // Structured per-row events from the spec
      const rowEventMatch = line.match(/\[ROW_EVENT\]\s+(\{.*\})/);
      if (rowEventMatch) {
        try {
          const ev = JSON.parse(rowEventMatch[1]);
          this.handleRowEvent(ev);
          if (ev.event === 'row_data') {
            this.log(` Received row_data event for ${ev.msisdn}: MRP ${ev.mrp}`, 'success');
          }
        } catch (_) {
          this.log(line, t);
        }
        return;
      }

      // Agent tab navigation
      if (line.includes("navigate_tab") || line.includes("Agent tab clicked")) {
        this.log("🔄 Navigating to next row via agent tab...", "info");
      }

      // IN and SWIFT test status
      if (line.includes("IN test completed")) {
        if (line.includes("PASS")) {
          this.log("✅ IN test passed", "success");
        } else if (line.includes("FAIL")) {
          this.log("❌ IN test failed", "error");
        }
      }
      if (line.includes("SWIFT test completed")) {
        if (line.includes("PASS")) {
          this.log("✅ SWIFT test passed", "success");
        } else if (line.includes("FAIL")) {
          this.log("❌ SWIFT test failed", "error");
        }
      }

      if (line.includes("✓") || line.includes("PASS") || line.includes("success")) {
        this.log(line, "success");
      } else if (line.includes("✗") || line.includes("FAIL") || line.includes("Error")) {
        this.log(line, "error");
      } else if (line.trim()) {
        this.log(line, t);
      }

      // Login events
      if (line.includes("Manual login detected") || line.includes("profile tab visible")) {
        this.markLoggedIn();
        try {
          fs.mkdirSync(this.commDir, { recursive: true });
          fs.writeFileSync(
            this.loginStateFile,
            JSON.stringify({ isLoggedIn: true, timestamp: Date.now() }, null, 2)
          );
        } catch (_) {}
      }
    });
  }

  handleRowEvent(ev) {
    const { event, rowIndex, msisdn, error } = ev;
    switch (event) {
      case "row_start":
        this.broadcastRowStatus(rowIndex, "running", { msisdn });
        this.log(`▶ Row started: ${msisdn}`, "info");
        break;

      case "row_data":
        const existing = this.rowStatuses.find((r) => r.rowIndex === rowIndex);
        if (existing) {
          if (!existing.offerData) existing.offerData = [];
          existing.offerData.push({
            transactionId: ev.transactionId,
            activationDateTime: ev.activationDateTime,
            validity: ev.validity,
            mrp: ev.mrp,
            activationMode: ev.activationMode,
            currentCoreBalance: ev.currentCoreBalance,
            etopupTransactionId: ev.etopupTransactionId,
            retailerMsisdn: ev.retailerMsisdn,
            name: ev.name,
            category: ev.category,
            benefits: ev.benefits,
            detailValidity: ev.detailValidity,
          });
          this.log(`📊 Scraped offer data for ${msisdn}: MRP ${ev.mrp}`, "info");
        }
        break;

      case "row_waiting_confirm":
        this.broadcastRowStatus(rowIndex, "waiting_recharge_confirm", {
          msisdn,
          message: "Waiting for recharge confirmation from Smart Connect Application…",
        });
        break;

      case "row_navigate_tab":
        this.log(`🔄 Navigating to agent tab for row: ${msisdn}`, "info");
        break;

      case "row_completed":
        this.broadcastRowStatus(rowIndex, "completed", { msisdn });
        this.log(`✅ Row completed: ${msisdn}`, "success");
        break;

      case "row_failed":
        this.broadcastRowStatus(rowIndex, "failed", { msisdn, error });
        this.log(`❌ Row failed: ${msisdn} — ${error || "unknown error"}`, "error");
        break;

      default:
        break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREENSHOTS + REPORTS
  // ══════════════════════════════════════════════════════════════════════

  collectScreenshots() {
    try {
      const dir = path.join(this.swiftDir, "screenshots");
      if (!fs.existsSync(dir)) return;
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".png"))
        .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
        .sort((a, b) => b.mtime - a.mtime);
      this.screenshots = files.map((f) => ({
        name: f.name,
        url: `/screenshots/${f.name}`,
      }));
      this.log(`Collected ${this.screenshots.length} screenshot(s)`, "success");
      this.broadcast({ type: "screenshots", screenshots: this.screenshots });
    } catch (e) {
      this.log(`Screenshot collect failed: ${e.message}`, "warning");
    }
  }

  async generateFinalReport() {
    try {
      const reportsDir = path.join(this.swiftDir, "reports");
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const reportPath = path.join(
        reportsDir,
        `UAT_Recharge_Report_${timestamp}.xlsx`
      );

      // Get input rows
      const inputRows = (this.testData.allRows || []).map((row) => ({
        MSISDN: String(row["MSISDN"] || row.msisdn || "").trim(),
        CIRCLE: String(row["CIRCLE"] || row.circle || "").trim(),
        "Recharge MRP": String(row["Recharge MRP"] || row.rechargeMRP || "").trim(),
        Recharge: String(row["Recharge"] || row.recharge || "").trim(),
        SWIFT: String(row["SWIFT"] || row.swift || "").trim(),
        IN: String(row["IN"] || row.inFlag || "").trim(),
        "Vi App": String(row["Vi App"] || row.viApp || "").trim(),
      }));

      // Get plan data
      const planMap = new Map();
      this.planData.forEach(p => {
        planMap.set(String(p.newMRP), {
          benefit: p.benefit,
          rechargeNotification: p.rechargeNotification,
        });
      });

      // Get UAT results
      const uatResults = [];
      this.rowStatuses.forEach((r) => {
        const plan = planMap.get(String(r.rechargeMRP));
        if (r.offerData && r.offerData.length > 0) {
          r.offerData.forEach((offer, idx) => {
            uatResults.push({
              "Sr. No.": uatResults.length + 1,
              "Transaction Id": offer.transactionId || `TXN-${Date.now()}-${idx}`,
              "Activation Date & Time": offer.activationDateTime || new Date().toLocaleString(),
              "Validity": offer.validity || "30 days",
              "MRP": offer.mrp || r.rechargeMRP || "N/A",
              "Activation Mode": offer.activationMode || "eTOPUP",
              "Current Core Balance": offer.currentCoreBalance || "0.00",
              "eTOP UP Transaction Id": offer.etopupTransactionId || `ET-${Date.now()}-${idx}`,
              "Retailer MSISDN": offer.retailerMsisdn || r.msisdn || "",
              "Name": offer.name || "",
              "Category": offer.category || "Recharge",
              "Benefits": offer.benefits || plan?.benefit || "N/A",
              "Detail Validity": offer.detailValidity || "30 days from activation",
              "MSISDN": r.msisdn,
              "Circle": r.circle || "N/A",
              "Plan Name": plan?.benefit || "N/A",
              "Recharge Notification": plan?.rechargeNotification || "N/A",
              "IN Status": r.inFlag?.toLowerCase() === 'yes' ? 'Pass' : 'Skip',
              "SWIFT Status": r.swift?.toLowerCase() === 'yes' ? 'Pass' : 'Skip',
              "Vi App Status": r.viApp?.toLowerCase() === 'yes' ? 'Pass' : 'Skip',
              "Screenshots": this.screenshots.filter(s => s.name.includes(r.msisdn)).length
            });
          });
        }
      });

      // Create workbook
      const wb = xlsx.utils.book_new();
      
      // Sheet 1: Input Data
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(inputRows), "Input Data");
      
      // Sheet 2: UAT Results
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(uatResults), "UAT Results");
      
      // Sheet 3: Screenshots
      const screenshotData = this.screenshots.map((s, i) => ({
        "Sr. No.": i + 1,
        "File": s.name,
        "URL": s.url,
      }));
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(screenshotData), "Screenshots");
      
      // Sheet 4: Summary
      const summaryData = [{
        "Total Excel Rows": inputRows.length,
        "Matched & Executed Rows": this.matchedRows.length,
        "Screenshots": this.screenshots.length,
        "Generated": new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      }];
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(summaryData), "Summary");

      xlsx.writeFile(wb, reportPath);
      this.reportPath = reportPath;
      SwiftCrmOrchestrator.setLatestReportPath(reportPath);
      
      this.log(`Final report → ${path.basename(reportPath)}`, "success");
      this.log(`  - ${inputRows.length} input rows`, "info");
      this.log(`  - ${uatResults.length} UAT results`, "info");
      this.log(`  - ${this.screenshots.length} screenshots`, "info");

      // Also generate HTML report
      try {
        const htmlPath = reportPath.replace('.xlsx', '.html');
        const htmlContent = this.generateHTMLReport(inputRows, uatResults, this.screenshots);
        fs.writeFileSync(htmlPath, htmlContent, 'utf8');
        this.log(`HTML report → ${path.basename(htmlPath)}`, "success");
      } catch (htmlErr) {
        this.log(`HTML report generation failed: ${htmlErr.message}`, "warning");
      }

      return reportPath;
    } catch (e) {
      this.log(`Final report generation failed: ${e.message}`, "error");
      throw e;
    }
  }

  generateHTMLReport(inputRows, uatResults, screenshots) {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>UAT Recharge Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #f38328; border-bottom: 3px solid #f38328; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { color: #333; margin: 20px 0 10px 0; padding: 8px 0; border-bottom: 2px solid #eee; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; font-size: 13px; }
    th { background: #f38328; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #f9f9f9; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-pass { background: #e8f5e9; color: #2e7d32; }
    .badge-fail { background: #fdecea; color: #c0392b; }
    .badge-skip { background: #f5f5f5; color: #888; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0 25px 0; }
    .summary-item { background: #f8f5f0; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #f38328; }
    .summary-item .number { font-size: 28px; font-weight: 700; color: #f38328; }
    .summary-item .label { font-size: 12px; color: #888; margin-top: 4px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
<div class="container">
  <h1>📊 UAT Recharge Automation Report</h1>
  <p style="color: #888; margin-bottom: 20px;">Generated: ${timestamp}</p>

  <div class="summary-grid">
    <div class="summary-item"><div class="number">${inputRows.length}</div><div class="label">Total Test Cases</div></div>
    <div class="summary-item"><div class="number">${uatResults.length}</div><div class="label">Executed</div></div>
    <div class="summary-item"><div class="number">${uatResults.filter(r => r["IN Status"] === 'Pass' || r["SWIFT Status"] === 'Pass').length}</div><div class="label">Passed</div></div>
    <div class="summary-item"><div class="number">${screenshots.length}</div><div class="label">Screenshots</div></div>
  </div>

  <h2>📱 UAT Execution Results</h2>
  <table>
    <thead><tr><th>#</th><th>MSISDN</th><th>MRP</th><th>Plan Name</th><th>IN Status</th><th>SWIFT Status</th><th>Vi App</th></tr></thead>
    <tbody>`;

    uatResults.forEach((r, idx) => {
      const inStatus = r["IN Status"] || 'Skip';
      const swiftStatus = r["SWIFT Status"] || 'Skip';
      const inBadge = inStatus === 'Pass' ? 'badge-pass' : (inStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      const swiftBadge = swiftStatus === 'Pass' ? 'badge-pass' : (swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${r["MSISDN"] || r.msisdn}</strong></td>
          <td>₹${r["MRP"] || r.mrp}</td>
          <td>${r["Plan Name"] || r.planName || 'N/A'}</td>
          <td><span class="badge ${inBadge}">${inStatus}</span></td>
          <td><span class="badge ${swiftBadge}">${swiftStatus}</span></td>
          <td>${r["Vi App Status"] || 'Skip'}</td>
        </tr>
      `;
    });

    html += `
    </tbody>
  </table>

  <div class="footer">
    <p>Report generated by VI Sim Automation Platform</p>
    <p>© 2026 QDegrees Services Pvt. Ltd.</p>
  </div>
</div>
</body>
</html>`;

    return html;
  }

  // ══════════════════════════════════════════════════════════════════════
  // STATIC ROUTE REGISTRATION
  // ══════════════════════════════════════════════════════════════════════

  static registerRoutes(app) {
    const express = require("express");
    const commDir = path.join(__dirname, "..", "swift-crm-automation", "comm");
    const captchaDir = path.join(
      __dirname,
      "..",
      "swift-crm-automation",
      "captcha_screenshots"
    );

    if (!fs.existsSync(captchaDir))
      fs.mkdirSync(captchaDir, { recursive: true });
    app.use("/captcha-images", express.static(captchaDir));

    app.post("/api/swift/session-event", (req, res) => {
      try {
        const { event } = req.body;
        fs.mkdirSync(commDir, { recursive: true });
        fs.writeFileSync(
          path.join(commDir, "session_event.json"),
          JSON.stringify({ event, timestamp: Date.now() }, null, 2)
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    app.get("/api/swift/login-status", (_req, res) => {
      res.json({
        isLoggedIn: browserSession.isLoggedIn,
        lastLoginAt: browserSession.lastLoginAt,
        lastActivityAt: browserSession.lastActivityAt,
      });
    });

    app.post("/api/swift/recharge-confirmed", (req, res) => {
      try {
        const { msisdn, txnId } = req.body;
        fs.mkdirSync(commDir, { recursive: true });
        fs.writeFileSync(
          path.join(commDir, "recharge_confirmed.json"),
          JSON.stringify(
            { msisdn, txnId, confirmed: true, timestamp: Date.now() },
            null,
            2
          )
        );
        console.log(`[SWIFT] Recharge confirmed for MSISDN ${msisdn}`);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    app.post("/api/swift/manual-login", (req, res) => {
      try {
        const { loggedIn } = req.body;
        fs.mkdirSync(commDir, { recursive: true });
        fs.writeFileSync(
          path.join(commDir, "login_state.json"),
          JSON.stringify(
            { isLoggedIn: loggedIn, timestamp: Date.now() },
            null,
            2
          )
        );
        if (loggedIn) {
          browserSession.isLoggedIn = true;
          browserSession.lastLoginAt = Date.now();
        }
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });
  }
}

module.exports = { SwiftCrmOrchestrator };