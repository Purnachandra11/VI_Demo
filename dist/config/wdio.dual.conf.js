"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const wdio_shared_1 = require("./wdio.shared");
const wdio_hooks_1 = require("./wdio.hooks");
const aDevice = process.env.APARTY_DEVICE || '';
const bDevice = process.env.BPARTY_DEVICE || process.env.bPartyDevice || '';
const caps = [];
if (aDevice)
    caps.push({ ...(0, wdio_shared_1.androidCapabilities)(aDevice), 'wdio:maxInstances': 1 });
if (bDevice)
    caps.push({ ...(0, wdio_shared_1.androidCapabilities)(bDevice), 'wdio:maxInstances': 1 });
exports.config = {
    ...wdio_shared_1.sharedConfig,
    specs: (0, wdio_shared_1.resolveSpecs)(),
    maxInstances: 2,
    capabilities: caps.length ? caps : [(0, wdio_shared_1.androidCapabilities)(aDevice || 'emulator-5554')],
    ...wdio_hooks_1.hooks
};
