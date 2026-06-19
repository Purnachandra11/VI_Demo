"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _TodoList_emptyLocalStorageIfNeeded, _TodoList_itemCalled, _TodoList_outstandingItemsLabel, _TodoList_newTodoInput, _TodoList_items, _TodoList_persistedItems, _TodoList_emptyLocalStorage;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoList = void 0;
const assertions_1 = require("@serenity-js/assertions");
const core_1 = require("@serenity-js/core");
const web_1 = require("@serenity-js/web");
const TodoListItem_1 = require("./TodoListItem");
class TodoList {
}
exports.TodoList = TodoList;
_a = TodoList;
// Public API captures the business domain-focused tasks
// that an actor interacting with a TodoList app can perform
TodoList.createEmptyList = () => core_1.Task.where('#actor creates an empty todo list', web_1.Navigate.to('https://todo-app.serenity-js.org/'), assertions_1.Ensure.that(web_1.Page.current().title().describedAs('website title'), (0, assertions_1.equals)('Serenity/JS TodoApp')), core_1.Wait.until(__classPrivateFieldGet(_a, _a, "f", _TodoList_newTodoInput).call(_a), (0, web_1.isVisible)()), __classPrivateFieldGet(_a, _a, "f", _TodoList_emptyLocalStorageIfNeeded).call(_a));
_TodoList_emptyLocalStorageIfNeeded = { value: () => core_1.Task.where('#actor empties local storage if needed', core_1.Check.whether(__classPrivateFieldGet(_a, _a, "f", _TodoList_persistedItems).call(_a).length, (0, assertions_1.isGreaterThan)(0))
        .andIfSo(__classPrivateFieldGet(_a, _a, "f", _TodoList_emptyLocalStorage).call(_a), web_1.Page.current().reload())) };
TodoList.createListContaining = (itemNames) => core_1.Task.where(`#actor starts with a list containing ${itemNames.length} items`, _a.createEmptyList(), ...itemNames.map(itemName => _a.recordItem(itemName)));
TodoList.recordItem = (itemName) => core_1.Task.where((0, core_1.d) `#actor records an item called ${itemName}`, web_1.Enter.theValue(itemName).into(__classPrivateFieldGet(_a, _a, "f", _TodoList_newTodoInput).call(_a)), web_1.Press.the(web_1.Key.Enter).in(__classPrivateFieldGet(_a, _a, "f", _TodoList_newTodoInput).call(_a)), core_1.Wait.until(web_1.Text.ofAll(__classPrivateFieldGet(_a, _a, "f", _TodoList_items).call(_a)), (0, assertions_1.contain)(itemName)));
TodoList.markAsCompleted = (itemNames) => core_1.Task.where((0, core_1.d) `#actor marks the following items as completed: ${itemNames}`, ...itemNames.map(itemName => TodoListItem_1.TodoListItem.markAsCompleted(__classPrivateFieldGet(_a, _a, "f", _TodoList_itemCalled).call(_a, itemName))));
TodoList.markAsOutstanding = (itemNames) => core_1.Task.where((0, core_1.d) `#actor marks the following items as outstanding: ${itemNames}`, ...itemNames.map(itemName => TodoListItem_1.TodoListItem.markAsOutstanding(__classPrivateFieldGet(_a, _a, "f", _TodoList_itemCalled).call(_a, itemName))));
TodoList.outstandingItemsCount = () => web_1.Text.of(web_1.PageElement.located(web_1.By.tagName('strong')).of(__classPrivateFieldGet(_a, _a, "f", _TodoList_outstandingItemsLabel).call(_a)))
    .as(Number)
    .describedAs('number of items left');
// Private API captures ways to locate interactive elements and data transformation logic.
// Private API supports the public API and is not used in the test scenario directly.
_TodoList_itemCalled = { value: (name) => __classPrivateFieldGet(_a, _a, "f", _TodoList_items).call(_a)
        .where(web_1.Text, (0, assertions_1.includes)(name))
        .first()
        .describedAs((0, core_1.d) `an item called ${name}`) };
_TodoList_outstandingItemsLabel = { value: () => web_1.PageElement.located(web_1.By.css('.todo-count'))
        .describedAs('items left counter') };
_TodoList_newTodoInput = { value: () => web_1.PageElement.located(web_1.By.css('.new-todo'))
        .describedAs('"What needs to be done?" input box') };
_TodoList_items = { value: () => web_1.PageElements.located(web_1.By.css('.todo-list li'))
        .describedAs('displayed items') };
_TodoList_persistedItems = { value: () => web_1.Page.current()
        .executeScript(`
            return window.localStorage['serenity-js-todo-app']
                ? JSON.parse(window.localStorage['serenity-js-todo-app'])
                : []
        `).describedAs('persisted items') };
_TodoList_emptyLocalStorage = { value: () => core_1.Task.where('#actor empties local storage', web_1.ExecuteScript.sync(`window.localStorage.removeItem('serenity-js-todo-app')`)) };
