"use strict";
/** Android UI locators — ElementConfig.ts */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELECTORS = exports.DIGIT_IDS = exports.SETTINGS_PACKAGE = exports.MESSAGING_ACTIVITY = exports.MESSAGING_PACKAGE = exports.DIALER_ACTIVITY = exports.DIALER_PACKAGE = void 0;
exports.getDigitSelector = getDigitSelector;
exports.getAddCallButtonOptions = getAddCallButtonOptions;
exports.getMoreOptionsButtonOptions = getMoreOptionsButtonOptions;
exports.getMergeCallsButtonOptions = getMergeCallsButtonOptions;
exports.getEndCallButtonOptions = getEndCallButtonOptions;
exports.getSendButtonOptions = getSendButtonOptions;
exports.getNetworkSettingsOptions = getNetworkSettingsOptions;
exports.getVpnSettingsOptions = getVpnSettingsOptions;
exports.getSimSettingsOptions = getSimSettingsOptions;
exports.getMobileNetworkOptions = getMobileNetworkOptions;
exports.DIALER_PACKAGE = 'com.google.android.dialer';
exports.DIALER_ACTIVITY = 'com.google.android.dialer.extensions.GoogleDialtactsActivity';
exports.MESSAGING_PACKAGE = 'com.google.android.apps.messaging';
exports.MESSAGING_ACTIVITY = 'com.google.android.apps.messaging.ui.ConversationListActivity';
exports.SETTINGS_PACKAGE = 'com.android.settings';
exports.DIGIT_IDS = {
    '0': 'com.google.android.dialer:id/zero',
    '1': 'com.google.android.dialer:id/one',
    '2': 'com.google.android.dialer:id/two',
    '3': 'com.google.android.dialer:id/three',
    '4': 'com.google.android.dialer:id/four',
    '5': 'com.google.android.dialer:id/five',
    '6': 'com.google.android.dialer:id/six',
    '7': 'com.google.android.dialer:id/seven',
    '8': 'com.google.android.dialer:id/eight',
    '9': 'com.google.android.dialer:id/nine'
};
exports.SELECTORS = {
    // Dialer
    callButton: 'com.google.android.dialer:id/dialpad_voice_call_button',
    endCallButton: 'com.google.android.dialer:id/incall_end_call',
    addCall: '//android.view.View[@content-desc="Add call"]',
    moreOptions: '//androidx.compose.ui.platform.ComposeView[@resource-id="com.google.android.dialer:id/incall_main_buttons_container"]/android.view.View/android.view.View/android.view.View[1]/android.view.View[7]/android.widget.CheckBox',
    mergeCalls: '//android.view.View[@content-desc="Merge calls"]',
    // Messages
    startChatFab: 'com.google.android.apps.messaging:id/start_chat_fab',
    messageInput: 'com.google.android.apps.messaging:id/compose_message_text',
    sendButtonWorking: '//android.view.View[@resource-id="Compose:Draft:Send"]/android.widget.Button',
    sendButtonSms: '//android.widget.ImageView[@content-desc="Send SMS"]',
    sendButtonId: 'com.google.android.apps.messaging:id/send_message_button_icon',
    // Settings
    networkSettingsText: '//android.widget.TextView[@text="Network & internet"]',
    networkSettingsContains: '//*[contains(@text,"Network") or contains(@text,"network")]',
    networkSettingsId: 'com.android.settings:id/title',
    vpnSettingsText: '//android.widget.TextView[@text="VPN"]',
    vpnSettingsContains: '//*[contains(@text,"VPN") or contains(@text,"vpn")]',
    vpnSettingsId: 'com.android.settings:id/title',
    simSettingsText: '//android.widget.TextView[@text="SIM cards"]',
    simSettingsContains: '//*[contains(@text,"SIM") or contains(@text,"sim")]',
    mobileNetworkText: '//android.widget.TextView[@text="Mobile network"]',
    mobileNetworkContains: '//*[contains(@text,"Mobile") or contains(@text,"mobile")]'
};
/**
 * Digit Selector
 */
function getDigitSelector(digit) {
    const id = exports.DIGIT_IDS[digit];
    if (!id) {
        throw new Error(`Invalid digit: ${digit}`);
    }
    return `android=new UiSelector().resourceId("${id}")`;
}
/**
 * Add Call Options
 */
function getAddCallButtonOptions() {
    return [
        exports.SELECTORS.addCall,
        '//*[contains(@content-desc,"Add call")]',
        '//*[contains(@text,"Add call")]',
        'android=new UiSelector().resourceId("com.google.android.dialer:id/add_call_button")'
    ];
}
/**
 * More Options
 */
function getMoreOptionsButtonOptions() {
    return [
        exports.SELECTORS.moreOptions,
        '//android.widget.ImageButton[@content-desc="More options"]',
        '//*[contains(@content-desc,"More")]'
    ];
}
/**
 * Merge Call Options
 */
function getMergeCallsButtonOptions() {
    return [
        exports.SELECTORS.mergeCalls,
        '//android.widget.TextView[@text="Merge calls"]',
        '//*[contains(@text,"Merge")]',
        '//*[contains(@content-desc,"Merge")]'
    ];
}
/**
 * End Call Options
 */
function getEndCallButtonOptions() {
    return [
        `android=new UiSelector().resourceId("${exports.SELECTORS.endCallButton}")`,
        '//android.widget.Button[contains(@text,"End")]',
        '//*[contains(@content-desc,"End call")]',
        '//*[contains(@content-desc,"End")]',
        '//android.widget.ImageButton[contains(@resource-id,"end_call")]'
    ];
}
/**
 * Send Button Options
 */
function getSendButtonOptions() {
    return [
        exports.SELECTORS.sendButtonWorking,
        exports.SELECTORS.sendButtonSms,
        '//android.widget.ImageButton[@content-desc="Send SMS"]',
        `android=new UiSelector().resourceId("${exports.SELECTORS.sendButtonId}")`,
        '//*[contains(@text,"Send") or contains(@content-desc,"Send")]'
    ];
}
/**
 * Network Settings
 */
function getNetworkSettingsOptions() {
    return [
        exports.SELECTORS.networkSettingsText,
        `android=new UiSelector().resourceId("${exports.SELECTORS.networkSettingsId}")`,
        exports.SELECTORS.networkSettingsContains
    ];
}
/**
 * VPN Settings
 */
function getVpnSettingsOptions() {
    return [
        exports.SELECTORS.vpnSettingsText,
        `android=new UiSelector().resourceId("${exports.SELECTORS.vpnSettingsId}")`,
        exports.SELECTORS.vpnSettingsContains
    ];
}
/**
 * SIM Settings
 */
function getSimSettingsOptions() {
    return [
        exports.SELECTORS.simSettingsText,
        exports.SELECTORS.simSettingsContains
    ];
}
/**
 * Mobile Network Settings
 */
function getMobileNetworkOptions() {
    return [
        exports.SELECTORS.mobileNetworkText,
        exports.SELECTORS.mobileNetworkContains
    ];
}
