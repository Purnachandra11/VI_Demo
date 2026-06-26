const { exec } = require('child_process');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

class SwiftCrmOrchestrator {
  constructor(excelFilePath, wsClients, uploadDir, viAppOtp = null) {
    this.excelFilePath = excelFilePath;
    this.wsClients = wsClients;
    this.uploadDir = uploadDir;
    this.swiftDir = path.join(__dirname, '..', 'swift-crm-automation');
    // Express must serve this dir as /captcha-images/
    // app.use('/captcha-images', express.static(orchestrator.captchaScreenshotsDir));
    this.captchaScreenshotsDir = path.join(this.swiftDir, 'captcha_screenshots');
    this.captchaAnswer = null;
    this.testData = null;
    this.screenshots = [];
    this.reportPath = null;
    this.currentWdioProcess = null;
    this.captchaPollingInterval = null;
    this.otpPollingInterval = null;
    this.commDir = path.join(this.swiftDir, 'comm');
    this.captchaRequestFile = path.join(this.commDir, 'captcha_request.json');
    this.captchaResponseFile = path.join(this.commDir, 'captcha_response.json');
    this.otpRequestFile = path.join(this.commDir, 'otp_request.json');
    this.otpResponseFile = path.join(this.commDir, 'otp_response.json');
    this.lastOtpTimestamp = null;
    this.otpModalShown = false;
    this.lastCaptchaTimestamp = null;
    this.captchaModalShown = false;
    this.viAppOtp = viAppOtp;
    this.connectedDevices = [];
  }

  // ─── Device Detection Helper ───────────────────────────────────────────
  getConnectedDevices() {
    try {
      const output = execSync('adb devices', { encoding: 'utf8' });
      const lines = output.split('\n').filter(line => line.trim() !== '');
      const deviceLines = lines.slice(1);
      const devices = deviceLines
        .filter(line => line.includes('\tdevice'))
        .map(line => line.split('\t')[0].trim())
        .filter(serial => serial !== '');
      
      return devices;
    } catch (error) {
      console.error(`[Orchestrator] Failed to get connected devices: ${error.message}`);
      return [];
    }
  }

  // ─── Build Device-to-MSISDN Mapping ────────────────────────────────────
  buildDeviceMapping() {
    const mapping = {};
    
    // Scan test data to find MSISDN entries with Device column
    if (this.testData && this.testData.viAppRows) {
      this.testData.viAppRows.forEach((row, index) => {
        const msisdn = row['MSISDN'] || row['msisdn'] || row['Mobile'];
        const device = row['Device'] || row['device'] || row['DEVICE'];
        
        if (msisdn && device) {
          mapping[msisdn.toString().trim()] = device.toString().trim();
        }
      });
    }
    
    return mapping;
  }

  // ─── Reorder Vi App tests: connected device first, then others ─────────
  prioritizeViAppTestsByDevice() {
    const deviceMapping = this.buildDeviceMapping();
    const connectedSet = new Set(this.connectedDevices);
    
    // Separate connected and disconnected
    const connectedTests = [];
    const disconnectedTests = [];
    
    this.testData.viAppRows.forEach(row => {
      const msisdn = row['MSISDN'] || row['msisdn'] || row['Mobile'];
      const device = deviceMapping[msisdn?.toString().trim()];
      
      if (device && connectedSet.has(device)) {
        connectedTests.push({ row, device, msisdn });
        this.log(`✅ MSISDN ${msisdn} has connected device ${device}`, 'info');
      } else if (device) {
        disconnectedTests.push({ row, device, msisdn });
        this.log(`⚠️  MSISDN ${msisdn} device ${device} NOT connected — will run later`, 'warning');
      } else {
        // No device mapping, will run with default/first device
        connectedTests.push({ row, device: null, msisdn });
      }
    });
    
    // Update order: connected first, then disconnected
    this.testData.viAppRows = [
      ...connectedTests.map(t => t.row),
      ...disconnectedTests.map(t => t.row)
    ];
  }

