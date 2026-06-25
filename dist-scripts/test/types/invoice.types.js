"use strict";
/**
 * invoice.types.ts
 * Type definitions for invoice data extraction and validation
 * Comprehensive types for Vodafone Idea telecom invoice processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanBenefitType = exports.ValidationSeverity = exports.InvoiceSection = void 0;
// ============================================================================
// Constants & Enums
// ============================================================================
var InvoiceSection;
(function (InvoiceSection) {
    InvoiceSection["ACCOUNT_DETAILS"] = "Account Details";
    InvoiceSection["PLAN_DETAILS"] = "Plan Details";
    InvoiceSection["CHARGE_SUMMARY"] = "Charge Summary";
    InvoiceSection["USAGE_DETAILS"] = "Usage Details";
    InvoiceSection["VAS_CHARGES"] = "Value Added Services";
    InvoiceSection["ITEMISED_CALLS"] = "Itemised Calls";
    InvoiceSection["PAST_BILLS"] = "Past Bill Summary";
    InvoiceSection["TAX_BREAKDOWN"] = "Tax Breakdown";
})(InvoiceSection || (exports.InvoiceSection = InvoiceSection = {}));
var ValidationSeverity;
(function (ValidationSeverity) {
    ValidationSeverity["CRITICAL"] = "critical";
    ValidationSeverity["WARNING"] = "warning";
    ValidationSeverity["INFO"] = "info";
})(ValidationSeverity || (exports.ValidationSeverity = ValidationSeverity = {}));
var PlanBenefitType;
(function (PlanBenefitType) {
    PlanBenefitType["VOICE"] = "voice";
    PlanBenefitType["SMS"] = "sms";
    PlanBenefitType["DATA"] = "data";
    PlanBenefitType["ROAMING"] = "roaming";
    PlanBenefitType["VAS"] = "vas";
})(PlanBenefitType || (exports.PlanBenefitType = PlanBenefitType = {}));
