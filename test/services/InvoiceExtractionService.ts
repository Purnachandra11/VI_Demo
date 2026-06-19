import { AIPDFService } from './AIPDFService';
import { PDFReader } from '../utils/PDFReader';
import { InvoiceData, ValidationResult } from '../types/invoice.types';
import * as fs from 'fs';
import * as path from 'path';

export class InvoiceExtractionService {
    private aiService: AIPDFService;
    private pdfReader: PDFReader;
    
    constructor() {
        this.aiService = new AIPDFService();
        this.pdfReader = new PDFReader();
    }
    
    async extractFromPDFFile(filePath: string): Promise<InvoiceData> {
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
    
    async extractFromURL(pdfUrl: string): Promise<InvoiceData> {
        // Download PDF from URL
        const response = await fetch(pdfUrl);
        const buffer = await response.arrayBuffer();
        const pdfText = await this.pdfReader.extractText(Buffer.from(buffer));
        
        return await this.aiService.extractInvoiceData(pdfText);
    }
    
    async validateInvoice(invoiceData: InvoiceData, expectedData: Partial<InvoiceData>): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate required fields
        if (!invoiceData.invoiceNumber) errors.push('Invoice number is missing');
        if (!invoiceData.invoiceDate) errors.push('Invoice date is missing');
        if (!invoiceData.mobileNumber) errors.push('Mobile number is missing');
        
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
    
    async saveExtractedData(data: InvoiceData, outputPath: string): Promise<void> {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`Saved extracted data to: ${outputPath}`);
    }
}