/**
 * the-locked-chip-answers-for-itself.test.ts — a protected chip must not read
 * as a broken one.
 *
 * On a Living Roster row every chip opens a picker: side, role, RSVP, groups.
 * Two of them don't, for the bride and groom — their role is fixed and their
 * RSVP is pinned to Attending, because they are the foundation of the event
 * (owner 2026-06-03, reaffirmed 2026-09-05: "only non bride and groom can be
 * changed"). That lock is correct.
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 * Those two chips rendered as PLAIN pills — `return <>{children}</>`. Not
 * disabled, not greyed, not captioned, no cursor change: visually identical to
 * the editable chips one column over. Tapping did nothing whatsoever. A host
 * who taps "Bride" to change a role gets silence, and silence in a row where
 * everything else opens a popover reads as a defect in the page, not as a rule
 * about the event. It cost a round of "the role cell doesn't work" before
 * anyone could see the cell was doing exactly what it was told.
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * 1 · THE LOCK HOLDS. No role picker, no RSVP picker for bride/groom — this
 *   file must never be the reason that gate loosens. The guard below asserts
 *   the early return still fires BEFORE any picker is reachable.
 * 2 · THE TAP IS ANSWERED. Both locked branches go through `LockedChip`, which
 *   is a real button carrying an explanation.
 * 3 · IT IS A DIALOG, NOT A MENU. `aria-haspopup="menu"` promises choosable
 *   items; nothing here is choosable.
 *
 * 🛡 Mutation-checked against the real file, failures counted, each RED:
 *  · restore `return <>{children}</>` in the role branch  → 0 → 1 failing · RED
 *  · restore it in the RSVP branch                        → 0 → 1 failing · RED
 *  · switch LockedChip to aria-haspopup="menu"            → 0 → 1 failing · RED
 *  · delete the bride/groom early return from RoleChipEditor (the lock itself)
 *                                                         → 0 → 3 failing · RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'chip-editors.tsx'), 'utf8'));

/**
 * The BODY of a named function declaration. Every editor here destructures its
 * props, so the first `{` after the name opens the PARAMETER list — matching
 * from it returns the signature and every assertion then passes for the wrong
 * reason. Walk the parens out first.
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
  const body = bodyOf('RoleChipEditor');
  assert.ok(body.includes('return ('), 'bodyOf stopped short of the function body');
});

test('THE LOCK HOLDS — bride & groom still get no picker', () => {
  const role = bodyOf('RoleChipEditor');
  assert.ok(
    /guest\.role === 'bride' \|\| guest\.role === 'groom'/.test(role),
    'the couple must still short-circuit before the role picker is reachable',
  );
  const rsvp = bodyOf('RsvpChipEditor');
  assert.ok(
    /rsvpLocked\(guest\)/.test(rsvp),
    'the couple RSVP must still short-circuit before the RSVP picker',
  );
  assert.ok(
    /return guest\.role === 'bride' \|\| guest\.role === 'groom';/.test(
      bodyOf('rsvpLocked'),
    ),
    'rsvpLocked must keep naming the couple — it is the whole gate',
  );
});

test('THE TAP IS ANSWERED — neither locked branch returns a bare pill', () => {
  for (const name of ['RoleChipEditor', 'RsvpChipEditor']) {
    const body = bodyOf(name);
    assert.ok(
      /<LockedChip/.test(body),
      `${name}: the locked branch must explain itself, not swallow the tap — ` +
        'a plain pill among editable chips reads as a broken cell',
    );
    assert.equal(
      /return <>\{children\}<\/>;/.test(body),
      false,
      `${name} still has the silent early return this file exists to remove`,
    );
  }
});

test('LockedChip is a real button, and a dialog rather than a menu', () => {
  const chip = bodyOf('LockedChip');
  assert.ok(/<button/.test(chip), 'a non-focusable span cannot answer a tap');
  assert.ok(
    /aria-haspopup="dialog"/.test(chip),
    'nothing in this popover is choosable — "menu" promises items that do not exist',
  );
  assert.equal(
    /aria-haspopup="menu"/.test(chip),
    false,
    'menu semantics on a panel with no menuitems',
  );
  assert.ok(/{reason}/.test(chip), 'the popover must actually render the reason');
});

test('the reason names the guest and the role — not a generic string', () => {
  // "This cannot be changed" is the same silence with extra words. Both reasons
  // must interpolate who and what.
  for (const name of ['RoleChipEditor', 'RsvpChipEditor']) {
    const body = bodyOf(name);
    const reason = /reason=\{`([^`]*)`\}/.exec(body)?.[1] ?? '';
    assert.ok(reason.length > 0, `${name} passes no reason text`);
    assert.ok(
      reason.includes('${name}') || reason.includes('${ROLE_LABELS[guest.role]}'),
      `${name}: the reason must name this guest or their role, not read generically`,
    );
  }
});