  // Static method to set latest report path globally
  static setLatestReportPath(filePath) {
    if (global.setSwiftLatestReport) {
      global.setSwiftLatestReport(filePath);
    }
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    this.wsClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  log(message, logType = 'info') {
    this.broadcast({
      type: 'log',
      message,
      logType,
      timestamp: new Date().toISOString()
    });
  }

  progress(percentage, action, status = null) {
    this.broadcast({
      type: 'progress',
      progress: { percentage, action, status }
    });
  }

  async initialize() {
    try {
      this.log('Initializing UAT Automation...', 'info');
      this.progress(5, 'Initializing', 'Reading Excel');

      // Validate directories
      if (!fs.existsSync(this.swiftDir)) {
        throw new Error(`SWIFT CRM directory not found: ${this.swiftDir}`);
      }

      // Parse Excel test data
      this.testData = this.parseExcelData(this.excelFilePath);
      const totalTestRows = this.testData.swiftRows.length + this.testData.viAppRows.length;
      this.log(`Loaded ${totalTestRows} test rows from Excel (${this.testData.swiftRows.length} SWIFT, ${this.testData.viAppRows.length} Vi App)`, 'success');
      this.progress(10, 'Excel Loaded', 'Validating');

      return true;
    } catch (error) {
      this.log(`Initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  parseExcelData(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['Input excel'];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    
    const swiftRows = rows.filter(row => 
      row['SWIFT'] && row['SWIFT'].toString().toLowerCase() === 'yes'
    );
    const viAppRows = rows.filter(row => 
      row['Vi App'] && row['Vi App'].toString().toLowerCase() === 'yes'
    );

    return {
      allRows: rows,
      swiftRows: swiftRows,
      viAppRows: viAppRows
    };
  }

  async setCaptchaAnswer(answer) {
    try {
      this.log(`CAPTCHA answer received: ${answer}`, 'info');
      
      // Make sure comm dir exists
      if (!fs.existsSync(this.commDir)) {
        fs.mkdirSync(this.commDir, { recursive: true });
      }

      // Write response file
      const responseData = {
        timestamp: Date.now(),
        answer: answer
      };
      fs.writeFileSync(this.captchaResponseFile, JSON.stringify(responseData, null, 2));
      
      this.log('CAPTCHA answer saved to response file', 'success');
    } catch (error) {
      this.log(`Failed to save CAPTCHA answer: ${error.message}`, 'error');
    }
  }

  async runRechargeUAT() {
    try {
      await this.initialize();

      // Check if we have any test rows at all
      const hasSwiftTests = this.testData.swiftRows.length > 0;
      let hasViAppTests = this.testData.viAppRows.length > 0;

      // ─── Point 1: Skip Vi App if no devices connected ───────────────────
      if (hasViAppTests) {
        this.connectedDevices = this.getConnectedDevices();
        this.log(`Connected devices: ${this.connectedDevices.length > 0 ? this.connectedDevices.join(', ') : 'NONE'}`, 'info');
        
        if (this.connectedDevices.length === 0) {
          this.log('⚠️  No devices connected — skipping Vi App tests', 'warning');
          hasViAppTests = false;
          this.testData.viAppRows = [];
        } else {
          // ─── Point 2: Prioritize tests by device connectivity ───────────
          this.prioritizeViAppTestsByDevice();
          this.log(`Reordered ${this.testData.viAppRows.length} Vi App tests (connected devices first)`, 'info');
        }
      }

      if (!hasSwiftTests && !hasViAppTests) {
        this.log('No rows with SWIFT=Yes or Vi App=Yes found in Excel, or no devices connected', 'warning');
        this.broadcast({
          type: 'complete',
          success: false,
          message: 'No test data found or no devices connected'
        });
        return;
      }

      this.log(`Found ${this.testData.swiftRows.length} SWIFT test(s) and ${this.testData.viAppRows.length} Vi App test(s)`, 'info');
      this.progress(15, 'Starting', 'Running');

      // Copy uploaded Excel to data directory for both tests
      const dataDir = path.join(this.swiftDir, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const targetExcelPath = path.join(dataDir, 'Input_data.xlsx');
      fs.copyFileSync(this.excelFilePath, targetExcelPath);
      this.log('Test data copied to automation directory', 'info');

      // Create screenshots and reports directories
      const screenshotsDir = path.join(this.swiftDir, 'screenshots');
      const reportsDir = path.join(this.swiftDir, 'reports');
      [screenshotsDir, reportsDir].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      });

      // Start polling for both CAPTCHA and OTP
      this.startPolling();

      // If we have SWIFT tests, run them first
      if (hasSwiftTests) {
        this.log('Starting SWIFT CRM Recharge UAT...', 'info');
        this.progress(20, 'Running SWIFT Tests', 'Test 1');
        await this.runWdioTestWithExec(); // This runs test:recharge which also includes Vi App
      } else if (hasViAppTests) {
        // If only Vi App tests, run test:viapp
        this.log('Starting Vi App Recharge UAT (only)...', 'info');
        this.progress(20, 'Running Vi App Tests', 'Test 1');
        await this.runViAppTestWithExec();
      }

      // Stop polling
      this.stopPolling();

      // Generate final report
      this.progress(90, 'Generating Report', 'Finalizing');
      await this.generateFinalReport();

      this.progress(100, 'Complete', 'Done');
      
      this.broadcast({
        type: 'complete',
        success: true,
        message: 'UAT completed successfully',
        reportPath: this.reportPath,
        screenshots: this.screenshots
      });

      return true;
    } catch (error) {
      this.stopPolling();
      this.log(`UAT failed: ${error.message}`, 'error');
      this.broadcast({
        type: 'complete',
        success: false,
        message: error.message
      });
      throw error;
    }
  }

  startPolling() {
    // Clean up any old comm files first
    this.cleanupCommFiles();
    
    this.log('Starting polling for CAPTCHA and OTP requests...', 'info');
    this.lastCaptchaTimestamp = null; // Track to avoid duplicates
    this.captchaModalShown = false;
    this.lastOtpTimestamp = null;
    this.otpModalShown = false;
    
    this.captchaPollingInterval = setInterval(() => {
      this.checkForCaptchaRequest();
    }, 500); // Check every 0.5 seconds
    
    this.otpPollingInterval = setInterval(() => {
      this.checkForOtpRequest();
    }, 500); // Check every 0.5 seconds
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
    try {
      if (fs.existsSync(this.captchaRequestFile)) {
        fs.unlinkSync(this.captchaRequestFile);
      }
      if (fs.existsSync(this.captchaResponseFile)) {
        fs.unlinkSync(this.captchaResponseFile);
      }
      if (fs.existsSync(this.otpRequestFile)) {
        fs.unlinkSync(this.otpRequestFile);
      }
      if (fs.existsSync(this.otpResponseFile)) {
        fs.unlinkSync(this.otpResponseFile);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  checkForCaptchaRequest() {
    try {
      if (this.captchaModalShown) return;

      if (!fs.existsSync(this.captchaRequestFile)) return;

      const request = JSON.parse(fs.readFileSync(this.captchaRequestFile, 'utf8'));

      // Skip duplicate — same timestamp we already sent
      if (request.timestamp === this.lastCaptchaTimestamp) return;

      this.lastCaptchaTimestamp = request.timestamp;
      this.captchaModalShown    = true;

      // request.imageUrl  = "/captcha-images/captcha_<timestamp>.png"
       request.filename  = "captcha_<timestamp>.png"
      this.log(`📸 CAPTCHA screenshot ready: ${request.filename}`, 'info');
debugger
console.log(this.captchaScreenshotsDir+request.imageUrl,"this.captchaScreenshotsDir+request.imageUrl")
      this.broadcast({
        type      : 'captcha',
        action    : 'show',
        imageUrl  : `http://localhost:5174${request.imageUrl}`,   // <-- frontend sets <img src> to this
        timestamp : request.timestamp
      });

    } catch (_) { /* ignore transient read errors */ }
  }

