import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

/**
 * ↔ TODAY'S PINNED ROW NEVER BLEEDS PAST THE GUTTER IT SITS IN (walk 2026-11-01).
 *
 * 🔁 RE-AIMED 2026-11-08 (THE ONE BUILD A5): `TodayCounts` is retired; the element that pulls out to the page edge now
 * is Today's COVER (`today-cover.tsx`, `data-today-cover`) — the same negative margins, the same property.
 *
 * `TodayCounts` (the sticky "Today · 7 waiting · 2 this week…" row) pulls itself out to the page edge with negative
 * margins (`-mx-4 sm:-mx-6`). That is right only while the box around it pads at least as much at every width. The
 * spotlight tour's supplier Today (`/dev/spotlight-lab/vendor-dashboard`, drawn through `/dev/supplier-lab?easy=…`)
 * wrapped the screen in `px-4` alone, so from `sm` the row stuck 8 px past the window and the page measured 1288 px
 * wide at 1280 — a sideways scroll under the tour's "Date change request" step.
 *
 * Property, per breakpoint (mobile-first cascade, base → sm → lg): the row's bleed ≤ the padding of every box that
 * draws Today — the shipped page and the lab.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) =>
  stripComments(readFileSync(join(here, rel), 'utf8'));

const BREAKPOINTS = ['', 'sm:', 'lg:'] as const;

/** The value in effect at each breakpoint for a spacing utility (`px` or `-mx`), cascading mobile-first. */
function cascade(classes: string, util: 'px' | '-mx'): number[] {
  let current = 0;
  return BREAKPOINTS.map((bp) => {
    const re = new RegExp(`(?:^|\\s)${bp.replace(':', '\\:')}${util.replace('-', '\\-')}-(\\d+(?:\\.\\d+)?)(?=\\s|$)`);
    const m = classes.match(re);
    if (m) current = Number(m[1]);
    return current;
  });
}

function classOf(src: string, marker: RegExp, what: string): string {
  const m = src.match(marker);
  assert.ok(m, `could not find ${what}`);
  return m[1]!;
}

const pin = classOf(read('today-cover.tsx'), /data-today-cover=""[\s\S]{0,80}?className="([^"]*)"/, 'Today’s cover');
const bleed = cascade(pin, '-mx');

const HOSTS = [
  {
    name: 'the shipped Today page (vendor-dashboard/page.tsx)',
    /* The last box opened before the page mounts `<SupplierTodayScreen` — the one Today's row sits in. */
    cls: classOf(read('../page.tsx'), /<div className="([^"]*)">(?:(?!<div className=)[\s\S])*?<SupplierTodayScreen\b/, 'the Today page’s wrapper'),
  },
  {
    name: 'the Today lab (dev/supplier-lab/today-easy-lab.tsx)',
    cls: classOf(read('../../dev/supplier-lab/today-easy-lab.tsx'), /<div className="([^"]*)" data-supplier-lab="today-easy"/, 'the lab’s wrapper'),
  },
];

// RE-AIMED ON PURPOSE (owner 19 Nov, on live Today: "remove the photo of that header" · "it was suppose to look like focus"; Today v3 part 1): the top is a two-line mast that sits INSIDE the
// gutter — it no longer pulls out to the page edge at all. So the property is now the stronger one: no bleed, at any
// width. The host checks below stay (0 ≤ every pad), and fail again the day a negative margin comes back unpadded.
test('Today’s mast does not bleed past its gutter at any width', () => {
  assert.deepEqual(bleed, [0, 0, 0], `the mast pulls out of its gutter again: "${pin}"`);
  assert.match(pin, /\bflex\b/, 'anti-vacuity: the class read is not the mast’s');
});

for (const host of HOSTS) {
  test(`the row never bleeds past ${host.name}`, () => {
    const pad = cascade(host.cls, 'px');
    BREAKPOINTS.forEach((bp, i) => {
      assert.ok(
        bleed[i]! <= pad[i]!,
        `${bp || 'base'}: the row pulls out ${bleed[i]} but ${host.name} pads only ${pad[i]} — a sideways scroll`,
      );
    });
  });
}
