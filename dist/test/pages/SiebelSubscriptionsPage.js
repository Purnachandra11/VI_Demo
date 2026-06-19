"use strict";
/**
 * SiebelSubscriptionsPage.ts
 * Page Object — Steps 4, 5.1, 5.2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiebelSubscriptionsPage = void 0;
const globals_1 = require("@wdio/globals");
const chai_1 = require("chai");
// ─── Selectors ─────────────────────────────────────────────────────────────────
const SEL = {
    msisdnInput: '//*[@id="a_7"]/div/table/tbody/tr[3]/td[4]/div/input',
    goButton: '//*[@id="s_7_1_1_0_Ctrl"]',
    breadcrumb: '//span[@class="siebui-crumb"]',
    assetFieldAria: 'input[aria-label="Asset"]',
    assetFieldAlt: 'input[aria-labelledby="AssetNumTitle_Label"]',
    assetFieldFull: '//*[@id="a_3"]/table/tbody/tr/td/span/div/table[1]/tbody/tr/td[1]/input',
    gridBody: '#s_7_l tbody tr',
    gridTable: '#s_7_l',
    noDataMessage: '//div[contains(text(), "No records to display")]',
    loadingOverlay: '//div[contains(@class, "loading") or contains(@class, "wait")]',
};
class SiebelSubscriptionsPage {
    async enterMSISDN(msisdn) {
        console.log(`\n📱 Entering MSISDN: ${msisdn}`);
        //   const input = await $(SEL.msisdnInput);
        // await input.waitForDisplayed({ timeout: 15_000 });
        // await input.clearValue();
        // await input.setValue(msisdn);
        // console.log('   ✅ MSISDN entered');
        // Give Siebel time to fully render after login 
        await globals_1.browser.pause(3000);
        // Try to click Subscriptions tab first if visible 
        try {
            const subsTab = await (0, globals_1.$)('//*[contains(text(),"Subscriptions") and contains(@class,"ui-tabs-anchor")]');
            if (await subsTab.isDisplayed()) {
                await subsTab.click();
                await globals_1.browser.pause(2000);
            }
        }
        catch { /* already on subscriptions or tab not found */ }
        // Try multiple selectors in order 
        const selectors = [
            '//*[contains(@aria-label,"MSISDN")]',
            '//*[contains(@aria-label,"Mobile Number")]',
            '//*[contains(@name,"MSISDN")]',
            '//*[@id="s_7_r_0_MSISDN"]',
            '//input[contains(@id,"MSISDN")]',
            '//*[@id="a_7"]/div/table/tbody/tr[3]/td[4]/div/input'
        ];
        let entered = false;
        for (const sel of selectors) {
            try {
                const el = await (0, globals_1.$)(sel);
                if (await el.isExisting()) {
                    await el.waitForDisplayed({ timeout: 5000 });
                    await el.clearValue();
                    await el.setValue(msisdn);
                    console.log(`   ✅ MSISDN entered using selector: ${sel}`);
                    entered = true;
                    break;
                }
            }
            catch { /* try next */ }
        }
        if (!entered) {
            throw new Error('Could not find MSISDN input field with any known selector');
        }
    }
    async clickGoButton() {
        console.log('🔍 Clicking Go button...');
        const btn = await (0, globals_1.$)(SEL.goButton);
        await btn.waitForClickable({ timeout: 10000 });
        await btn.click();
        await this.waitForGridOrSummaryToLoad();
        console.log('   ✅ Go button clicked and page loaded');
    }
    async waitForGridOrSummaryToLoad() {
        try {
            const loadingOverlay = await (0, globals_1.$)(SEL.loadingOverlay);
            if (await loadingOverlay.isExisting()) {
                await loadingOverlay.waitForDisplayed({ reverse: true, timeout: 10000 });
            }
        }
        catch { /* No loading overlay */ }
        await globals_1.browser.pause(2000);
    }
    // async detectResultPage(): Promise<'ACCOUNT_SUMMARY' | 'SUBSCRIPTION_LIST'> {
    //   console.log('⏳ Detecting result page type...');
    //   await browser.waitUntil(
    //     async () => {
    //       try {
    //         const crumb = await $(SEL.breadcrumb);
    //         if (await crumb.isDisplayed()) {
    //           const txt = (await crumb.getText()).trim();
    //           if (txt.toLowerCase().includes('account summary')) return true;
    //         }
    //       } catch { /* not there yet */ }
    //       try {
    //         const rows = await $$(SEL.gridBody);
    //         if ((await rows.length) > 0) return true;
    //       } catch { /* not there yet */ }
    //       try {
    //         const noDataMsg = await $(SEL.noDataMessage);
    //         if (await noDataMsg.isDisplayed()) return true;
    //       } catch { /* not there yet */ }
    //       return false;
    //     },
    //     { timeout: 20_000, interval: 1_000,
    //       timeoutMsg: 'Neither Account Summary nor subscription grid appeared' }
    //   );
    //   try {
    //     const crumb = await $(SEL.breadcrumb);
    //     if (await crumb.isDisplayed()) {
    //       const txt = (await crumb.getText()).trim();
    //       if (txt.toLowerCase().includes('account summary')) {
    //         console.log('   📄 Direct Account Summary (Case 5.1)');
    //         return 'ACCOUNT_SUMMARY';
    //       }
    //     }
    //   } catch { /* fall through */ }
    //   const rows = await $$(SEL.gridBody);
    //   const noDataMsg = await $(SEL.noDataMessage);
    //   const isNoDataDisplayed = await noDataMsg.isDisplayed().catch(() => false);
    //   // if ((await rows.length) > 0 && !isNoDataDisplayed) {
    //   if ((await rows).length > 0 && !isNoDataDisplayed) {
    //     console.log('   📋 Subscription list grid (Case 5.2)');
    //     return 'SUBSCRIPTION_LIST';
    //   }
    //   console.log('   ⚠️ No subscriptions found, treating as empty grid');
    //   return 'SUBSCRIPTION_LIST';
    // }
    async detectResultPage() {
        console.log('⏳ Detecting result page type...');
        await globals_1.browser.waitUntil(async () => {
            try {
                const crumb = await (0, globals_1.$)(SEL.breadcrumb);
                if (await crumb.isDisplayed()) {
                    const txt = (await crumb.getText()).trim();
                    if (txt.toLowerCase().includes('account summary'))
                        return true;
                }
            }
            catch { /* not there yet */ }
            try {
                const rows = await (0, globals_1.$$)(SEL.gridBody);
                if ((await rows.length) > 0)
                    return true;
            }
            catch { /* not there yet */ }
            try {
                const noDataMsg = await (0, globals_1.$)(SEL.noDataMessage);
                if (await noDataMsg.isDisplayed())
                    return true;
            }
            catch { /* not there yet */ }
            return false;
        }, { timeout: 20000, interval: 1000,
            timeoutMsg: 'Neither Account Summary nor subscription grid appeared' });
        try {
            const crumb = await (0, globals_1.$)(SEL.breadcrumb);
            if (await crumb.isDisplayed()) {
                const txt = (await crumb.getText()).trim();
                if (txt.toLowerCase().includes('account summary')) {
                    console.log('   📄 Direct Account Summary (Case 5.1)');
                    return 'ACCOUNT_SUMMARY';
                }
            }
        }
        catch { /* fall through */ }
        const rows = await (0, globals_1.$$)(SEL.gridBody);
        const noDataMsg = await (0, globals_1.$)(SEL.noDataMessage);
        const isNoDataDisplayed = await noDataMsg.isDisplayed().catch(() => false);
        if ((await rows.length) > 0 && !isNoDataDisplayed) {
            console.log('   📋 Subscription list grid (Case 5.2)');
            return 'SUBSCRIPTION_LIST';
        }
        console.log('   ⚠️ No subscriptions found, treating as empty grid');
        return 'SUBSCRIPTION_LIST';
    }
    async verifyAccountSummaryPage(expectedMsisdn) {
        console.log(`\n✅ Verifying Account Summary for MSISDN: ${expectedMsisdn}`);
        const breadcrumb = await (0, globals_1.$)(SEL.breadcrumb);
        await breadcrumb.waitForDisplayed({ timeout: 15000 });
        const breadcrumbText = (await breadcrumb.getText()).trim();
        (0, chai_1.expect)(breadcrumbText).to.contain('Account Summary');
        console.log(`   ✅ Breadcrumb: "${breadcrumbText}"`);
        const assetField = await this.findAssetField();
        await assetField.waitForDisplayed({ timeout: 10000 });
        const assetValue = await assetField.getValue();
        console.log(`   📱 Asset/Mobile Number field value: "${assetValue}"`);
        const normalise = (v) => v.replace(/[^0-9]/g, '').slice(-10);
        (0, chai_1.expect)(normalise(assetValue)).to.contain(normalise(expectedMsisdn));
        console.log(`   ✅ MSISDN verified: ${expectedMsisdn}`);
        try {
            const bodyText = await (await (0, globals_1.$)('body')).getText();
            if (bodyText.toLowerCase().includes('postpaid')) {
                console.log('   ✅ Account type: Postpaid confirmed');
            }
        }
        catch { /* non-critical */ }
    }
    async findAssetField() {
        for (const sel of [SEL.assetFieldAria, SEL.assetFieldAlt, SEL.assetFieldFull]) {
            try {
                const el = await (0, globals_1.$)(sel);
                if (await el.isExisting())
                    return el;
            }
            catch { /* try next */ }
        }
        throw new Error('Asset/Mobile Number field not found with any known locator');
    }
    async findAndOpenValidSubscription(msisdn) {
        var _a;
        console.log(`\n🔎 Scanning subscription grid for MSISDN: ${msisdn}`);
        await this.waitForGridToLoad();
        const rows = await (0, globals_1.$$)(SEL.gridBody);
        console.log(`   Found ${(await rows.length)} rows in grid`);
        if ((await rows.length) === 0) {
            console.log('   ⚠️ No rows found in subscription grid');
            await this.checkForNoDataMessage();
            return false;
        }
        let validRowCount = 0;
        let skippedRows = 0;
        for (const row of rows) {
            const rowClass = (_a = (await row.getAttribute('class'))) !== null && _a !== void 0 ? _a : '';
            if (rowClass.includes('jqgfirstrow') || rowClass.includes('jqgempty')) {
                continue;
            }
            let rowMsisdn = '';
            try {
                const msisdnElement = await row.$('td[id*="_MSISDN"]');
                rowMsisdn = (await msisdnElement.getText()).trim();
            }
            catch {
                skippedRows++;
                continue;
            }
            if (rowMsisdn !== msisdn.trim())
                continue;
            let status = '';
            try {
                const statusElement = await row.$('td[id*="_Status"]');
                status = (await statusElement.getText()).trim().toLowerCase();
            }
            catch {
                console.log(`   ⚠️ Could not read status for MSISDN: ${rowMsisdn}`);
                continue;
            }
            let activationDate = '';
            try {
                const activationElement = await row.$('td[id*="_TM_Install_Date"]');
                activationDate = (await activationElement.getText()).trim();
            }
            catch {
                console.log(`   ℹ️ No activation date found for MSISDN: ${rowMsisdn}`);
            }
            console.log(`   Row — MSISDN: ${rowMsisdn} | Status: ${status} | Activation: ${activationDate || 'Not set'}`);
            // Valid statuses: Active or Suspended
            const validStatus = status === 'active' || status === 'suspended';
            if (!validStatus) {
                console.log(`   ⏭️  Skipping — Status "${status}" is not Active/Suspended (Case 5.2 requirement)`);
                skippedRows++;
                continue;
            }
            if (!activationDate) {
                console.log('   ⏭️  Skipping — Activation Date missing');
                skippedRows++;
                continue;
            }
            validRowCount++;
            try {
                const assetLink = await row.$('td[id*="_Asset_Number"] a');
                await assetLink.waitForClickable({ timeout: 5000 });
                const assetNumber = (await assetLink.getText()).trim();
                console.log(`   ✅ Valid record found (Active/Suspended) — Asset #: ${assetNumber} | Status: ${status}`);
                console.log(`   🔗 Clicking Asset # link...`);
                await assetLink.click();
                await this.waitForAccountSummaryToLoad();
                console.log(`   ✅ Successfully navigated to Account Summary for Asset #: ${assetNumber}`);
                return true;
            }
            catch (err) {
                const error = err;
                console.warn(`   ⚠️ Could not click Asset link: ${error.message}`);
                continue;
            }
        }
        console.log(`\n📊 Subscription scan summary:`);
        console.log(`   - Valid rows (Active/Suspended) found: ${validRowCount}`);
        console.log(`   - Rows skipped: ${skippedRows}`);
        console.log(`   - Total rows processed: ${(await rows.length)}`);
        console.log(`\n   ❌ No Active/Suspended subscription found for ${msisdn}`);
        return false;
    }
    async waitForGridToLoad() {
        console.log('   ⏳ Waiting for subscription grid to load...');
        try {
            const loadingOverlay = await (0, globals_1.$)(SEL.loadingOverlay);
            if (await loadingOverlay.isExisting()) {
                await loadingOverlay.waitForDisplayed({ reverse: true, timeout: 15000 });
            }
            await (0, globals_1.$)(SEL.gridTable).waitForDisplayed({ timeout: 10000 });
            await globals_1.browser.pause(1000);
            console.log('   ✅ Grid loaded successfully');
        }
        catch (err) {
            const error = err;
            console.log(`   ⚠️ Grid may not have loaded completely: ${error.message}`);
        }
    }
    async waitForAccountSummaryToLoad() {
        console.log('   ⏳ Waiting for Account Summary page to load...');
        try {
            const breadcrumb = await (0, globals_1.$)(SEL.breadcrumb);
            await breadcrumb.waitForDisplayed({ timeout: 15000 });
            const assetField = await this.findAssetField();
            await assetField.waitForDisplayed({ timeout: 10000 });
            console.log('   ✅ Account Summary page loaded successfully');
        }
        catch (err) {
            const error = err;
            console.log(`   ⚠️ Account Summary page may not have loaded completely: ${error.message}`);
        }
    }
    async checkForNoDataMessage() {
        try {
            const noDataMsg = await (0, globals_1.$)(SEL.noDataMessage);
            if (await noDataMsg.isDisplayed()) {
                const message = await noDataMsg.getText();
                console.log(` No subscriptions found: ${message}`);
                return true;
            }
        }
        catch { /* No message displayed */ }
        return false;
    }
    async getRowByMSISDN(msisdn) {
        await this.waitForGridToLoad();
        const rows = await (0, globals_1.$$)(SEL.gridBody);
        for (let i = 0; i < await rows.length; i++) {
            const row = rows[i];
            const rowClass = await row.getAttribute('class');
            if (rowClass === null || rowClass === void 0 ? void 0 : rowClass.includes('jqgfirstrow'))
                continue;
            try {
                const msisdnElement = await row.$('td[id*="_MSISDN"]');
                const rowMsisdn = await msisdnElement.getText();
                if (rowMsisdn.trim() === msisdn) {
                    const status = await row.$('td[id*="_Status"]').getText();
                    const activationDate = await row.$('td[id*="_TM_Install_Date"]').getText();
                    const assetNumber = await row.$('td[id*="_Asset_Number"] a').getText();
                    return {
                        index: i + 1,
                        record: {
                            status: status.trim(),
                            activationDate: activationDate.trim(),
                            assetNumber: assetNumber.trim()
                        }
                    };
                }
            }
            catch (err) {
                const error = err;
                console.log(`Error reading row ${i}: ${error.message}`);
                continue;
            }
        }
        return null;
    }
    async clickAssetNumber(rowIndex) {
        const assetLink = await (0, globals_1.$)(`//*[@id="s_7_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_7_l_Asset_Number"]/a`);
        await assetLink.waitForClickable({ timeout: 10000 });
        await assetLink.click();
        await globals_1.browser.pause(3000);
        console.log(`✓ Clicked Asset # link at row ${rowIndex}`);
    }
    async findAndOpenValidSubscriptionWithOptions(msisdn, allowedStatuses = ['active', 'suspended'], requireActivationDate = true) {
        var _a;
        console.log(`\n🔎 Scanning subscription grid for MSISDN: ${msisdn}`);
        console.log(`   Allowed statuses: ${allowedStatuses.join(', ')}`);
        console.log(`   Activation date required: ${requireActivationDate}`);
        await this.waitForGridToLoad();
        const rows = await (0, globals_1.$$)(SEL.gridBody);
        const total = await this.getRowCount();
        console.log(`   Found ${total} rows in grid`);
        for (const row of rows) {
            const rowClass = (_a = (await row.getAttribute('class'))) !== null && _a !== void 0 ? _a : '';
            if (rowClass.includes('jqgfirstrow') || rowClass.includes('jqgempty')) {
                continue;
            }
            let rowMsisdn = '';
            try {
                rowMsisdn = (await row.$('td[id*="_MSISDN"]').getText()).trim();
            }
            catch {
                continue;
            }
            if (rowMsisdn !== msisdn.trim())
                continue;
            let status = '';
            try {
                status = (await row.$('td[id*="_Status"]').getText()).trim().toLowerCase();
            }
            catch {
                continue;
            }
            let activationDate = '';
            try {
                activationDate = (await row.$('td[id*="_TM_Install_Date"]').getText()).trim();
            }
            catch { /* optional */ }
            console.log(`   Row — MSISDN: ${rowMsisdn} | Status: ${status} | Activation: ${activationDate || 'Not set'}`);
            const validStatus = allowedStatuses.includes(status);
            if (!validStatus) {
                console.log(`   ⏭️  Skipping — Status "${status}" not in allowed list`);
                continue;
            }
            if (requireActivationDate && !activationDate) {
                console.log('   ⏭️  Skipping — Activation Date missing');
                continue;
            }
            try {
                const assetLink = await row.$('td[id*="_Asset_Number"] a');
                const assetNumber = (await assetLink.getText()).trim();
                console.log(`   ✅ Valid record found — Asset #: ${assetNumber} | Status: ${status}`);
                await assetLink.click();
                await this.waitForAccountSummaryToLoad();
                return true;
            }
            catch (err) {
                const error = err;
                console.warn(`   ⚠️ Could not click Asset link: ${error.message}`);
            }
        }
        console.log(`   ❌ No valid subscription found for ${msisdn}`);
        return false;
    }
    async getRowCount() {
        await this.waitForGridToLoad();
        const rows = await (0, globals_1.$$)(SEL.gridBody);
        let count = 0;
        for (const row of rows) {
            const rowClass = await row.getAttribute('class');
            if (!(rowClass === null || rowClass === void 0 ? void 0 : rowClass.includes('jqgfirstrow'))) {
                count++;
            }
        }
        return count;
    }
}
exports.SiebelSubscriptionsPage = SiebelSubscriptionsPage;
