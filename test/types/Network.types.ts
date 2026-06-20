// src/types/network.types.ts

export type NetworkType = '2G' | '3G' | '4G' | '5G' | 'AUTO';

export const NETWORK_MODE_MAP: Record<NetworkType, number> = {
  '2G':   1,
  '3G':   2,
  '4G':   11,
  '5G':   33,
  'AUTO': 33,
};

/**
 * How many seconds to wait after a network change before verifying
 */
export const NETWORK_SETTLE_SECONDS = 10;

/**
 * Minimum consecutive same-network readings to declare "stable"
 */
export const NETWORK_STABLE_THRESHOLD = 3;

export type SkipCode =
  | 'NETWORK_UNAVAILABLE'
  | 'NETWORK_CHANGE_FAILED'
  | 'NETWORK_MISMATCH_AFTER_CHANGE'
  | 'VOLTE_UNAVAILABLE'
  | 'DEVICE_DISCONNECTED';

/**
 * Returned by prepareTestEnvironment() when a test should be skipped
 */
export interface TestSkipReason {
  shouldSkip: true;
  skipCode: SkipCode;
  reason: string;
  targetNetwork?: string;
  actualNetwork?: string;
}

export interface TestSkipOk {
  shouldSkip: false;
  actualNetwork: string;
  volteEnabled: boolean;
}

export type PrepareResult = TestSkipReason | TestSkipOk;

/**
 * Full result of a setNetworkType() call
 */
export interface NetworkChangeResult {
  success: boolean;
  targetNetwork: NetworkType;
  actualNetwork: string;
  matched: boolean;
  reason: string;
  timeTakenMs: number;
}

export interface VoLTEStatus {
  enabled: boolean;
  imsRegistered: boolean;
  callCapability: 'VOLTE_READY' | 'CSFB_ONLY' | 'UNKNOWN';
  rawNetworkType: string;
}