"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@wdio/globals");
const login_page_1 = __importDefault(require("../pageobjects/login.page"));
const secure_page_1 = __importDefault(require("../pageobjects/secure.page"));
describe('My Login application', () => {
    it('should login with valid credentials', async () => {
        await login_page_1.default.open();
        await login_page_1.default.login('tomsmith', 'SuperSecretPassword!');
        await (0, globals_1.expect)(secure_page_1.default.flashAlert).toBeExisting();
        await (0, globals_1.expect)(secure_page_1.default.flashAlert).toHaveText(globals_1.expect.stringContaining('You logged into a secure area!'));
    });
});
