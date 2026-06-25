"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@wdio/globals");
const page_1 = __importDefault(require("./page"));
/**
 * sub page containing specific selectors and methods for a specific page
 */
class LoginPage extends page_1.default {
    /**
     * define selectors using getter methods
     */
    get inputUsername() {
        return (0, globals_1.$)('#username');
    }
    get inputPassword() {
        return (0, globals_1.$)('#password');
    }
    get btnSubmit() {
        return (0, globals_1.$)('button[type="submit"]');
    }
    /**
     * a method to encapsule automation code to interact with the page
     * e.g. to login using username and password
     */
    async login(username, password) {
        await this.inputUsername.setValue(username);
        await this.inputPassword.setValue(password);
        await this.btnSubmit.click();
    }
    /**
     * overwrite specific options to adapt it to page object
     */
    open() {
        return super.open('login');
    }
}
exports.default = new LoginPage();
