/**
 * the-phone-card-edits-what-the-desktop-row-edits.test.ts — the roster's chips
 * were only editable on a desktop.
 *
 * `DesktopRow` and `GuestCard` render the SAME four chips from the SAME atoms:
 * side, role, RSVP, groups. On the desktop row all four open a picker. On the
 * phone card, two of them — `<SidePill>` and `<RoleChips>` — were rendered raw:
 * identical pixels, no trigger, nothing happens on tap. Not for the couple, for
 * EVERY guest.
 *
 * ── THE ONE THAT WAS WORSE THAN A DEAD TAP ─────────────────────────────────
 * `GroupChipList` ships a remove-from-group form, and the card mounted it. The
 * matching `AddToGroupControl` was never added. So a phone could take a guest
 * OUT of a group and had no way to put one back — the only gap here that
 * DESTROYS an association rather than merely refusing to edit one. A host on a
 * phone could quietly unpick a seating plan they could not restore.
 *
 * ── WHY IT LOOKED FINE ─────────────────────────────────────────────────────
 * The card's content sits under `pointer-events-none` so taps fall through to
 * the stretched detail link; interactive descendants re-enable it explicitly.
 * A raw pill therefore does not feel broken — the tap OPENS THE GUEST. It reads
 * as "this chip isn't a control", not as "this control is missing", which is
 * why it survived the P4 mobile-parity pass that added the RSVP cycle and the
 * seat chip beside it.
 *
 * 🔒 The couple lock is NOT weakened: `RoleChipEditor` owns the bride/groom
 * short-circuit, so wrapping the phone's chips gives a phone exactly what the
 * desktop row gives and nothing more.
 *
 * 🛡 Mutation-checked against the real file, failures counted, each RED:
 *  · unwrap SidePill in GuestCard             → 0 → 2 failing · RED
 *  · unwrap RoleChips in GuestCard            → 0 → 3 failing · RED
 *  · drop AddToGroupControl from GuestCard    → 0 → 2 failing · RED
 *  · stop threading bulkRoleSections at the MobileGridItem call site
 *                                             → 0 → 1 failing · RED (and the
 *    scoped tsc fails too — the prop is required, so this one cannot ship)
 *
 * ⚠ UPDATED 2026-09-20 — THE GRID DENSITY IS RETIRED, THIS FILE IS NOT. Owner:
 * "remove the grid view on guest list. make it same sa row view only."
 * `GuestCard` and `MobileGridItem` are deleted; `MobileListRow` is now the
 * ONLY phone row, so every assertion below moved from `GuestCard`/
 * `MobileGridItem` to `MobileListRow` — same property (a phone offers every
 * editor the desktop row offers), same shape of check, pointed at the
 * component that actually renders on a phone today. `RoleChips` is `RoleTexts`
 * on this row (MB-something's text-not-pill pass) and `SidePill` is dropped in
 * favour of wrapping the avatar itself — both still render INSIDE their editor,
 * which is the property this file was always pinning, not the atom's name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(
  readFileSync(join(HERE, 'guest-list-multiselect.tsx'), 'utf8'),
);

/**
 * The BODY of a named function declaration. Every row here destructures its
 * props, so the first `{` after the name opens the PARAMETER list — matching
 * from it returns the signature, and every assertion below would then pass or
 * fail for the wrong reason. Walk the parens out first.
 */
