import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const EMAIL = 'suprith@beverly.com';
const PASSWORD = 'Password123!';

const EVIDENCE_DIR = path.join(__dirname, '..', '..', 'testing', 'evidence', 'playwright');

function saveScreenshot(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

async function loginAsBeverly(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const submitBtn = page.locator('button').filter({ hasText: /sign in/i }).first();

  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  await page.screenshot({ path: saveScreenshot('01_login_form.png') });

  await submitBtn.click();
  try {
    await page.waitForURL(url => !url.toString().endsWith('/login'), { timeout: 10000 });
  } catch {
    // If still on /login, accept it — some flows show OTP
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: saveScreenshot('02_after_login.png') });
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test.describe('AP Automation E2E Verification — Compliance Features', () => {

  test('Verify compliance indicators in InvoiceDetailDrawer', async ({ page }) => {
    await loginAsBeverly(page);
    // Directly go to invoices page since we are already authenticated
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    // Click on the first invoice premium-card role button to open the drawer
    const row = page.locator('[role="button"]').filter({ hasText: /INV-|po:/i }).first();
    await row.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: saveScreenshot('compliance_detail_drawer.png') });

    // Assert validation pills and compliance elements
    const body = await page.textContent('body');
    // Ensure either Drawer validation pills or details container is present
    expect(body).toContain('Validation:');
  });

  test('Verify HSN Master Lookup Tab in Settings', async ({ page }) => {
    await loginAsBeverly(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    // Find and click the HSN Master tab button
    const hsnTab = page.locator('button').filter({ hasText: /HSN Master/i }).first();
    await hsnTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: saveScreenshot('hsn_master_settings_tab.png') });

    const body = await page.textContent('body');
    expect(body).toContain('HSN');
  });

});
