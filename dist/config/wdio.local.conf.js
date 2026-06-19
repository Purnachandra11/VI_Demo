"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const wdio_android_conf_1 = require("./wdio.android.conf");
exports.config = {
    ...wdio_android_conf_1.config,
    maxInstances: 1,
    logLevel: 'debug'
};
