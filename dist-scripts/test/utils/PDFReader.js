"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFReader = void 0;
// test/utils/PDFReader.ts
const fs = __importStar(require("fs"));
class PDFReader {
    async readInvoiceData(pdfPath) {
        // Using pdf-parse library
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        return this.extractInvoiceData(data.text);
    }
    extractInvoiceData(text) {
        const invoiceData = {
            customerName: this.extractCustomerName(text),
            billPeriod: this.extractBillPeriod(text),
            viNumber: this.extractViNumber(text),
            planName: this.extractPlanName(text),
            monthlyRental: this.extractMonthlyRental(text),
            totalCharges: this.extractTotalCharges(text),
            gstAmount: this.extractGSTAmount(text),
            totalPayable: this.extractTotalPayable(text),
            usageDetails: this.extractUsageDetails(text),
            vasCharges: this.extractVASCharges(text),
            adjustments: this.extractAdjustments(text),
        };
        return invoiceData;
    }
    extractCustomerName(text) {
        const match = text.match(/Mr\.\s+([A-Za-z\s]+)/i);
        return match ? match[1].trim() : 'Not Found';
    }
    extractBillPeriod(text) {
        const match = text.match(/Bill Period\s+(\d{2}\s+[A-Za-z]+\s+\d{2}\s+to\s+\d{2}\s+[A-Za-z]+\s+\d{2})/i);
        return match ? match[1] : 'Not Found';
    }
    extractViNumber(text) {
        const match = text.match(/VI No\s+(\d{10})/i);
        return match ? match[1] : 'Not Found';
    }
    extractPlanName(text) {
        // Look for plan names like "Vi Max Family 871" or similar
        const match = text.match(/Plan\s+Rental\s+-\s+([A-Za-z0-9\s]+)/i);
        return match ? match[1].trim() : 'Not Found';
    }
    extractMonthlyRental(text) {
        // Find rental amount from Plan Rental section
        const match = text.match(/Plan Rental[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n([\d,.]+)/i);
        if (match) {
            return this.parseCurrency(match[1]);
        }
        return 0;
    }
    extractTotalCharges(text) {
        const match = text.match(/Total charges for current bill period\s*\(including tax\)\s*([\d,.]+)/i);
        if (match) {
            return this.parseCurrency(match[1]);
        }
        return 0;
    }
    extractGSTAmount(text) {
        // GST appears as Central GST and State GST
        const matches = text.match(/Central GST @ 9\.00%\s*([\d,.]+)/i);
        if (matches && matches[1]) {
            const cgst = this.parseCurrency(matches[1]);
            const sgstMatch = text.match(/State GST @ 9\.00%\s*([\d,.]+)/i);
            const sgst = sgstMatch ? this.parseCurrency(sgstMatch[1]) : 0;
            return cgst + sgst;
        }
        return 0;
    }
    extractTotalPayable(text) {
        const match = text.match(/Total charges for current bill period\s*\(including tax\)\s*([\d,.]+)/i);
        if (match) {
            return this.parseCurrency(match[1]);
        }
        return 0;
    }
    extractUsageDetails(text) {
        // Extract data usage
        let dataUsage = 0;
        const dataMatch = text.match(/Internet Usage[\s\S]*?([\d.]+)\s*GB/i);
        if (dataMatch) {
            dataUsage = parseFloat(dataMatch[1]);
        }
        // Extract SMS usage
        let smsUsage = 0;
        const smsMatch = text.match(/SMS Charges[\s\S]*?Usage\s*\(SMS\)\s*([\d,]+)/i);
        if (smsMatch) {
            smsUsage = parseInt(smsMatch[1].replace(/,/g, ''), 10);
        }
        // Extract voice usage
        let voiceUsage = '0:00';
        const voiceMatch = text.match(/Voice Call Monthly Charges[\s\S]*?Total\s+([\d:]+)/i);
        if (voiceMatch) {
            voiceUsage = voiceMatch[1];
        }
        return { dataUsage, smsUsage, voiceUsage };
    }
    extractVASCharges(text) {
        const vasCharges = [];
        // Look for VAS subscriptions
        const vasSection = text.match(/Value Added Services \(VAS\)[\s\S]*?(?=For more details|$)/i);
        if (vasSection) {
            const lines = vasSection[0].split('\n');
            for (const line of lines) {
                const match = line.match(/([A-Za-z\s]+(?:Subscription|Service))\s*([\d,.]+)/i);
                if (match) {
                    vasCharges.push({
                        description: match[1].trim(),
                        amount: this.parseCurrency(match[2]),
                    });
                }
            }
        }
        return vasCharges;
    }
    // Add this method to PDFReader.ts
    async extractText(pdfBuffer) {
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(pdfBuffer);
            return data.text;
        }
        catch (error) {
            console.error('PDF parsing error:', error);
            throw error;
        }
    }
    extractAdjustments(text) {
        const adjustments = [];
        const adjustmentSection = text.match(/Adjustments[\s\S]*?(?=Taxable Value|$)/i);
        if (adjustmentSection) {
            const lines = adjustmentSection[0].split('\n');
            for (const line of lines) {
                const match = line.match(/([A-Z\s]+(?:Credit|Transfer|Adjustment))\s*([\d,.]+)/i);
                if (match) {
                    adjustments.push({
                        description: match[1].trim(),
                        amount: this.parseCurrency(match[2]),
                    });
                }
            }
        }
        return adjustments;
    }
    parseCurrency(value) {
        // Remove commas and convert to number
        const cleaned = value.replace(/,/g, '').replace(/\(-/g, '-').replace(/[^0-9.-]/g, '');
        return parseFloat(cleaned) || 0;
    }
}
exports.PDFReader = PDFReader;
