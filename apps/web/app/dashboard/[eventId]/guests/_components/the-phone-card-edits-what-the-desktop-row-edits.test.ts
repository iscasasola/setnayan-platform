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
    bodyOf('GuestCard').includes('return ('),
    'bodyOf stopped short of the function body',
  );
});

test('every chip the desktop row can edit, the phone card can edit', () => {
  const desktop = bodyOf('DesktopRow');
  const card = bodyOf('GuestCard');
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
      card.includes(`<${editor}`),
      `GuestCard has no ${editor}: the same chip is a control on a desktop and ` +
        'inert on a phone',
    );
  }
});

test('no chip in the phone card is rendered as a bare pill', () => {
  // The defect's exact shape: the atom present, its editor absent. Assert the
  // atoms only ever appear as an editor's child.
  const card = bodyOf('GuestCard');
  assert.ok(
    /<SideChipEditor[\s\S]*?<SidePill[\s\S]*?<\/SideChipEditor>/.test(card),
    'SidePill must render INSIDE SideChipEditor, not beside it',
  );
  assert.ok(
    /<RoleChipEditor[\s\S]*?<RoleChips[\s\S]*?<\/RoleChipEditor>/.test(card),
    'RoleChips must render INSIDE RoleChipEditor',
  );
});

test('a phone can put a guest BACK in a group it took them out of', () => {
  // GroupChipList carries the remove form. Mounting it without its counterpart
  // is a one-way door: the association is destroyed and cannot be restored from
  // the same screen.
  const card = bodyOf('GuestCard');
  assert.ok(
    card.includes('<GroupChipList'),
    'the card must still show which groups a guest is in',
  );
  assert.ok(
    card.includes('<AddToGroupControl'),
    'remove-without-add is a one-way door on the only screen a phone host has',
  );
});

test('the phone offers the SAME role sections as the desktop row', () => {
  // A second, phone-only role list would be a second source of truth for which
  // roles exist. Both must read the one `bulkRoleSections` the bulk bar uses.
  assert.ok(
    /roleSections=\{bulkRoleSections\}/.test(bodyOf('GuestCard')),
    'GuestCard must pass the shared sections, not a list of its own',
  );
  assert.ok(
    /bulkRoleSections=\{bulkRoleSections\}/.test(bodyOf('MobileGridItem')),
    'MobileGridItem must forward the sections it was handed',
  );
  const callSite = /<MobileGridItem[\s\S]*?\/>/.exec(SRC)?.[0] ?? '';
  assert.ok(
    /bulkRoleSections=\{bulkRoleSections\}/.test(callSite) &&
      /groups=\{groups\}/.test(callSite),
    'the grid call site must thread groups + bulkRoleSections down',
  );
});

test('the couple lock is untouched — it stays in RoleChipEditor', () => {
  // Wrapping the phone's chip must not fork the gate. GuestCard must NOT spell
  // its own bride/groom condition; RoleChipEditor owns it (and is pinned by
  // the-locked-chip-answers-for-itself.test.ts).
  const card = bodyOf('GuestCard');
  assert.equal(
    /guest\.role === 'bride'/.test(card),
    false,
    'GuestCard is re-implementing the couple gate — one copy, in the editor',
  );
});
