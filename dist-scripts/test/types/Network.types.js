"use strict";
// src/types/network.types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.NETWORK_STABLE_THRESHOLD = exports.NETWORK_SETTLE_SECONDS = exports.NETWORK_MODE_MAP = void 0;
/**
 * Android preferred_network_mode integers
 *
 * 1  = GSM only (2G)
 * 2  = WCDMA only (3G)
 * 11 = LTE only (4G)
 * 33 = NR/LTE/WCDMA/GSM auto (5G preferred)
 */
exports.NETWORK_MODE_MAP = {
    '2G': 1,
    '3G': 2,
    '4G': 11,
    '5G': 33,
    'AUTO': 33,
};
/**
 * How many seconds to wait after a network change before verifying
 */
exports.NETWORK_SETTLE_SECONDS = 10;
/**
 * Minimum consecutive same-network readings to declare "stable"
 */
exports.NETWORK_STABLE_THRESHOLD = 3;
