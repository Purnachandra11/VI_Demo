const { getSimNumberViaUSSD } = require('./ussdHandler');
const { parseExcelTestData } = require('./excelParser');
const { runWdioTestAsync, enrichPartiesFromDeviceMap } = require('./wdioRunner');

class TestOrchestrator {
  constructor(deviceId, excelFilePath, wsClients, phoneDeviceMap) {
    this.deviceId = deviceId;
    this.excelFilePath = excelFilePath;
    this.wsClients = wsClients;
    this.testData = null;
    this.devicePhoneNumber = null;
    this.phoneToDeviceId = phoneDeviceMap || {};
  }

  broadcast(data) {
    const message = JSON.stringify({ deviceId: this.deviceId, ...data });
    this.wsClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  async discoverConnectedDeviceNumbers() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
      const { stdout } = await execPromise('adb devices');
      const deviceIds = stdout
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && l.endsWith('device'))
        .map(l => l.split('\t')[0]);

      for (const devId of deviceIds) {
        try {
          const { phoneNumber } = await getSimNumberViaUSSD(devId, null);
          if (phoneNumber) {
            this.phoneToDeviceId[phoneNumber] = devId;
            this.broadcast({
              type: 'log',
              message: `Mapped ${phoneNumber} -> ${devId}`,
              logType: 'info'
            });
          }
        } catch (e) {
          this.broadcast({
            type: 'log',
            message: `USSD mapping failed for ${devId}: ${e.message}`,
            logType: 'warning'
          });
        }
      }
    } catch (err) {
      this.broadcast({
        type: 'log',
        message: `Failed to list devices: ${err.message}`,
        logType: 'error'
      });
    }
  }

  async initialize() {
    try {
      this.broadcast({
        type: 'log',
        message: 'Initializing test environment (WDIO + TypeScript)...',
        logType: 'info'
      });

      this.broadcast({
        type: 'progress',
        progress: { percentage: 10, action: 'Getting device info', status: 'Running' }
      });

      const ussdResult = await getSimNumberViaUSSD(this.deviceId, null);
      this.devicePhoneNumber = ussdResult.phoneNumber;

      if (!this.devicePhoneNumber) {
        throw new Error('Failed to retrieve phone number from device');
      }

      this.broadcast({
        type: 'log',
        message: `Device phone number: ${this.devicePhoneNumber}`,
        logType: 'success'
      });

      this.broadcast({
        type: 'progress',
        progress: { percentage: 15, action: 'Verifying numbers', status: 'Excel' }
      });

      this.broadcast({
        type: 'progress',
        progress: { percentage: 20, action: 'Reading test data', status: 'Parsing Excel' }
      });

      this.testData = parseExcelTestData(this.excelFilePath);

      this.broadcast({
        type: 'log',
        message: `Test data loaded: ${this.testData.calling.length} calling, ${this.testData.sms.length} SMS`,
        logType: 'success'
      });

      let aMismatch = 0;
      const bSet = new Set();
      for (const t of this.testData.calling) {
        if (t.aPartyNumber && t.aPartyNumber !== this.devicePhoneNumber) aMismatch++;
        if (t.bPartyNumber) bSet.add(t.bPartyNumber);
      }
      for (const t of this.testData.sms) {
        if (t.aPartyNumber && t.aPartyNumber !== this.devicePhoneNumber) aMismatch++;
        if (t.bPartyNumber) bSet.add(t.bPartyNumber);
      }
      const missingB = Array.from(bSet).filter(n => !this.phoneToDeviceId[n]);
      this.broadcast({
        type: 'log',
        message: `Verification: A mismatches=${aMismatch}, B missing devices=${missingB.length}`,
        logType: missingB.length ? 'warning' : 'info'
      });

      return true;
    } catch (error) {
      this.broadcast({
        type: 'log',
        message: `Initialization failed: ${error.message}`,
        logType: 'error'
      });
      throw error;
    }
  }

  buildWdioOptions(extra = {}) {
    const base = enrichPartiesFromDeviceMap(this.deviceId, this.devicePhoneNumber);
    const bPartyNumber = extra.bPartyNumber;
    const bPartyDevice = bPartyNumber ? (this.phoneToDeviceId[bPartyNumber] || '') : base.bPartyDevice;

    return {
      deviceId: this.deviceId,
      phone: this.devicePhoneNumber,
      bPartyDevice,
      bPartyNumber: bPartyNumber || base.bPartyNumber,
      cPartyDevice: base.cPartyDevice,
      cPartyNumber: base.cPartyNumber,
      callDuration: extra.duration,
      networkType: extra.preferredNetwork,
      volteEnabled: extra.volteSupported
    };
  }

  async runSIMAutoLatchTests() {
    try {
      await runWdioTestAsync('sim-auto-latch', this.buildWdioOptions());
      this.broadcast({
        type: 'log',
        message: 'SIM auto-latch suite completed (WDIO)',
        logType: 'success'
      });
    } catch (error) {
      this.broadcast({
        type: 'log',
        message: `SIM auto-latch failed: ${error.message}`,
        logType: 'error'
      });
    }
  }

  async runTests(testType) {
    try {
      await this.initialize();

      switch (testType) {
        case 'calling':
          await this.runCallingTests();
          break;
        case 'sms':
          await this.runSMSTests();
          break;
        case 'data':
          await this.runDataTests();
          break;
        case 'sim-auto-latch':
          await this.runSIMAutoLatchTests();
          break;
        case 'calling-sms':
          await runWdioTestAsync('calling-sms', this.buildWdioOptions());
          break;
        case 'all':
          await runWdioTestAsync('all', this.buildWdioOptions());
          break;
        default:
          throw new Error('Invalid test type');
      }

      this.broadcast({
        type: 'complete',
        success: true,
        message: 'All tests completed successfully'
      });

      return true;
    } catch (error) {
      this.broadcast({
        type: 'complete',
        success: false,
        message: error.message
      });
      throw error;
    }
  }

  async runCallingTests() {
    const tests = this.testData.calling;
    const total = tests.length;

    for (let i = 0; i < total; i++) {
      const test = tests[i];
      const progress = Math.round(((i + 1) / total) * 100);

      this.broadcast({
        type: 'progress',
        testType: 'calling',
        progress: {
          percentage: progress,
          action: 'CALLING',
          status: `Test ${i + 1}/${total}`,
          number: test.bPartyNumber,
          duration: test.duration
        }
      });

      try {
        await runWdioTestAsync('calling', this.buildWdioOptions(test));
        this.broadcast({
          type: 'log',
          message: `Calling test ${i + 1} completed: ${test.bPartyNumber}`,
          logType: 'success'
        });
      } catch (error) {
        this.broadcast({
          type: 'log',
          message: `Calling test ${i + 1} failed: ${error.message}`,
          logType: 'error'
        });
      }
    }
  }

  async runSMSTests() {
    const tests = this.testData.sms;
    const total = tests.length;

    for (let i = 0; i < total; i++) {
      const test = tests[i];
      const progress = Math.round(((i + 1) / total) * 100);

      this.broadcast({
        type: 'progress',
        testType: 'sms',
        progress: {
          percentage: progress,
          action: 'SENDING SMS',
          status: `Test ${i + 1}/${total}`,
          number: test.bPartyNumber || test.groupName
        }
      });

      try {
        await runWdioTestAsync('sms', this.buildWdioOptions(test));
        this.broadcast({
          type: 'log',
          message: `SMS test ${i + 1} completed`,
          logType: 'success'
        });
      } catch (error) {
        this.broadcast({
          type: 'log',
          message: `SMS test ${i + 1} failed: ${error.message}`,
          logType: 'error'
        });
      }
    }
  }

  async runDataTests() {
    const tests = this.testData.dataUsage;
    const total = tests.length;

    for (let i = 0; i < total; i++) {
      const test = tests[i];
      const progress = Math.round(((i + 1) / total) * 100);

      this.broadcast({
        type: 'progress',
        testType: 'data',
        progress: {
          percentage: progress,
          action: 'DATA USAGE',
          status: test.scenario,
          downloadedMB: 0,
          elapsedSec: 0,
          totalSec: test.durationMin * 60
        }
      });

      try {
        await runWdioTestAsync('data', this.buildWdioOptions(test));
        this.broadcast({
          type: 'log',
          message: `Data test ${i + 1} completed`,
          logType: 'success'
        });
      } catch (error) {
        this.broadcast({
          type: 'log',
          message: `Data test ${i + 1} failed: ${error.message}`,
          logType: 'error'
        });
      }
    }
  }
}

module.exports = { TestOrchestrator };
