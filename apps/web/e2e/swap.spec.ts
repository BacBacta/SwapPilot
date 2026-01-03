import { test, expect } from '@playwright/test';

test.describe('Landing (/) ', () => {
  test('should render landing page and launch CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');

    // Scope to the main nav to avoid strict-mode collisions with footer links.
    await expect(page.locator('nav.nav').getByRole('link', { name: /SwapPilot/i })).toBeVisible();
    await expect(page.locator('nav.nav').getByRole('link', { name: /Launch App/i })).toBeVisible();
  });
});

test.describe('Swap (Landio)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swap');
    // Wait for the controller to mount and initialize the swap button.
    await expect(page.locator('#swapBtn')).toHaveText(/Enter an amount/i, { timeout: 10000 });
  });

  test('should render swap inputs and disabled CTA initially', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Swap' })).toBeVisible();

    const fromAmount = page.locator('#fromAmount');
    const toAmount = page.locator('#toAmount');
    const swapBtn = page.locator('#swapBtn');

    await expect(fromAmount).toBeVisible();
    await expect(toAmount).toBeVisible();
    await expect(toAmount).toHaveAttribute('readonly', '');

    await expect(swapBtn).toBeVisible();
    await expect(swapBtn).toBeDisabled();
    await expect(swapBtn).toHaveText(/Enter an amount/i);

    // These sections are template-driven and should start hidden.
    await expect(page.locator('#beqContainer')).toBeHidden();
    await expect(page.locator('#routeContainer')).toBeHidden();
    await expect(page.locator('#providersContainer')).toBeHidden();
    await expect(page.locator('#detailsToggle')).toBeHidden();
  });

  test('should open and close slippage settings modal', async ({ page }) => {
    const modal = page.locator('#slippageModal');
    // Modal starts without the open class (hidden visually).
    await expect(modal).not.toHaveClass(/open/);

    await page.locator('#openSlippage').click();
    // Wait for modal content to be visible.
    await expect(page.locator('#slippageModal .slippage-content')).toBeVisible();
    await expect(modal).toHaveClass(/open/);

    await page.locator('#closeSlippage').click();
    await expect(page.locator('#slippageModal .slippage-content')).toBeHidden();
    await expect(modal).not.toHaveClass(/open/);
  });

  test('should fetch mock quotes and reveal details panels', async ({ page }) => {
    // Enable console logging to catch errors
    page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));

    const fromAmount = page.locator('#fromAmount');
    const swapBtn = page.locator('#swapBtn');

    // Ensure swap button shows initial state (controller is mounted).
    await expect(swapBtn).toHaveText(/Enter an amount/i);

    // Wait a tick for React hydration to attach event listeners.
    await page.waitForTimeout(500);

    // Type value to simulate user input (triggers native input events).
    await fromAmount.click();
    await fromAmount.fill('');
    await fromAmount.pressSequentially('1', { delay: 100 });
    await expect(fromAmount).toHaveValue('1');

    // Wait for controller to process and swap button to change.
    await expect(swapBtn).toHaveText(/Swap/i, { timeout: 30000 });
    await expect(swapBtn).toBeEnabled();

    await expect(page.locator('#beqContainer')).toBeVisible();
    await expect(page.locator('#routeContainer')).toBeVisible();
    await expect(page.locator('#providersContainer')).toBeVisible();
    await expect(page.locator('#detailsToggle')).toBeVisible();
  });

  test('should allow selecting a different provider row', async ({ page }) => {
    const fromAmount = page.locator('#fromAmount');
    const swapBtn = page.locator('#swapBtn');

    await page.waitForTimeout(500);
    await fromAmount.click();
    await fromAmount.pressSequentially('1', { delay: 100 });
    await expect(swapBtn).toHaveText(/Swap/i, { timeout: 30000 });
    await expect(page.locator('#providersContainer')).toBeVisible();

    const items = page.locator('#providersContainer .provider-item');
    await expect(items).toHaveCount(3);

    await expect(items.nth(0)).toHaveClass(/selected/);
    await items.nth(1).click();
    await expect(items.nth(1)).toHaveClass(/selected/);
  });

  test('should toggle transaction details accordion', async ({ page }) => {
    const fromAmount = page.locator('#fromAmount');
    const swapBtn = page.locator('#swapBtn');

    await page.waitForTimeout(500);
    await fromAmount.click();
    await fromAmount.pressSequentially('1', { delay: 100 });

    // Wait for quotes to load before checking details toggle.
    await expect(swapBtn).toHaveText(/Swap/i, { timeout: 30000 });
    await expect(page.locator('#detailsToggle')).toBeVisible();

    const detailsContent = page.locator('#detailsContent');
    await expect(detailsContent).not.toHaveClass(/active/);
    await page.locator('#detailsToggle').click();
    await expect(detailsContent).toHaveClass(/active/);
  });
});

test.describe('Navigation', () => {
  test('should navigate to status page', async ({ page }) => {
    await page.goto('/status');
    
    await expect(page).toHaveURL('/status');
    await expect(page.locator('.overall-status')).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page).toHaveURL('/settings');
    // Landio settings page header is "Customize SwapPilot" with a Settings badge.
    await expect(page.locator('.page-header .section-badge')).toHaveText(/Settings/i);
    await expect(page.getByRole('heading', { name: /Customize/i })).toBeVisible();
  });
});

test.describe('Wallet Connection', () => {
  test('should display connect wallet button', async ({ page }) => {
    await page.goto('/swap');
    
    // Connect button should be visible
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
  });

  test('should open wallet modal on connect click', async ({ page }) => {
    await page.goto('/swap');
    
    // Click connect button
    await page.getByRole('button', { name: /Connect Wallet/i }).click();
    
    // RainbowKit renders a modal with multiple wallet options.
    // Check that the modal portal appears and contains wallet options.
    await expect(page.locator('[data-rk]').locator('text=Wallet').first()).toBeVisible({ timeout: 8000 });
  });
});

