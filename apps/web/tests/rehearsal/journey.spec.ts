import { test, expect } from '@playwright/test';

// placeholder walk — proves the rig (stack, migrations, build, app) end to end
test('the app is up on the rehearsal stack', async ({ page }) => {
  const out = process.env.REHEARSAL_OUT ?? 'rehearsal-out';
  const res = await page.goto('/login');
  expect(res?.status()).toBe(200);
  await page.screenshot({ path: `${out}/screens/00-login.png` });
});
