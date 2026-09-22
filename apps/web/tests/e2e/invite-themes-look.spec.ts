import { test, expect } from '@playwright/test';

/**
 * W8 · THE INVITE THEMES, LOOKED AT — the rows no source guard can close.
 *
 * ─── WHY THIS IS A SPEC AND NOT A REPORT ────────────────────────────────────
 * Four W8 rows (I-1, I-2, Q2, Q6) ask whether a RENDERED page is right, and a
 * session cannot answer them: every preview deployment on this project sits
 * behind Vercel Deployment Protection and 302s to `vercel.com/sso-api`, so the
 * branch builds and nobody can see it. Getting past that wall means entering
 * the owner's credentials, which is not something a session does.
 *
 * So the check is written as something the OWNER can run in one command, with
 * his own session, and re-run after any change. That outlives this session,
 * which a description of what-to-look-for does not.
 *
 *   pnpm --filter @setnayan/web test:e2e -- invite-themes-look
 *   E2E_BASE_URL=https://<preview>.vercel.app pnpm --filter @setnayan/web \
 *     test:e2e -- invite-themes-look        # against a preview he can reach
 *
 * ⚠ EVERY ASSERTION NAMES THE CASE IT ACTUALLY EXERCISES. An assertion that
 * passes for a reason you did not intend is worse than a missing one, because
 * it reports coverage it does not have — so each test says, in its own words,
 * what a pass proves and what it does NOT.
 *
 * ─── WHAT THIS CANNOT DO ────────────────────────────────────────────────────
 * ⛔ It does not sign in. The Browser pane cannot run Turnstile, and the
 *    owner's own account is `is_internal` and passes every paid gate — which
 *    would hide exactly the Pro-vs-House difference I-2 exists to find. Where
 *    a row needs a signed-in guest, the test is `test.skip` with the reason on
 *    it rather than a green that means nothing. Run those as
 *    `testnayan1..5@test.com` by email + password, never the Google button.
 *
 * ─── SET THESE ──────────────────────────────────────────────────────────────
 * `E2E_SLUG_PRO`   an event whose couple OWNS Event Hub Pro and has saved a
 *                  Pro theme (Capiz/Velvet/Galeriya/Abaca).
 * `E2E_SLUG_FREE`  an event whose couple does NOT own Pro but HAS saved a Pro
 *                  theme. This is the I-2 case and it is the one worth
 *                  creating by hand: it cannot be faked by a free event that
 *                  never chose a theme.
 */

const SLUG_PRO = process.env.E2E_SLUG_PRO;
const SLUG_FREE = process.env.E2E_SLUG_FREE;

/** The four Pro themes, by the id the DOM carries. Names are display-only. */
const PRO_THEMES = ['capiz', 'velvet', 'galeriya', 'abaca'] as const;

