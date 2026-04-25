const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:5174/');
  await page.locator('.login-panel input').fill('Alice');
  await page.locator('.login-panel button').click();
  
  console.log('Logged in. Waiting for editor...');
  await page.waitForURL('http://localhost:5174/editor');

  const surface = page.locator('[data-testid=\"flowchart-surface\"]');
  await page.waitForTimeout(1000); // UI stabilizing
  await surface.dblclick({ position: { x: 200, y: 200 } });
  
  console.log('Added node, looking for node-0 label...');
  const nodeLabel = page.locator('[data-testid=\"node-label-node-0\"]');
  await nodeLabel.dblclick();

  const input = page.locator('.text-overlay-input[data-testid=\"text-overlay-input\"]');
  const isVisible = await input.isVisible();
  console.log('Input visible?', isVisible);
  
  if (isVisible) {
      await input.fill('NewName');
      await page.keyboard.press('Enter');
      
      const text = await nodeLabel.textContent();
      console.log('Node text after enter:', text);
  }
  
  await browser.close();
})();
