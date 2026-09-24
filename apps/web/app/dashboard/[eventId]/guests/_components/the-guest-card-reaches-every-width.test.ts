/**
 * the-guest-card-reaches-every-width.test.ts — a component does not decide its
 * own reach; its MOUNT does.
 *
 * ── What this file used to say, and why it was right then ──────────────────
 * It was `the-quick-view-is-not-on-phones.test.ts`. `guest-drawer.tsx` called
 * itself "the mobile / below-xl QUICK-VIEW guest SHEET" from the day it
 * shipped, and it was not reachable on a phone: the only thing that opened it
 * was `QuickViewButton`, the only place that rendered it was `DesktopRow`, and
 * that row lives inside a `hidden … lg:block` table. Measured on the shipped
 * page: 0 visible triggers at 375px, 4 at 768px.
 *
 * On 2026-09-06 a session added a destructive control to that sheet, reasoned
 * about it as a PHONE hazard — "a panel a host opens casually while scanning a
 * roster" — and reported that severity to the owner. It was wrong, and the
 * source of the error was the file's own name for itself. Nothing in the type
 * system, the tests or CI disagreed, because none of them read prose.
 *
 * ── INVERTED 2026-09-22, deliberately ───────────────────────────────────────
 * The premise is now FALSE ON PURPOSE. The quick view and the edit form merged
 * into one card that `InspectorLayout mobileSheet` presents at EVERY width —
 * owner: *"can we just open all of these in one pop up (mobile)"*. So the sheet
 * IS on phones now, and a guard still asserting it is not would be a guard
 * defending a retired decision.
 *
 * 🔑 The lesson survives the inversion, which is why this file was inverted
 * rather than deleted: the reach is pinned to the MOUNT, not to prose. What
 * changed is which answer the mount must give. If somebody re-confines the card
 * to the desktop table, these go red and the claim above must be revisited in
 * the same commit.
 *
 * 🛡 Mutation-checked against the real files, failures counted, each RED:
 *  · make the trigger bail below xl again                    → RED
 *  · drop `mobileSheet` from the roster's InspectorLayout     → RED
 *  · make the phone row navigate to the route instead         → RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(HERE, f), 'utf8');

/** Code only — the mount assertions must not be satisfied by prose. */
const LIST = stripComments(read('guest-list-multiselect.tsx'));
const TRIGGER = stripComments(read('guest-drawer.tsx'));
const ROSTER = stripComments(readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8'));
const INSPECTOR = stripComments(
  readFileSync(
    resolve(HERE, '..', '..', '..', '..', '_components', 'inspector', 'inspector-column.tsx'),
    'utf8',
  ),
);

test('the roster asks for the phone sheet — that is what puts the card on a phone', () => {
  // Without this one prop the rail is hidden below xl and every trigger falls
  // back to navigating away, which is the behaviour this build replaced.
  assert.ok(
    /mobileSheet/.test(ROSTER),
    'the roster no longer opts into the phone sheet — a name tap leaves the list again',
  );
  assert.ok(
    /sheet: mobileSheet/.test(INSPECTOR),
    'the layout no longer tells its triggers it presents below xl',
  );
});

test('a trigger selects at EVERY width, not only on desktop', () => {
  // 🪤 The old bug shape, inverted: `!isXl` alone sent a phone to a route. Both
  // the row name and the eye must consult the sheet flag as well.
  assert.ok(
    /isXl \|\| ctx\.sheet/.test(TRIGGER),
    'the eye still bails below xl — on a phone it would do nothing at all',
  );
  const selects = INSPECTOR.match(/isXl \|\| ctx\.sheet/g) ?? [];
  assert.equal(
    selects.length,
    2,
    `both InspectorTrigger branches (the button form and the link form) must ` +
      `consult the sheet flag; found ${selects.length}`,
  );
});

test('the phone row still reaches the card, through the name', () => {
  // The eye lives in the desktop table only, which is fine — on a phone the row
  // itself is the trigger. What must NOT happen is a phone row with no way in.
  assert.ok(
    /<InspectorTrigger/.test(LIST),
    'the roster no longer uses the inspector trigger at all',
  );
  const mounts = LIST.match(/<QuickViewButton/g) ?? [];
  assert.equal(
    mounts.length,
    1,
    `expected one <QuickViewButton> mount, found ${mounts.length}`,
  );
});