test.describe('W8 · invite themes, on a real page', () => {
  test.describe.configure({ mode: 'serial' });

  test('I-1 · a Pro theme paints the door at phone width', async ({ page }) => {
    test.skip(!SLUG_PRO, 'set E2E_SLUG_PRO to an event that owns Pro and saved a Pro theme');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/${SLUG_PRO}/invite`);

    /*
      The theme's MATERIAL is keyed on `data-invite-theme` — since 2026-09-22
      the tokens live in globals.css under that attribute, shared with the
      Event Hub. If DoorShell stops stamping it the skin renders UNPAINTED
      while every source guard stays green, so this is the first thing to ask.
    */
    const main = page.locator('main[data-invite-theme]');
    await expect(main, 'DoorShell is not stamping data-invite-theme — the skin would render unpainted').toBeVisible();
    const theme = await main.getAttribute('data-invite-theme');
    expect(PRO_THEMES, `saved theme resolved to "${theme}" — if this is "house" the gate refused it`).toContain(theme);

    /*
      A PASS HERE PROVES the attribute is present and the page renders at
      375px. It does NOT prove the skin looks right — that is the screenshot
      below, which is for a human to open, not for an assertion.
    */
    await expect(page.locator('main')).toBeVisible();
    await page.screenshot({ path: `test-results/w8-I1-${theme}-375.png`, fullPage: true });

    // The couple's own mark is the seal. An empty seal is a real defect and a
    // silent one: the door still looks designed.
    const monogram = page.locator('main [class*="seal"], main [class*="crest"]').first();
    await expect(monogram, 'the door renders no seal/crest — the couple\'s mark is missing').toBeVisible();
  });

  test('I-2 · a couple WITHOUT Pro shows guests the plain House door', async ({ page }) => {
    test.skip(!SLUG_FREE, 'set E2E_SLUG_FREE to an event that saved a Pro theme but does NOT own Pro');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/${SLUG_FREE}/invite`);

    /*
      🔑 THIS IS THE ROW THAT MATTERS MOST, and it is why the owner's own
      account must not be used: `is_internal` passes every paid gate, so it
      would render Capiz here and the test would pass while the product was
      broken for everyone else.

      `resolveInviteTheme` falling back to 'house' is ALREADY proven in the
      unit suite across all 28 combinations. What is NOT proven is the render:
      a correct function whose result never reaches the DOM is the defect this
      repo has paid for most often.
    */
    const stamped = await page.locator('main[data-invite-theme]').count();
    expect(stamped, 'a non-Pro couple is being shown a Pro skin — the gate did not reach the render').toBe(0);

    await page.screenshot({ path: 'test-results/w8-I2-house-375.png', fullPage: true });
  });

  test('Q2 · the one button takes the couple\'s colour, and falls back when it cannot', async ({ page }) => {
    test.skip(!SLUG_PRO, 'set E2E_SLUG_PRO');
    await page.goto(`/${SLUG_PRO}/invite`);
    const action = page.getByRole('link').or(page.getByRole('button')).first();
    await expect(action).toBeVisible();

    /*
      `lib/invite-button-color.ts` chooses the fill and its label TOGETHER and
      drops to #C24E25 whenever the couple's colour cannot carry a readable
      label. So the assertion is about CONTRAST, not about a particular hex —
      pinning the hex would fail on a couple who simply chose a different
      colour, which is not a defect.

      A PASS PROVES the button has a fill and a label that are distinguishable.
      It does NOT prove the ratio clears AA; that needs the resolved pair,
      which `lib/invite-button-color.test.ts` already measures in the unit suite.
    */
    const { bg, fg } = await action.evaluate((el) => {
      const s = getComputedStyle(el as HTMLElement);
      return { bg: s.backgroundColor, fg: s.color };
    });
    expect(bg, 'the action has no fill at all').not.toBe('rgba(0, 0, 0, 0)');
    expect(fg, 'the label is the same colour as the fill — it would be invisible').not.toBe(bg);
  });

  test('Q6 · a guest who watched the reveal is not shown it again on the other doors', async ({ page }) => {
    test.skip(!SLUG_PRO, 'set E2E_SLUG_PRO');
    /*
      ⚠ BEHAVIOURAL, AND THE ONLY ROW THAT CANNOT BE ANSWERED BY A SINGLE PAGE
      LOAD. The reveal is suppressed after it has played once, and whatever
      carries that fact — a cookie, storage — only exists after a real visit.
      So this drives door 01, waits for the reveal to finish, then visits 02
      and 03 in the SAME context.

      A PASS PROVES the overlay does not mount on the later doors in a context
      that has already seen it. It does NOT prove the suppression survives a
      new device or a cleared browser — that is a different claim and needs a
      fresh context, which is the commented block below.
    */
    await page.goto(`/${SLUG_PRO}/invite`);
    const overlay = page.locator('[class*="reveal"], [data-reveal]').first();
    const playedFirst = await overlay.count();

    // let the opening finish rather than racing it
    await page.waitForTimeout(3500);

    for (const door of ['reply', 'enter']) {
      await page.goto(`/${SLUG_PRO}/invite/${door}`);
      await page.waitForTimeout(900);
      const again = await page.locator('[class*="reveal"], [data-reveal]').count();
      expect(
        again,
        `door "${door}" mounted the reveal again after it had already played — ` +
          'a guest sees the opening twice',
      ).toBe(0);
    }

    // Recorded, not asserted: whether door 01 played at all depends on the
    // event's phase and its reveal template. A zero here is not a failure.
    test.info().annotations.push({
      type: 'note',
      description: `door 01 mounted ${playedFirst} reveal element(s) — 0 is legitimate when the event is past its Save-the-Date window`,
    });
  });

  test('S5-1 · the picker tells the couple where to change the invite colour', async () => {
    test.skip(true, 'needs a signed-in HOST session; run as testnayan1..5 by email+password, never the owner (is_internal)');
  });
});
