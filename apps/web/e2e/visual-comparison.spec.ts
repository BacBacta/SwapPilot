import { test, devices } from "@playwright/test";
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
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: path.join(OUT_DIR, "mobile-swap.png"), 
      fullPage: true 
    });

    // Open token picker
    await page.getByRole("button", { name: /BNB/i }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(OUT_DIR, "mobile-token-picker.png"), 
      fullPage: true 
    });
    
    // Close and open settings
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /\d+(\.\d)?%/ }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(OUT_DIR, "mobile-settings.png"), 
      fullPage: true 
    });
});
