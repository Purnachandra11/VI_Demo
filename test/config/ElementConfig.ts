/** Android UI locators — ElementConfig.ts */

export const DIALER_PACKAGE = 'com.google.android.dialer';
export const DIALER_ACTIVITY =
  'com.google.android.dialer.extensions.GoogleDialtactsActivity';

export const MESSAGING_PACKAGE =
  'com.google.android.apps.messaging';
export const MESSAGING_ACTIVITY =
  'com.google.android.apps.messaging.ui.ConversationListActivity';

export const SETTINGS_PACKAGE = 'com.android.settings';

export const DIGIT_IDS: Record<string, string> = {
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

export const SELECTORS = {
  // Dialer
  callButton:
    'com.google.android.dialer:id/dialpad_voice_call_button',

  endCallButton:
    'com.google.android.dialer:id/incall_end_call',

  addCall:
    '//android.view.View[@content-desc="Add call"]',

  moreOptions:
    '//androidx.compose.ui.platform.ComposeView[@resource-id="com.google.android.dialer:id/incall_main_buttons_container"]/android.view.View/android.view.View/android.view.View[1]/android.view.View[7]/android.widget.CheckBox',

  mergeCalls:
    '//android.view.View[@content-desc="Merge calls"]',

  // Messages
  startChatFab:
    'com.google.android.apps.messaging:id/start_chat_fab',

  messageInput:
    'com.google.android.apps.messaging:id/compose_message_text',

  sendButtonWorking:
    '//android.view.View[@resource-id="Compose:Draft:Send"]/android.widget.Button',

  sendButtonSms:
    '//android.widget.ImageView[@content-desc="Send SMS"]',

  sendButtonId:
    'com.google.android.apps.messaging:id/send_message_button_icon',

  // Settings
  networkSettingsText:
    '//android.widget.TextView[@text="Network & internet"]',

  networkSettingsContains:
    '//*[contains(@text,"Network") or contains(@text,"network")]',

  networkSettingsId:
    'com.android.settings:id/title',

  vpnSettingsText:
    '//android.widget.TextView[@text="VPN"]',

  vpnSettingsContains:
    '//*[contains(@text,"VPN") or contains(@text,"vpn")]',

  vpnSettingsId:
    'com.android.settings:id/title',

  simSettingsText:
    '//android.widget.TextView[@text="SIM cards"]',

  simSettingsContains:
    '//*[contains(@text,"SIM") or contains(@text,"sim")]',

  mobileNetworkText:
    '//android.widget.TextView[@text="Mobile network"]',

  mobileNetworkContains:
    '//*[contains(@text,"Mobile") or contains(@text,"mobile")]'
} as const;

/**
 * Digit Selector
 */
export function getDigitSelector(digit: string): string {
  const id = DIGIT_IDS[digit];

  if (!id) {
    throw new Error(`Invalid digit: ${digit}`);
  }

  return `android=new UiSelector().resourceId("${id}")`;
}

/**
 * Add Call Options
 */
export function getAddCallButtonOptions(): string[] {
  return [
    SELECTORS.addCall,
    '//*[contains(@content-desc,"Add call")]',
    '//*[contains(@text,"Add call")]',
    'android=new UiSelector().resourceId("com.google.android.dialer:id/add_call_button")'
  ];
}

/**
 * More Options
 */
export function getMoreOptionsButtonOptions(): string[] {
  return [
    SELECTORS.moreOptions,
    '//android.widget.ImageButton[@content-desc="More options"]',
    '//*[contains(@content-desc,"More")]'
  ];
}

/**
 * Merge Call Options
 */
export function getMergeCallsButtonOptions(): string[] {
  return [
    SELECTORS.mergeCalls,
    '//android.widget.TextView[@text="Merge calls"]',
    '//*[contains(@text,"Merge")]',
    '//*[contains(@content-desc,"Merge")]'
  ];
}

/**
 * End Call Options
 */
export function getEndCallButtonOptions(): string[] {
  return [
    `android=new UiSelector().resourceId("${SELECTORS.endCallButton}")`,
    '//android.widget.Button[contains(@text,"End")]',
    '//*[contains(@content-desc,"End call")]',
    '//*[contains(@content-desc,"End")]',
    '//android.widget.ImageButton[contains(@resource-id,"end_call")]'
  ];
}

/**
 * Send Button Options
 */
export function getSendButtonOptions(): string[] {
  return [
    SELECTORS.sendButtonWorking,
    SELECTORS.sendButtonSms,
    '//android.widget.ImageButton[@content-desc="Send SMS"]',
    `android=new UiSelector().resourceId("${SELECTORS.sendButtonId}")`,
    '//*[contains(@text,"Send") or contains(@content-desc,"Send")]'
  ];
}

/**
 * Network Settings
 */
export function getNetworkSettingsOptions(): string[] {
  return [
    SELECTORS.networkSettingsText,
    `android=new UiSelector().resourceId("${SELECTORS.networkSettingsId}")`,
    SELECTORS.networkSettingsContains
  ];
}

/**
 * VPN Settings
 */
export function getVpnSettingsOptions(): string[] {
  return [
    SELECTORS.vpnSettingsText,
    `android=new UiSelector().resourceId("${SELECTORS.vpnSettingsId}")`,
    SELECTORS.vpnSettingsContains
  ];
}

/**
 * SIM Settings
 */
export function getSimSettingsOptions(): string[] {
  return [
    SELECTORS.simSettingsText,
    SELECTORS.simSettingsContains
  ];
}

/**
 * Mobile Network Settings
 */
export function getMobileNetworkOptions(): string[] {
  return [
    SELECTORS.mobileNetworkText,
    SELECTORS.mobileNetworkContains
  ];
}