  checkForOtpRequest() {
    try {
      // If modal is already shown, don't do anything until response received
      if (this.otpModalShown) {
        return;
      }

      if (fs.existsSync(this.otpRequestFile)) {
        const requestContent = fs.readFileSync(this.otpRequestFile, 'utf8');
        const request = JSON.parse(requestContent);
        
        // Only show if it's a new OTP request
        if (request.timestamp !== this.lastOtpTimestamp) {
          this.lastOtpTimestamp = request.timestamp;
          this.otpModalShown = true;
          
          this.log('OTP request detected!', 'info');
          this.log('Showing OTP modal in frontend...', 'info');
          
          this.broadcast({
            type: 'otp',
            action: 'show',
            message: request.message,
            timestamp: request.timestamp
          });
        }
      }
    } catch (error) {
      // Don't log every polling error
    }
  }

  async setOtp(otp) {
    try {
      this.log(`OTP received: ${otp}`, 'info');
      
      // Make sure comm dir exists
      if (!fs.existsSync(this.commDir)) {
        fs.mkdirSync(this.commDir, { recursive: true });
      }

      // Write response file
      const responseData = {
        timestamp: Date.now(),
        otp: otp
      };
      fs.writeFileSync(this.otpResponseFile, JSON.stringify(responseData, null, 2));
      
      this.log('OTP saved to response file', 'success');
      this.otpModalShown = false; // Reset for next time
    } catch (error) {
      this.log(`Failed to save OTP: ${error.message}`, 'error');
    }
  }

