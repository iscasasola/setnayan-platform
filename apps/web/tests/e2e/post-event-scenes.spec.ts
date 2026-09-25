import { test, expect, devices, type Page, type FrameLocator } from '@playwright/test';

/**
 * POST EVENT IS MANY SMALL SCENES — the credentialed walk, on a PHONE.
 * (Owner, 2026-09-25, DECISION_LOG "POST EVENT IS MANY SMALL SCENES".)
 *
 * ─── WHY THIS IS A SPEC AND NOT A REPORT ────────────────────────────────────
 * The Maker is a couple-only page. A session does not sign in or type a
 * password, so the walk is written as something the OWNER runs with his own
 * signed-in browser state, and re-runs after any change:
 *
 *   # once — sign in by hand in the window that opens, then close it
 *   pnpm --filter @setnayan/web exec playwright codegen --save-storage=owner.json https://www.setnayan.com/login
 *   # then, against prod or a preview he can reach
 *   E2E_OWNER_STATE=owner.json E2E_EVENT_ID=<a FUTURE-dated event, e.g. cale-ice's> \
 *     E2E_BASE_URL=https://www.setnayan.com pnpm --filter @setnayan/web test:e2e -- post-event-scenes
 *
 * Without both variables every test here is SKIPPED, with the reason — never a
 * green that means nothing.
 *
 * ─── WHAT A PASS PROVES, AND WHAT IT DOES NOT ───────────────────────────────
 * ✅ Before the day, Post Event's navigator lists its scenes (not the one story
 *    tile), each waiting scene says what will fill it, "+ Add a scene" on Post
 *    Event offers Post Event's own presets, a picked preset becomes its own tile
 *    and its own canvas section (the DRAFT preview), and Earlier moves it.
 * ✅ It leaves the event as it found it: the scene it adds, it removes again —
 *    both are DRAFT edits, and it never presses Apply.
 * ⛔ It does not prove Apply's Pro gate. The owner's account is `is_internal`
 *    and passes every paid gate, so "a free couple's new scene is held at
 *    Apply" is proven by `lib/post-event-draft.test.ts`, not here.
 * ⛔ It does not prove the after-the-day compile (a future-dated event cannot
 *    have happened); `lib/post-event-is-many-small-scenes.test.ts` holds that
 *    the compile fills the same keys.
 */

const STATE = process.env.E2E_OWNER_STATE;
const EVENT_ID = process.env.E2E_EVENT_ID;

for (const [name, size] of [
  ['375×812', { width: 375, height: 812 }],
  ['390×844', { width: 390, height: 844 }],
] as const) {
  test.describe(`Post Event scenes · phone ${name}`, () => {
    // Not `devices[…]`: it carries `defaultBrowserType`, which a describe
    // group may not set (it forces a new worker and fails the whole file).
    test.use({
      userAgent: devices['Pixel 5'].userAgent,
      deviceScaleFactor: 2,
      viewport: size,
      isMobile: true,
      hasTouch: true,
      ...(STATE ? { storageState: STATE } : {}),
    });

    test('before the day: the scenes are listed, a preset is added, moved and shown in the draft preview', async ({ page }) => {
      test.skip(!STATE || !EVENT_ID, 'needs E2E_OWNER_STATE (the owner’s signed-in state) and E2E_EVENT_ID (a future-dated event)');
      test.setTimeout(120_000);

      await page.goto(`/dashboard/${EVENT_ID}/launch?stage=editorial`);
      const tiles = page.locator('[data-maker-post-event]');
      await expect(tiles.first()).toBeVisible({ timeout: 30_000 });
      // Many small scenes — never the one "The story after the day" tile.
      expect(await tiles.count()).toBeGreaterThanOrEqual(18);
      await expect(page.locator('[data-maker-fixed="editorial"]')).toHaveCount(0);
      // Before the day a scene that fills itself from the day says "Not yet"…
      await expect(page.locator('[data-maker-status="waiting"]').first()).toBeVisible();
      // …and its panel says what will fill it.
      await page.locator('[data-maker-post-event="gallery"]').tap();
      await expect(page.locator('[data-post-event-waiting]')).toBeVisible();

      // "+ Add a scene" on Post Event offers Post Event's own presets.
      const before = await tiles.count();
      await page.getByRole('button', { name: '+ Add a scene' }).tap();
      await expect(page.locator('[data-post-event-presets]')).toBeVisible();
      await page.locator('[data-post-event-preset="thank_you"]').tap();
      await expect(tiles).toHaveCount(before + 1, { timeout: 30_000 });
      const mine = page.locator('[data-maker-post-event^="custom:"]').last();
      const key = await mine.getAttribute('data-maker-post-event');
      expect(key).toMatch(/^custom:[a-z0-9]+$/);

      // It is its own section in the canvas — the host's draft preview.
      const canvas: FrameLocator = page.frameLocator('iframe[title^="Your Event Hub"]');
      await expect(canvas.locator(`[data-maker-section="p:${key}"]`)).toHaveCount(1, { timeout: 30_000 });

      // Earlier moves it up one place in the navigator.
      const order = async (p: Page) => p.locator('[data-maker-post-event]').evaluateAll((els) => els.map((e) => e.getAttribute('data-maker-post-event')));
      const was = await order(page);
      await page.locator(`[data-maker-post-event="${key}"]`).tap();
      await page.locator('[data-post-event-move="earlier"]').tap();
      await expect.poll(async () => (await order(page)).indexOf(key), { timeout: 30_000 }).toBeLessThan(was.indexOf(key));

      // Leave it as it was found — remove the scene (a draft edit), never Apply.
      await page.locator(`[data-maker-post-event="${key}"]`).tap();
      await page.locator('[data-post-event-remove]').tap();
      await expect(page.locator(`[data-maker-post-event="${key}"]`)).toHaveCount(0, { timeout: 30_000 });
    });
  });
}