function bodyOf(name: string): string {
  const at = SRC.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} is gone — this test is pinning a ghost`);
  const lparen = SRC.indexOf('(', at);
  let parens = 0;
  let afterParams = -1;
  for (let i = lparen; i < SRC.length; i += 1) {
    if (SRC[i] === '(') parens += 1;
    else if (SRC[i] === ')') {
      parens -= 1;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  assert.notEqual(afterParams, -1, `unbalanced parens in ${name}`);
  const open = SRC.indexOf('{', afterParams);
  let depth = 0;
  for (let i = open; i < SRC.length; i += 1) {
    if (SRC[i] === '{') depth += 1;
    else if (SRC[i] === '}') {
      depth -= 1;
      if (depth === 0) return SRC.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the extractor reads the BODY, not the destructured props', () => {
  assert.ok(
    bodyOf('MobileListRow').includes('return ('),
    'bodyOf stopped short of the function body',
  );
});

test('every chip the desktop row can edit, the phone row can edit', () => {
  const desktop = bodyOf('DesktopRow');
  const row = bodyOf('MobileListRow');
  for (const editor of [
    'SideChipEditor',
    'RoleChipEditor',
    'RsvpChipEditor',
    'AddToGroupControl',
    'GroupChipList',
  ]) {
    assert.ok(
      desktop.includes(`<${editor}`),
      `DesktopRow lost ${editor} — the parity baseline moved`,
    );
    assert.ok(
      row.includes(`<${editor}`),
      `MobileListRow has no ${editor}: the same chip is a control on a desktop ` +
        'and inert on a phone',
    );
  }
});

test('no chip in the phone row is rendered as a bare pill', () => {
  // The defect's exact shape: the atom present, its editor absent. Assert the
  // atoms only ever appear as an editor's child. MobileListRow wraps the
  // AVATAR (not a SidePill) in SideChipEditor, and RoleTexts (not RoleChips) in
  // RoleChipEditor — different atoms than GuestCard used, same property.
  const row = bodyOf('MobileListRow');
  assert.ok(
    /<SideChipEditor[\s\S]*?<RowAvatar[\s\S]*?<\/SideChipEditor>/.test(row),
    'the avatar must render INSIDE SideChipEditor, not beside it',
  );
  assert.ok(
    /<RoleChipEditor[\s\S]*?<RoleTexts[\s\S]*?<\/RoleChipEditor>/.test(row),
    'RoleTexts must render INSIDE RoleChipEditor',
  );
});

test('a phone can put a guest BACK in a group it took them out of', () => {
  // GroupChipList carries the remove form. Mounting it without its counterpart
  // is a one-way door: the association is destroyed and cannot be restored from
  // the same screen.
  const row = bodyOf('MobileListRow');
  assert.ok(
    row.includes('<GroupChipList'),
    'the row must still show which groups a guest is in',
  );
  assert.ok(
    row.includes('<AddToGroupControl'),
    'remove-without-add is a one-way door on the only screen a phone host has',
  );
});

test('the phone offers the SAME role sections as the desktop row', () => {
  // A second, phone-only role list would be a second source of truth for which
  // roles exist. Both must read the one `bulkRoleSections` the bulk bar uses.
  // There is no longer an outer wrapper forwarding the prop to an inner card —
  // MobileListRow both receives it and hands it straight to RoleChipEditor —
  // so this now pins the one hand-off instead of two.
  assert.ok(
    /roleSections=\{bulkRoleSections\}/.test(bodyOf('MobileListRow')),
    'MobileListRow must pass the shared sections, not a list of its own',
  );
  const callSite = /<MobileListRow[\s\S]*?\/>/.exec(SRC)?.[0] ?? '';
  assert.ok(
    /bulkRoleSections=\{bulkRoleSections\}/.test(callSite) &&
      /groups=\{groups\}/.test(callSite),
    'the call site must thread groups + bulkRoleSections down',
  );
});

test('the couple lock is untouched — it stays in RoleChipEditor', () => {
  // Wrapping the phone's chip must not fork the gate. MobileListRow must NOT
  // spell its own bride/groom role EQUALITY check (RoleChipEditor owns that
  // one, pinned by the-locked-chip-answers-for-itself.test.ts) — distinct from
  // the row's own swipe gate, which spells the couple as `!==`, never `===`.
  const row = bodyOf('MobileListRow');
  assert.equal(
    /guest\.role === 'bride'/.test(row),
    false,
    'MobileListRow is re-implementing the couple gate — one copy, in the editor',
  );
});
