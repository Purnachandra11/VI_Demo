const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

class SwiftCrmOrchestrator {
  constructor(excelFilePath, wsClients, uploadDir) {
    this.excelFilePath = excelFilePath;
    this.wsClients = wsClients;
    this.uploadDir = uploadDir;
    this.swiftDir = path.join(__dirname, '..', 'swift-crm-automation');
    this.captchaAnswer = null;
    this.testData = null;
    this.screenshots = [];
    this.reportPath = null;
    this.currentWdioProcess = null;
    this.captchaPollingInterval = null;
    this.commDir = path.join(this.swiftDir, 'comm');
    this.captchaRequestFile = path.join(this.commDir, 'captcha_request.json');
    this.captchaResponseFile = path.join(this.commDir, 'captcha_response.json');
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
      this.log('Initializing SWIFT CRM Automation...', 'info');
      this.progress(5, 'Initializing', 'Reading Excel');

      // Validate directories
      if (!fs.existsSync(this.swiftDir)) {
        throw new Error(`SWIFT CRM directory not found: ${this.swiftDir}`);
      }

      // Parse Excel test data
      this.testData = this.parseExcelData(this.excelFilePath);
      this.log(`Loaded ${this.testData.rows.length} test rows from Excel`, 'success');
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
    
    const filteredRows = rows.filter(row => 
      row['SWIFT'] && row['SWIFT'].toString().toLowerCase() === 'yes'
    );

    return {
      allRows: rows,
      rows: filteredRows
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

      if (this.testData.rows.length === 0) {
        this.log('No rows with SWIFT=Yes found in Excel', 'warning');
        this.broadcast({
          type: 'complete',
          success: false,
          message: 'No test data found'
        });
        return;
      }

      this.log(`Starting SWIFT CRM Recharge UAT with ${this.testData.rows.length} test(s)`, 'info');
      this.progress(15, 'Starting', 'Running');

      // Copy uploaded Excel to data directory
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

      // Start CAPTCHA polling
      this.startCaptchaPolling();

      // Run the WDIO test with exec for better compatibility
      this.progress(20, 'Running Tests', 'Test 1');
      await this.runWdioTestWithExec();

      // Stop CAPTCHA polling
      this.stopCaptchaPolling();

      // Generate final report
      this.progress(90, 'Generating Report', 'Finalizing');
      await this.generateFinalReport();

      this.progress(100, 'Complete', 'Done');
      
      this.broadcast({
        type: 'complete',
        success: true,
        message: 'SWIFT CRM Recharge UAT completed successfully',
        reportPath: this.reportPath,
        screenshots: this.screenshots
      });

      return true;
    } catch (error) {
      this.stopCaptchaPolling();
      this.log(`UAT failed: ${error.message}`, 'error');
      this.broadcast({
        type: 'complete',
        success: false,
        message: error.message
      });
      throw error;
    }
  }

  startCaptchaPolling() {
    // Clean up any old comm files first
    this.cleanupCommFiles();
    
    this.log('Starting CAPTCHA polling...', 'info');
    this.lastCaptchaTimestamp = null; // Track to avoid duplicates
    this.captchaModalShown = false;
    
    this.captchaPollingInterval = setInterval(() => {
      this.checkForCaptchaRequest();
    }, 500); // Check every 0.5 seconds
  }

  stopCaptchaPolling() {
    if (this.captchaPollingInterval) {
      clearInterval(this.captchaPollingInterval);
      this.captchaPollingInterval = null;
    }
    this.cleanupCommFiles();
    this.lastCaptchaTimestamp = null;
    this.captchaModalShown = false;
  }

  cleanupCommFiles() {
    try {
      if (fs.existsSync(this.captchaRequestFile)) {
        fs.unlinkSync(this.captchaRequestFile);
      }
      if (fs.existsSync(this.captchaResponseFile)) {
        fs.unlinkSync(this.captchaResponseFile);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  checkForCaptchaRequest() {
    try {
      // If modal is already shown, don't do anything until response received
      if (this.captchaModalShown) {
        return;
      }

      if (fs.existsSync(this.captchaRequestFile)) {
        const requestContent = fs.readFileSync(this.captchaRequestFile, 'utf8');
        const request = JSON.parse(requestContent);
        
        // Only show if it's a new CAPTCHA
        if (request.timestamp !== this.lastCaptchaTimestamp) {
          this.lastCaptchaTimestamp = request.timestamp;
          this.captchaModalShown = true;
          
          this.log('CAPTCHA request detected!', 'info');
          this.log('Showing CAPTCHA modal in frontend...', 'info');
          
          this.broadcast({
            type: 'captcha',
            action: 'show',
            imageBase64: request.imageBase64,
            timestamp: request.timestamp
          });
        }
      }
    } catch (error) {
      // Don't log every polling error
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
      
      const options = {
        cwd: this.swiftDir,
        env: {
          ...process.env,
          CAPTCHA_SERVICE_API_KEY: process.env.CAPTCHA_SERVICE_API_KEY || ''
        }
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
        ['Total Tests', this.testData.rows.length],
        ['Screenshots', this.screenshots.length]
      ];
      const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
      xlsx.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Test Data sheet
      const wsTestData = xlsx.utils.json_to_sheet(this.testData.rows);
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
}

module.exports = { SwiftCrmOrchestrator };
