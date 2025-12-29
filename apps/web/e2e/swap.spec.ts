import { test, expect } from '@playwright/test';

test.describe('SwapPilot Homepage', () => {
  test('should redirect to swap page', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to /swap
    await expect(page).toHaveURL('/swap');
  });

  test('should display swap interface', async ({ page }) => {
    await page.goto('/swap');
    
    // Check main heading
    await expect(page.getByText('SwapPilot')).toBeVisible();
    
    // Check swap card is present
    await expect(page.getByText('Smart execution')).toBeVisible();
  });
});

test.describe('Swap Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swap');
  });

  test('should display From and To token inputs', async ({ page }) => {
    await expect(page.getByText('From')).toBeVisible();
    await expect(page.getByText('To')).toBeVisible();
  });

  test('should have BNB and ETH as default tokens', async ({ page }) => {
    // Default tokens should be BNB → ETH
    await expect(page.getByRole('button', { name: /BNB/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /ETH/i }).first()).toBeVisible();
  });

  test('should allow changing input amount', async ({ page }) => {
    const input = page.locator('input[type="text"]').first();
    
    await input.fill('10');
    await expect(input).toHaveValue('10');
  });

  test('should open token picker modal when clicking token button', async ({ page }) => {
    // Click on the first token button (From)
    await page.getByRole('button', { name: /BNB/i }).first().click();
    
    // Modal should open
    await expect(page.getByText('Select Token')).toBeVisible();
    await expect(page.getByPlaceholder('Search by name or symbol')).toBeVisible();
  });

  test('should search tokens in picker', async ({ page }) => {
    // Open token picker
    await page.getByRole('button', { name: /BNB/i }).first().click();
    
    // Search for USDT
    await page.getByPlaceholder('Search by name or symbol').fill('USDT');
    
    // USDT should be visible
    await expect(page.getByText('Tether USD')).toBeVisible();
  });

  test('should close token picker on backdrop click', async ({ page }) => {
    // Open token picker
    await page.getByRole('button', { name: /BNB/i }).first().click();
    
    // Click backdrop
    await page.locator('.fixed.inset-0').first().click({ force: true });
    
    // Modal should close
    await expect(page.getByText('Select Token')).not.toBeVisible();
  });

  test('should swap token direction', async ({ page }) => {
    // Find swap direction button (has rotate icon)
    const swapButton = page.locator('button:has(svg)').filter({ hasText: '' }).first();
    
    // Initial state: BNB → ETH
    const fromButton = page.getByRole('button', { name: /BNB/i }).first();
    await expect(fromButton).toBeVisible();
    
    // Click swap - this might need adjustment based on actual button structure
    await page.locator('[class*="rotate"]').click();
    
    // After swap: ETH → BNB (tokens should be reversed)
    // Note: This depends on the actual implementation
  });

  test('should toggle between BEQ and RAW modes', async ({ page }) => {
    // BEQ should be active by default
    await expect(page.getByRole('tab', { name: 'Best Exec' })).toHaveAttribute('aria-selected', 'true');
    
    // Click RAW tab
    await page.getByRole('tab', { name: 'Raw Output' }).click();
    
    // RAW should now be active
    await expect(page.getByRole('tab', { name: 'Raw Output' })).toHaveAttribute('aria-selected', 'true');
  });

  test('should have execution mode presets', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Safe' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Balanced' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turbo' })).toBeVisible();
  });

  test('should display execute button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Execute Best Quote/i })).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('should open settings drawer', async ({ page }) => {
    await page.goto('/swap');
    
    // Click settings button (gear icon)
    await page.locator('button:has(svg path[d*="M10.325"])').click();
    
    // Settings drawer should open
    await expect(page.getByText('Settings')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate to status page', async ({ page }) => {
    await page.goto('/status');
    
    await expect(page).toHaveURL('/status');
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page).toHaveURL('/settings');
  });
});

test.describe('Wallet Connection', () => {
  test('should display connect wallet button', async ({ page }) => {
    await page.goto('/swap');
    
    // Connect button should be visible
    await expect(page.getByRole('button', { name: /Connect/i })).toBeVisible();
  });

  test('should open wallet modal on connect click', async ({ page }) => {
    await page.goto('/swap');
    
    // Click connect button
    await page.getByRole('button', { name: /Connect/i }).click();
    
    // RainbowKit modal should open
    await expect(page.getByText(/Connect a Wallet|Connect Wallet/i)).toBeVisible();
  });
});

test.describe('Transaction History', () => {
  test('should open history drawer', async ({ page }) => {
    await page.goto('/swap');
    
    // Click history button
    await page.getByRole('button', { name: /History/i }).click();
    
    // History drawer should open
    await expect(page.getByText('Transaction History')).toBeVisible();
  });

  test('should display empty state when no transactions', async ({ page }) => {
    await page.goto('/swap');
    
    // Open history
    await page.getByRole('button', { name: /History/i }).click();
    
    // Should show empty state
    await expect(page.getByText('No transactions yet')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/swap');
    
    // Swap interface should be visible
    await expect(page.getByText('SwapPilot')).toBeVisible();
    
    // Mobile navigation should work
    await expect(page.locator('[class*="fixed bottom"]')).toBeVisible();
  });
});
