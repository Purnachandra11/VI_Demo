// test/utils/SiebelSelectors.ts

export const SiebelSelectors = {
  // Login Page
  login: {
    usernameInput: '//*[@id="username"]',
    passwordInput: '//*[@id="password"]',
    loginButton: '//*[@id="loginData"]/div[4]/span/input',
    welcomeText: 'body',
  },

  // OTP Verification Page
  otp: {
    headingText: 'body',
    otpField: '//*[@id="Bharosa_Challenge_PadDataField"]',
    submitButton: '//*[@id="loginForm"]/div[4]/input',
  },

  // Application Shell 
  app: {
    homeTab: '//*[@id="ui-id-126"]',
    billingAndAccountTab: '//*[@id="ui-id-535"]',
  },

  // Subscriptions / Search Applet
  subscriptions: {
        // Search input field - MSISDN
    // msisdnInput: '//*[@id="a_7"]/div/table/tbody/tr[3]/td[4]/div/input',
    // Search input field - MSISDN - use label-based selector for robustness
    msisdnInput: '//*[contains(@aria-label,"MSISDN") or contains(@aria-label,"Mobile Number") or contains(@name,"MSISDN") or contains(@name,"s_7_r_0_MSISDN")]',
    
    // Go button
    goButton: '//*[@id="s_7_1_1_0_Ctrl"]',
    
    // Column headers
    colStatus: '//*[@id="jqgh_s_7_l_Status"]',
    colActivationDate: '//*[@id="jqgh_s_7_l_TM_Install_Date"]',
    colAssetNumber: '//*[@id="jqgh_s_7_l_Asset_Number"]',
    colMSISDN: '//*[@id="jqgh_s_7_l_MSISDN"]',
    
    // Table rows - dynamic
    rowByIndex: (index: number) => `//*[@id="s_7_l"]/tbody/tr[${index}]`,
    
    // Cell values within a row
    statusCell: (rowIndex: number) => `//*[@id="s_7_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_7_l_Status"]`,
    assetNumberLink: (rowIndex: number) => `//*[@id="s_7_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_7_l_Asset_Number"]/a`,
    activationDateCell: (rowIndex: number) => `//*[@id="s_7_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_7_l_TM_Install_Date"]`,
    msisdnCell: (rowIndex: number) => `//*[@id="s_7_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_7_l_MSISDN"]`,
    
    // Applet container
    appletContainer: '//*[@id="s_S_A7_div"]',
  },

  //  Account Summary Page
  accountSummary: {
    mobileNumberInput: '//*[@id="a_3"]/table/tbody/tr/td/span/div/table[1]/tbody/tr/td[1]/input',
    postpaidLabel: '//*[@id="a_3"]/table/tbody/tr/td/span/div/table[1]/tbody/tr/td[2]',
    circleNameLabel: '//*[@id="a_3"]/table/tbody/tr/td/span/div/table[1]/tbody/tr/td[3]',
  },

  //  Invoice / Bill Details
  invoice: {
    // Detailed view button
    detailedViewButton: '//*[@id="s_5_1_0_0_Ctrl"]',
    
    // Invoice date column for sorting
    invoiceDateHeader: '//*[@id="jqgh_s_5_l_Statement_Date"]',
    
    // Invoice rows
    invoiceRows: '//*[@id="s_5_l"]/tbody/tr',
    invoiceDateCell: (rowIndex: number) => `//*[@id="s_5_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_5_l_Statement_Date"]`,
    invoiceLinkCell: (rowIndex: number) => `//*[@id="s_5_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_5_l_Invoice_Number"]/a`,
  },
} as const;

export type SiebelSelectorKeys = keyof typeof SiebelSelectors;