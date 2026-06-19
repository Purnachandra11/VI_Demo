"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _GitHubStatus_baseApiUrl, _GitHubStatus_statusJson;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubStatus = void 0;
const assertions_1 = require("@serenity-js/assertions");
const core_1 = require("@serenity-js/core");
const rest_1 = require("@serenity-js/rest");
/**
 * Learn more about API testing with Serenity/JS
 *  https://serenity-js.org/handbook/api-testing/
 */
class GitHubStatus {
}
exports.GitHubStatus = GitHubStatus;
_a = GitHubStatus;
_GitHubStatus_baseApiUrl = { value: 'https://www.githubstatus.com/api/v2/' };
_GitHubStatus_statusJson = { value: __classPrivateFieldGet(_a, _a, "f", _GitHubStatus_baseApiUrl) + 'status.json' };
GitHubStatus.ensureAllSystemsOperational = () => core_1.Task.where(`#actor ensures all GitHub systems are operational`, rest_1.Send.a(rest_1.GetRequest.to(__classPrivateFieldGet(_a, _a, "f", _GitHubStatus_statusJson))), assertions_1.Ensure.that(rest_1.LastResponse.status(), (0, assertions_1.equals)(200)), assertions_1.Ensure.that(rest_1.LastResponse.body().status.description.describedAs('GitHub Status'), (0, assertions_1.equals)('All Systems Operational')));
