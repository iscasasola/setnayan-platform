/**
 * a-44px-tap-target-is-not-a-44px-ring.test.ts — what is left of it, and the select circles (2026-10-09).
 *
 * 🔴 THE SELECT CIRCLES WERE OVALS (owner, the live guest list: "not round on select guests"; the element he picked:
 * `button.guests-screen_ico__… [data-select-section]`, computed 40 × 44, `border-radius: 50%`). `globals.css` gives every
 * <button> `min-height: 44px`, which beat the circles' 40-px height. The part of this file below the Popover test holds
 * the cure in the module CSS (parsed, not string-matched): every select circle — the group's `.ico`, the guest's `.ava`
 * — is a 44 × 44 BUTTON (the tap target) with a 40 × 40 DISC drawn by `::before` and centred in it, the layout kept at 40
 * by a −2 px margin, the picked ring on the DISC; the icon-only buttons of the thumb row and of a guest row are 40 × 40
 * circles with a halo, and `.acts` leaves the halo room. Seen in a real browser (375 and 750 wide, the dev lab): every
 * select circle 44 × 44 button, 40 × 40 disc; the thumb row's ✕ and ☑ 40 × 40.
 *
 * SABOTAGE (each seen RED, then restored): the `min-height: 0` removed · the button 40 × 40 again · the disc not centred
 * · the picked ring back on the button · the halo of an icon-only button removed · `.acts` without its room.
 *
 * The first half of the file is what was left of the original:
 * It once held two defects found by opening the page: the dashed ellipse on
 * `AddToGroupControl` and `LockedChip`'s panel that contradicted its own
 * trigger. Both lived in `chip-editors.tsx`, which went with the retired
 * GuestListMultiselect (2026-10-09), so their tests went too. What survives is
 * the half that pins a LIVE file: `Popover` (overlay-primitives.tsx) takes a
 * caller-declared role instead of hardcoding `menu` — the guest card's Invite
 * menu and the People roster still mount it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import postcss from 'postcss';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERLAY = stripComments(readFileSync(join(HERE, 'overlay-primitives.tsx'), 'utf8'));

test('Popover lets its caller declare what kind of panel it is', () => {
  assert.ok(
    /role\?: 'menu' \| 'dialog'/.test(OVERLAY),
    'Popover must accept a role rather than hardcoding one',
  );
  assert.ok(
    /role=\{role\}/.test(OVERLAY),
    'the rendered panel must use the passed role',
  );
  assert.equal(
    /role="menu"/.test(OVERLAY),
    false,
    'a hardcoded menu role is what contradicted LockedChip',
  );
  assert.ok(
    /role = 'menu'/.test(OVERLAY),
    'menu stays the DEFAULT — every existing picker relies on it',
  );
});

/* ═══ the select circles ═══ */

const MODULE_CSS = readFileSync(join(HERE, 'guests-screen.module.css'), 'utf8');
const ROOT = postcss.parse(MODULE_CSS);

/** The declarations of the FIRST rule whose selector list contains exactly this selector (whitespace-normalised). */
function rule(selector: string, root: postcss.Root = ROOT) {
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim();
  const found: Record<string, string> = {};
  let hits = 0;
  root.walkRules((r) => {
    if (!r.selectors.some((x) => norm(x) === norm(selector))) return;
    hits += 1;
    r.walkDecls((d) => {
      found[d.prop] = d.value.replace(/\s+/g, ' ').trim();
    });
  });
  assert.ok(hits > 0, `no rule for ${selector} in guests-screen.module.css`);
  return found;
}

test('a select circle is a 44 × 44 tap target with a 40 × 40 disc centred in it — never a 40 × 44 oval', () => {
  for (const sel of ['.ico', '.ava']) {
    const d = rule(sel);
    assert.equal(d['width'], '44px', `${sel}: the button is not the 44-px target`);
    assert.equal(d['height'], '44px', `${sel}: the button is not the 44-px target`);
    assert.equal(d['min-height'], '0', `${sel}: the global 44-px floor is back — a 40-px height would stretch to an oval`);
    assert.equal(d['margin'], '-2px', `${sel}: the layout is no longer 40 × 40`);
    assert.equal(d['isolation'], 'isolate', `${sel}: the disc (z-index −1) must stay inside the button`);
    const disc = rule(`${sel}::before`);
    assert.equal(disc['inset'], '2px', `${sel}: the disc is not centred (44 − 2 × 2 = 40)`);
    assert.equal(disc['z-index'], '-1');
    assert.equal(disc['border-radius'], '50%', `${sel}: the disc is not round`);
    assert.equal(disc['background'], 'var(--disc)', `${sel}: the disc carries the tint`);
  }
  // 44 − 2 × 2 = 40: the disc really is the old circle.
  assert.equal(44 - 2 * 2, 40);
  // The avatar's picture is the disc's size, not the button's.
  const img = rule('.ava img');
  assert.equal(img['width'], '40px');
  assert.equal(img['height'], '40px');
  assert.equal(img['border-radius'], '50%');
});

test('the picked ring and tint belong to the DISC — a ring on the 44-px button would be an oval', () => {
  for (const sel of ['.ico.picked::before', '.g.picked .ava::before']) {
    const d = rule(sel);
    assert.match(d['outline'] ?? '', /^2px solid var\(--gs-brand\)$/, `${sel}: the picked ring is gone`);
  }
  for (const sel of ['.ico.picked', '.g.picked .ava']) {
    const d = rule(sel);
    assert.equal(d['outline'], undefined, `${sel}: the ring is on the button again (an oval)`);
    assert.match(d['--disc'] ?? '', /gs-brand/, `${sel}: the picked tint is not the disc's`);
  }
});

test('an icon-only button is a 40 × 40 circle with a halo, and its group leaves the halo room', () => {
  for (const sel of [".thumb :global(.ab.icon-only)", "[data-row-state='icon'] .thumb :global(.ab):not(.grow)", "[data-row-state='icon'] .acts :global(.ab)"]) {
    const d = rule(sel);
    assert.equal(d['min-height'], '0', `${sel}: stretched to an oval by the global 44-px floor`);
    assert.equal(d['position'], 'relative', `${sel}: the halo has nothing to hang on`);
    const halo = rule(`${sel}::after`);
    assert.equal(halo['inset'], '-3px', `${sel}: the halo is not 3 px (40 − 2 × 1px border + 2 × 3px = 44)`);
    assert.equal(halo['border-radius'], 'var(--m-r-full)');
  }
  assert.equal(rule(".thumb :global(.ab.icon-only)")['min-height'], '0');
  const acts = rule('.acts');
  assert.equal(acts['padding'], '2px 0', '.acts clips its overflow: a halo needs room, or it is cut');
  assert.equal(acts['margin'], '-2px 0', 'the room must not move the layout');
});
