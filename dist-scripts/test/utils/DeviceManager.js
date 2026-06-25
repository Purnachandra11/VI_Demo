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
exports.DeviceManager = void 0;
const ADBHelper_1 = require("./ADBHelper");
const env_1 = require("./env");
const numberToDevice = new Map();
let aPartyDeviceId = '';
/**  DeviceManager */
class DeviceManager {
    static async initializeDevices(aDevice, aNumber, bDevice, bNumber) {
        const ctx = (0, env_1.getRunContext)();
        const aDev = aDevice !== null && aDevice !== void 0 ? aDevice : ctx.aPartyDevice;
        const aNum = aNumber !== null && aNumber !== void 0 ? aNumber : ctx.aPartyNumber;
        const bDev = bDevice !== null && bDevice !== void 0 ? bDevice : ctx.bPartyDevice;
        const bNum = bNumber !== null && bNumber !== void 0 ? bNumber : ctx.bPartyNumber;
        numberToDevice.clear();
        aPartyDeviceId = aDev;
        if (aNum && aDev)
            numberToDevice.set(clean(aNum), aDev);
        if (bNum && bDev)
            numberToDevice.set(clean(bNum), bDev);
        console.log('[DeviceManager] Initialized device map');
    }
    static getDeviceIdForNumber(number) {
        return numberToDevice.get(clean(number));
    }
    static getAPartyDeviceId() {
        return aPartyDeviceId;
    }
    static async isDeviceConnected(deviceId) {
        return ADBHelper_1.ADBHelper.isDeviceConnected(deviceId);
    }
    static printDeviceStatus() {
        console.log('\n Device Manager Status:');
        for (const [num, dev] of numberToDevice) {
            console.log(`   ${num} → ${dev}`);
        }
        if (!numberToDevice.size)
            console.log('   (no mappings)');
    }
    static async setupAutoAnswer(bPartyDeviceId, _expectedCaller) {
        if (!bPartyDeviceId)
            return;
        console.log(`[DeviceManager] Auto-answer armed on ${bPartyDeviceId}`);
        try {
            const { adbShell } = await Promise.resolve().then(() => __importStar(require('./adb')));
            await adbShell(bPartyDeviceId, 'input keyevent 5');
        }
        catch (e) {
            console.warn(`[DeviceManager] Auto-answer prep: ${e.message}`);
        }
    }
    static async stopAutoAnswer(bPartyDeviceId) {
        if (!bPartyDeviceId)
            return;
        try {
            const { adbShell } = await Promise.resolve().then(() => __importStar(require('./adb')));
            await adbShell(bPartyDeviceId, 'input keyevent 6');
        }
        catch {
            /* ignore */
        }
    }
}
exports.DeviceManager = DeviceManager;
function clean(num) {
    const d = num.replace(/[^0-9]/g, '');
    return d.length >= 10 ? d.slice(-10) : d;
}
