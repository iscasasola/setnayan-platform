import { test, expect, type Page } from '@playwright/test';

/**
 * EVERY PRESSABLE ON THE PUBLIC TOP BAR PRESSES 44 PX — measured by pressing.
 *
 * Quality sweep 2026-10-19, row B2: on every public page the signed-out bar
 * (☰ Menu · the Setnayan wordmark · Sign in, and on a phone the search row
 * beneath it — the field and its Search button) measured under 44 px by
 * bounding box — Menu 40×40, Sign in 72×36,
 * the field and its button 42 tall.
 *
 * 🔑 THE LOCK IS A FLOOR ON THE PRESS, NEVER ON THE PAINT (see
 * `front-door-geometry.test.ts`). Four of those five already pressed 44+
 * through an `::after` expander — a bounding box cannot see one — but the
 * search FIELD could not: an <input> renders no pseudo-element, and the box's
 * two 1px borders belonged to the <form>, so a tap on either edge focused
 * nothing. So this does not read a box. It presses: for every visible link,
 * button and field in the bar it walks a line through the control's centre,
 * both ways, in 0.25 px steps, and counts the points `elementFromPoint` hands
 * back to that control. A new control added to the bar is measured the day it
 * lands; a paint change that keeps the press passes; a press that shrinks
 * fails, whatever it looks like.
 *
 * Touch only (`pointer: coarse` — the precondition is asserted, not assumed):
 * the 44 px lock is for fingers, and with a mouse the drawing's 40 px field is
 * the design.
 */

const FLOOR = 44;
const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

type Press = { name: string; tall: number; wide: number };

async function presses(page: Page): Promise<Press[]> {
  return page.evaluate(() => {
    // Below 701px the bar is TWO rows: the header, and `.fd-searchrow` beneath
    // it carrying the search (the header's own copy is display:none there).
    const PRESSABLE = 'a[href], button, input:not([type=hidden]), [role=button]';
    const out: { name: string; tall: number; wide: number }[] = [];
    for (const e of document.querySelectorAll<HTMLElement>(
      `header.fd-topbar :is(${PRESSABLE}), .fd-searchrow :is(${PRESSABLE})`,
    )) {
      const r = e.getBoundingClientRect();
      if (!e.getClientRects().length || r.width < 1 || getComputedStyle(e).visibility === 'hidden') continue;
      const mine = (x: number, y: number) => {
        const h = document.elementFromPoint(x, y);
        return !!h && (h === e || e.contains(h));
      };
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let tall = 0;
      for (let y = r.top - 12; y <= r.bottom + 12; y += 0.25) if (mine(cx, y)) tall += 0.25;
      let wide = 0;
      for (let x = r.left - 12; x <= r.right + 12; x += 0.25) if (mine(x, cy)) wide += 0.25;
      const name = (e.getAttribute('aria-label') || e.textContent || e.tagName).replace(/\s+/g, ' ').trim();
      out.push({ name, tall, wide });
    }
    return out;
  });
}

for (const size of SIZES) {
  test(`the signed-out top bar presses ${FLOOR}px everywhere at ${size.width}px, by touch`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('header.fd-topbar')).toBeVisible();

    expect(
      await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
      'the browser is not reporting a coarse pointer — this would measure the mouse design, not the touch lock',
    ).toBe(true);

    const all = await presses(page);
    // The anchor: the signed-out bar's five controls were all found and measured.
    const names = all.map((p) => p.name);
    for (const want of ['Menu', 'Setnayan', 'Search Setnayan', 'Search', 'Sign in']) {
      expect(names, `the bar's "${want}" control was not found — the measurement would be vacuous`).toContain(want);
    }

    // One 0.25px sample of slack: a region exactly 44px tall reads 44 or 43.75
    // depending on where the samples fall against its edges. The field this was
    // written for read 42.75 before its fix.
    const under = all.filter((p) => p.tall < FLOOR - 0.25 || p.wide < FLOOR - 0.25);
    expect(under, `top-bar controls that press under ${FLOOR}px: ${JSON.stringify(under)}`).toEqual([]);
    await ctx.close();
  });
}
