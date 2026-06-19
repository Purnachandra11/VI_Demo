"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.loadPhoneDeviceMap = loadPhoneDeviceMap;
exports.resolveDeviceForNumber = resolveDeviceForNumber;
const fs_1 = __importDefault(require("fs"));
function normalizePhone(value) {
    if (value == null || value === '' || value === '-')
        return '';
    const digits = String(value).replace(/\D/g, '');
    if (digits.length >= 10)
        return digits.slice(-10);
    return digits;
}
function loadPhoneDeviceMap() {
    const file = process.env.PHONE_DEVICE_MAP_FILE;
    if (!file || !fs_1.default.existsSync(file))
        return {};
    try {
        return JSON.parse(fs_1.default.readFileSync(file, 'utf8'));
    }
    catch {
        return {};
    }
}
function resolveDeviceForNumber(phoneNumber, map) {
    const key = normalizePhone(phoneNumber);
    return key ? map[key] || '' : '';
}
