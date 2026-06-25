"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _TodoListItem_toggleButton;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoListItem = void 0;
const assertions_1 = require("@serenity-js/assertions");
const core_1 = require("@serenity-js/core");
const web_1 = require("@serenity-js/web");
class TodoListItem {
}
exports.TodoListItem = TodoListItem;
_a = TodoListItem;
// Public API captures the business domain-focused tasks
// that an actor interacting with a TodoListItem app can perform
TodoListItem.markAsCompleted = (item) => core_1.Task.where((0, core_1.d) `#actor marks ${item} as completed`, core_1.Check.whether(web_1.CssClasses.of(item), (0, assertions_1.not)((0, assertions_1.contain)('completed')))
    .andIfSo(_a.toggle(item)));
TodoListItem.markAsOutstanding = (item) => core_1.Task.where((0, core_1.d) `#actor marks ${item} as outstanding`, core_1.Check.whether(web_1.CssClasses.of(item), (0, assertions_1.contain)('completed'))
    .andIfSo(_a.toggle(item)));
TodoListItem.toggle = (item) => core_1.Task.where((0, core_1.d) `#actor toggles the completion status of ${item}`, web_1.Click.on(__classPrivateFieldGet(_a, _a, "f", _TodoListItem_toggleButton).call(_a).of(item)));
// Private API captures ways to locate interactive elements and data transformation logic.
// Private API supports the public API and is not used in the test scenario directly.
_TodoListItem_toggleButton = { value: () => web_1.PageElement
        .located(web_1.By.css('input.toggle'))
        .describedAs('toggle button') };
