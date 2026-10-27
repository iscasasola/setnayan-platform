/**
 * a-foldable-header-is-marked-by-its-chip.test.ts — 🪗 ONE MARK FOR EVERY FOLDABLE HEADER (`.sn-acc-head`, globals.css).
 *
 * Owner, 2026-10-27 (DECISION_LOG "APPROVED — FOLDABLE HEADERS ARE MARKED BY THE ICON CHIP", verbatim *"1"*; it
 * supersedes the closed/open tint and the full-width band rows — the prototype's tints are NOT built): the round icon
 * chip is soft grey when the group is CLOSED and solid terracotta with a white icon when it is OPEN; one thin divider
 * under each header; NO background band or tint; the same pinned; dark mode keeps the contrast. One shared class, so
 * Suppliers and every other foldable header adopt it later; Guests wears it first.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-10-28, see the PR body): `data-open` written on every header; the open
 * chip's ink → the accent (icon invisible on its own colour); a tint background added to `.sn-acc-head`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guestRow, renderGuestsScreen } from '@/app/dashboard/[eventId]/guests/_components/render-guests-screen';

const WEB = join(__dirname, '..');
const GLOBALS = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
/** Every rule whose selector list mentions `.sn-acc-head`, joined (selector + body). */
const accRules = [...GLOBALS.matchAll(/([^{}]*\.sn-acc-head[^{}]*)\{([^}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }));
const rule = (sel: string) => accRules.find((r) => r.sel.split('\n').pop()!.trim() === sel)?.body ?? '';

test('Guests: every group header wears the mark — data-open on the OPEN one only, the chip on its icon', async () => {
  const guests = [
    guestRow({ role: 'bride', rsvp_status: 'attending' }),
    guestRow({ role: 'groom', side: 'groom', rsvp_status: 'attending' }),
    guestRow({ role: 'guest' }),
    guestRow({ role: 'principal_sponsor' } as never),
  ];
  const html = await renderGuestsScreen({ guests });
  const heads = [...html.matchAll(/<section\b[^>]*data-open="(true|false)"[^>]*>\s*<div class="([^"]*)"([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.ok(heads.length >= 2, 'the fixture drew fewer than two groups — re-aim');
  assert.ok(heads.some((h) => h[1] === 'true') && heads.some((h) => h[1] === 'false'), 'no open AND closed group to compare');
  for (const [, open, cls, attrs, inner] of heads) {
    assert.match(cls!, /\bsn-acc-head\b/, 'a group header does not wear the shared mark');
    assert.equal(/\bdata-open=""/.test(attrs!), open === 'true', `a ${open === 'true' ? 'open' : 'closed'} header says the opposite`);
    assert.match(inner!, /aria-expanded="(true|false)"/);
    assert.equal(/aria-expanded="true"/.test(inner!), open === 'true', 'data-open and aria-expanded disagree');
    assert.match(inner!, /<span class="[^"]*\bsn-acc-chip\b[^"]*" aria-hidden="true">/, 'the icon is not the chip');
  }
});

test('the mark: grey chip closed, terracotta chip + white icon open, a divider under, NO band — light and dark', () => {
  const closed = rule('.sn-acc-head');
  assert.match(closed, /--sn-acc-chip: rgb\(var\(--color-ink\) \/ 0\.0\d\);/, 'the closed chip is not a soft grey');
  assert.match(closed, /box-shadow: 0 1px 0 /, 'no divider under the header');
  const open = rule('.sn-acc-head[data-open]');
  assert.match(open, /--sn-acc-chip: rgb\(var\(--sn-accent\)\);/, 'the open chip is not solid terracotta');
  assert.match(open, /--sn-acc-chip-ink: #fff;/, 'the open chip’s icon is not white');
  assert.match(rule('html.dark .sn-acc-head[data-open]'), /--sn-acc-chip-ink: #fff;/, 'dark: the open icon loses its contrast');
  assert.match(rule('html.dark .sn-acc-head'), /--sn-acc-chip: rgb\(var\(--color-ink\) \/ 0\.1\d\);/, 'dark: the closed chip is not lifted');
  const chip = rule('.sn-acc-head .sn-acc-chip');
  assert.match(chip, /--disc: var\(--sn-acc-chip\);/);
  assert.match(chip, /color: var\(--sn-acc-chip-ink\);/);
  // NO band: nothing in the mark paints the header's own ground (the prototype's tints are superseded).
  for (const r of accRules) {
    if (/\.sn-acc-chip/.test(r.sel)) continue;
    assert.doesNotMatch(r.body, /background|color-mix/, `"${r.sel}" paints a band — the approved mark is the chip alone`);
  }
  // Unlayered (written after the last @layer block closes), so a screen module's own chip colour cannot beat it.
  const at = GLOBALS.indexOf('.sn-acc-head {');
  assert.ok(at > GLOBALS.lastIndexOf('@layer'), 'the mark sits inside a layer — an unlayered module rule would win');
});