  async setCaptchaAnswer(answer) {
    try {
      this.log(`CAPTCHA answer received: ${answer}`, 'info');
      
      // Make sure comm dir exists
      if (!fs.existsSync(this.commDir)) {
        fs.mkdirSync(this.commDir, { recursive: true });
      }

      // Write response file
      const responseData = {
        timestamp: Date.now(),
        answer: answer
      };
      fs.writeFileSync(this.captchaResponseFile, JSON.stringify(responseData, null, 2));
      
      this.log('CAPTCHA answer saved to response file', 'success');
      this.captchaModalShown = false; // Reset for next time
    } catch (error) {
      this.log(`Failed to save CAPTCHA answer: ${error.message}`, 'error');
    }
  }

  async runWdioTestWithExec() {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'npm.cmd' : 'npm';
      
      this.log('Starting WDIO recharge test...', 'info');
      
      const env = {
        ...process.env,
        CAPTCHA_SERVICE_API_KEY: process.env.CAPTCHA_SERVICE_API_KEY || ''
      };
      
      // Set VI_APP_OTP if provided
      if (this.viAppOtp) {
        env.VI_APP_OTP = this.viAppOtp;
        this.log(`VI App OTP set from frontend`, 'info');
      }
      
      const options = {
        cwd: this.swiftDir,
        env: env
      };

      const child = exec(`${command} run test:recharge`, options);

      child.stdout.on('data', (data) => {
        const output = data.toString();
        this.processOutput(output);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        this.processOutput(output, true);
      });

      child.on('close', (code) => {
        this.log(`WDIO process exited with code ${code}`, code === 0 ? 'success' : 'warning');
        
        if (code === 0 || code === 1) { // 1 means tests failed but ran successfully
          this.collectScreenshots();
          resolve();
        } else {
          reject(new Error(`Test failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        this.log(`Error running test: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  async runViAppTestWithExec() {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'npm.cmd' : 'npm';
      
      this.log('Starting Vi App test...', 'info');
      
      const env = {
        ...process.env
      };
      
      // Set VI_APP_OTP if provided
      if (this.viAppOtp) {
        env.VI_APP_OTP = this.viAppOtp;
        this.log(`VI App OTP set from frontend`, 'info');
      }
      
      const options = {
        cwd: this.swiftDir,
        env: env
      };

      const child = exec(`${command} run test:viapp`, options);

      child.stdout.on('data', (data) => {
        const output = data.toString();
        this.processViAppOutput(output);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        this.processViAppOutput(output, true);
      });

      child.on('close', (code) => {
        this.log(`Vi App test process exited with code ${code}`, code === 0 ? 'success' : 'warning');
        
        if (code === 0 || code === 1) { // 1 means tests failed but ran successfully
          this.collectScreenshots();
          resolve();
        } else {
          reject(new Error(`Vi App test failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        this.log(`Error running Vi App test: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  processViAppOutput(output, isError = false) {
    const lines = output.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const logType = isError ? 'error' : 'info';
      
      if (line.includes('[Vi App]')) {
        this.log(line, logType);
      } else if (line.includes('✓') || line.includes('PASS') || line.includes('success')) {
        this.log(line, 'success');
      } else if (line.includes('✗') || line.includes('FAIL') || line.includes('ERROR') || line.includes('Error')) {
        this.log(line, 'error');
      } else if (line.trim()) {
        this.log(line, logType);
      }

      if (line.includes('Test')) {
        const match = line.match(/Test (\d+)\/(\d+)/);
        if (match) {
          const current = parseInt(match[1]);
          const total = parseInt(match[2]);
          const percentage = 20 + Math.round((current / total) * 60);
          this.progress(percentage, 'Running Vi App Tests', `Test ${current}/${total}`);
        }
      }
    });
  }

  processOutput(output, isError = false) {
    const lines = output.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const logType = isError ? 'error' : 'info';
      
      if (line.includes('Test') && line.includes('/')) {
        this.log(line, logType);
      } else if (line.includes('[Recharge') || line.includes('[Swift') || line.includes('[Captcha')) {
        this.log(line, logType);
      } else if (line.includes('✓') || line.includes('PASS') || line.includes('success')) {
        this.log(line, 'success');
      } else if (line.includes('✗') || line.includes('FAIL') || line.includes('ERROR') || line.includes('Error')) {
        this.log(line, 'error');
      } else if (line.trim()) {
        this.log(line, logType);
      }

      if (line.includes('Test')) {
        const match = line.match(/Test (\d+)\/(\d+)/);
        if (match) {
          const current = parseInt(match[1]);
          const total = parseInt(match[2]);
          const percentage = 20 + Math.round((current / total) * 60);
          this.progress(percentage, 'Running Tests', `Test ${current}/${total}`);
        }
      }
    });
  }

  collectScreenshots() {
    try {
      const screenshotsDir = path.join(this.swiftDir, 'screenshots');
      
      if (fs.existsSync(screenshotsDir)) {
        const files = fs.readdirSync(screenshotsDir)
          .filter(file => file.endsWith('.png'))
          .map(file => {
            const filePath = path.join(screenshotsDir, file);
            const stats = fs.statSync(filePath);
            return { name: file, path: filePath, timestamp: stats.mtime };
          })
          .sort((a, b) => b.timestamp - a.timestamp);

        this.screenshots = files.map(file => ({
          name: file.name,
          url: `/screenshots/${file.name}`
        }));

        this.log(`Collected ${this.screenshots.length} screenshots`, 'success');
        this.broadcast({
          type: 'screenshots',
          screenshots: this.screenshots
        });
      }
    } catch (error) {
      this.log(`Failed to collect screenshots: ${error.message}`, 'warning');
    }
  }

  async generateFinalReport() {
    try {
      const reportsDir = path.join(this.swiftDir, 'reports');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(reportsDir, `UAT_Recharge_Report_${timestamp}.xlsx`);
      
      // Set the report path globally for download endpoint
      SwiftCrmOrchestrator.setLatestReportPath(reportPath);
      this.reportPath = reportPath;

      // Create report workbook
      const wb = xlsx.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['SWIFT CRM Recharge UAT Report'],
        ['Generated', new Date().toLocaleString()],
        ['Total Tests', this.testData.allRows.length],
        ['Screenshots', this.screenshots.length]
      ];
      const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
      xlsx.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Test Data sheet
      // const wsTestData = xlsx.utils.json_to_sheet(this.testData.rows);
      const wsTestData = xlsx.utils.json_to_sheet(this.testData.allRows); 
      xlsx.utils.book_append_sheet(wb, wsTestData, 'Test Data');

      // Screenshots index
      const screenshotData = this.screenshots.map((s, i) => ({
        'Sr. No.': i + 1,
        'File Name': s.name,
        'URL': s.url
      }));
      const wsScreenshots = xlsx.utils.json_to_sheet(screenshotData);
      xlsx.utils.book_append_sheet(wb, wsScreenshots, 'Screenshots');

      xlsx.writeFile(wb, reportPath);
      this.log(`Report generated: ${reportPath}`, 'success');
      
      return reportPath;
    } catch (error) {
      this.log(`Failed to generate report: ${error.message}`, 'error');
      throw error;
    }
  }

  // ─── Static helper: call once in your Express server file ──────────────
  //
  //   const { SwiftCrmOrchestrator } = require('./swiftCrmOrchestrator');
  //   SwiftCrmOrchestrator.registerRoutes(app);
  //
  // This serves  /captcha-images/<filename>  from  swift-crm-automation/captcha_screenshots/
  static registerRoutes(app) {
    const express = require('express');
    const captchaDir = path.join(__dirname, '..', 'swift-crm-automation', 'captcha_screenshots');

    // Ensure the folder exists before serving
    if (!fs.existsSync(captchaDir)) {
      fs.mkdirSync(captchaDir, { recursive: true });
    }

    app.use('/captcha-images', express.static(captchaDir));
    console.log(`[SwiftCrmOrchestrator] /captcha-images → ${captchaDir}`);
  }
}

module.exports = { SwiftCrmOrchestrator };