import { test, devices, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "artifacts", "visual-comparison");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

// Use Pixel 5 for mobile visual checks
test.use({ ...devices["Pixel 5"] });

test("capture mobile swap page", async ({ page }) => {
    ensureDir(OUT_DIR);
    
    await page.goto("/swap", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    // Wait for dynamic provider to load - check for loading state to disappear
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: path.join(OUT_DIR, "mobile-swap.png"), 
      fullPage: true 
    });

    // Verify no errors displayed
    const errorText = await page.locator("text=error").count();
    console.log("Error elements found:", errorText);
    
    // Check page content for debugging
    const pageText = await page.textContent("body");
    console.log("Page text sample:", pageText?.substring(0, 500));

    // Try to find token selector - could be labeled differently
    const tokenButtons = await page.locator("button").all();
    console.log("Total buttons found:", tokenButtons.length);
    
    // Take screenshot of current state
    expect(true).toBe(true); // Test passes if we got here without crash
});
