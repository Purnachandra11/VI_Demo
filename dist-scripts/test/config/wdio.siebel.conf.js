"use strict";
// test/config/wdio.siebel.conf.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({ path: path_1.default.resolve(process.cwd(), '.env') });
exports.config = {
    runner: 'local',
    specs: [
        path_1.default.join(__dirname, '../specs/siebel_invoice_validation.spec.ts'),
    ],
    exclude: [],
    capabilities: [
        {
            browserName: 'chrome',
            acceptInsecureCerts: true,
            'goog:chromeOptions': {
                args: [
                    '--ignore-certificate-errors',
                    '--disable-web-security',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
                binary: process.env.CHROME_BIN || undefined,
            },
        },
    ],
    automationProtocol: 'webdriver',
    path: '/',
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 600000,
    },
    reporters: [
        'spec',
        ['junit', {
                outputDir: './reports/junit',
                outputFileFormat: (opts) => `siebel-${opts.cid}.xml`,
            }],
    ],
    waitforTimeout: 30000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    before() {
        var _a, _b;
        console.log('\n' + '='.repeat(80));
        console.log('🌐 SIEBEL INVOICE VALIDATION SUITE');
        console.log('='.repeat(80));
        console.log(`   URL  : ${(_a = process.env.SIEBEL_URL) !== null && _a !== void 0 ? _a : '(default)'}`);
        console.log(`   User : ${(_b = process.env.SIEBEL_USERNAME) !== null && _b !== void 0 ? _b : '(not set)'}`);
        console.log('='.repeat(80) + '\n');
    },
    afterTest(test, _ctx, result) {
        console.log(`${result.passed ? '✅' : '❌'} ${test.fullTitle}`);
    },
};
