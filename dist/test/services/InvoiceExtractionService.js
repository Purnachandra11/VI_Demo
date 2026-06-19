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
exports.InvoiceExtractionService = void 0;
const AIPDFService_1 = require("./AIPDFService");
const PDFReader_1 = require("../utils/PDFReader");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class InvoiceExtractionService {
    constructor() {
        this.aiService = new AIPDFService_1.AIPDFService();
        this.pdfReader = new PDFReader_1.PDFReader();
    }
    async extractFromPDFFile(filePath) {
        console.log(`Extracting invoice from: ${filePath}`);
        // Read PDF content
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfText = await this.pdfReader.extractText(pdfBuffer);
        // Extract data using AI
        const invoiceData = await this.aiService.extractInvoiceData(pdfText);
        // Validate extraction
        const isValid = await this.aiService.validateExtractedData(invoiceData);
        if (!isValid) {
            console.warn('Extracted data may be incomplete:', invoiceData);
        }
        return invoiceData;
    }
    async extractFromURL(pdfUrl) {
        // Download PDF from URL
        const response = await fetch(pdfUrl);
        const buffer = await response.arrayBuffer();
        const pdfText = await this.pdfReader.extractText(Buffer.from(buffer));
        return await this.aiService.extractInvoiceData(pdfText);
    }
    async validateInvoice(invoiceData, expectedData) {
        const errors = [];
        const warnings = [];
        // Validate required fields
        if (!invoiceData.invoiceNumber)
            errors.push('Invoice number is missing');
        if (!invoiceData.invoiceDate)
            errors.push('Invoice date is missing');
        if (!invoiceData.mobileNumber)
            errors.push('Mobile number is missing');
        // Compare with expected data if provided
        if (expectedData.totalAmountDue) {
            const diff = Math.abs(invoiceData.totalAmountDue - expectedData.totalAmountDue);
            if (diff > 1) { // Tolerance of 1 rupee
                warnings.push(`Amount mismatch: Expected ${expectedData.totalAmountDue}, Got ${invoiceData.totalAmountDue}`);
            }
        }
        if (expectedData.mobileNumber && invoiceData.mobileNumber !== expectedData.mobileNumber) {
            errors.push(`Mobile number mismatch: Expected ${expectedData.mobileNumber}, Got ${invoiceData.mobileNumber}`);
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            data: invoiceData,
            confidence: invoiceData.confidence || 0.85
        };
    }
    async saveExtractedData(data, outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`Saved extracted data to: ${outputPath}`);
    }
}
exports.InvoiceExtractionService = InvoiceExtractionService;
