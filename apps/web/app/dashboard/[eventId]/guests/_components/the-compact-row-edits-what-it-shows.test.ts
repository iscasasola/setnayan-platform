/**
 * the-compact-row-edits-what-it-shows.test.ts — the density toggle stopped
 * changing what the host is allowed to do.
 *
 * `?density=list` swaps the phone's photo grid for `MobileListRow`. That row was
 * built as avatar / name / RSVP / seat — no side, no role, no groups, not even
 * shown. So a host who preferred the denser view could set an RSVP and nothing
 * else, while the identical guest one tap away (grid density) could be
 * re-sided, re-roled and re-grouped. A *display preference* decided which
 * fields existed.
 *
 * That is the same defect this row already had once: swipe-to-delete shipped on
 * the grid card and not here (see a-host-can-delete-in-either-density.test.ts).
 * Twice in one component is a pattern, not an oversight — hence this file.
 *
 * ── THE HONEST COST, RECORDED SO IT IS NOT REDISCOVERED AS A BUG ───────────
 * Role and groups cannot be EDITED without being SHOWN. Allowing them here
 * therefore gives rows a second line that most did not have (owner call
 * 2026-09-05: "allow it if possible"). The row is still far denser than the
 * 4:5 photo card it is the alternative to. Side cost nothing — the avatar was
 * already tinted by side, so it became the trigger for the thing it already
 * signalled, adding no pixels.
 *
 * The sub-line is ONE horizontally-scrolling flex line, never a wrapping one:
 * a guest in four groups must not grow the row a third time. That is what the
 * `w-max` + `m-no-scrollbar` pairing below is for, and why this file asserts it
 * rather than leaving it to look like styling.
 *
 * 🔒 No gate is forked. `RoleChipEditor` still owns the bride/groom lock and
 * this row must not re-spell it.
 *
 * 🛡 Mutation-checked against the real file, failures counted, each RED:
 *  · drop SideChipEditor from the avatar         → 0 → 2 failing · RED
 *  · unwrap RoleChips from RoleChipEditor        → 0 → 1 failing · RED
 *  · delete THIS row's AddToGroupControl         → 0 → 1 failing · RED
 *  · let the sub-line wrap (flex-wrap, no w-max) → 0 → 1 failing · RED
 *
 * ⚠ The AddToGroupControl mutation had to be applied by LINE, not by string:
 * the same six-line block appears three times in this file (desktop row, photo
 * card, this row) and a naive replace hits the wrong one, which would have
 * "measured" a mutation of a component this file does not test.
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
 * The BODY of a named function declaration. Every row destructures its props,
 * so the first `{` after the name opens the PARAMETER list — matching from it
 * returns the signature, and the assertions below would pass for the wrong
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
  assert.ok(
    bodyOf('MobileListRow').includes('const row = ('),
    'bodyOf stopped short of the function body',
  );
});

test('the density toggle no longer decides which fields exist', () => {
  // Both phone densities must reach the same editors. Whichever one a host
  // prefers, the same guest is editable in the same ways.
  const card = bodyOf('GuestCard');
  const row = bodyOf('MobileListRow');
  for (const editor of [
    'SideChipEditor',
    'RoleChipEditor',
    'RsvpChipEditor',
    'AddToGroupControl',
    'GroupChipList',
  ]) {
    assert.ok(card.includes(`<${editor}`), `GuestCard lost ${editor}`);
    assert.ok(
      row.includes(`<${editor}`),
      `MobileListRow has no ${editor}: ?density=list still removes a field the ` +
        'grid density can edit',
    );
  }
});

test('side rides the avatar — the signal became its own control', () => {
  // The avatar is already tinted by side. Wrapping it costs no width in a row
  // whose entire purpose is density; a separate side pill would.
  assert.ok(
    /<SideChipEditor[\s\S]*?<RowAvatar[\s\S]*?<\/SideChipEditor>/.test(
      bodyOf('MobileListRow'),
    ),
    'the side editor must wrap the avatar, not add a chip beside it',
  );
});

test('the sub-line scrolls, it never wraps', () => {
  // A wrapping sub-line grows the row a THIRD time for a guest in several
  // groups, which would give the compact density away entirely.
  const row = bodyOf('MobileListRow');
  assert.ok(
    /flex w-max items-center/.test(row),
    'the sub-line track needs w-max so chips keep their natural width',
  );
  assert.ok(
    /m-no-scrollbar/.test(row),
    'use the shared .m-no-scrollbar utility (globals.css), not a re-rolled one',
  );
  assert.equal(
    /flex-wrap[\s\S]{0,400}<RoleChipEditor/.test(row),
    false,
    'the sub-line must not wrap',
  );
});

test('the couple lock is not re-spelled here', () => {
  // RoleChipEditor owns the bride/groom short-circuit. This row already spells
  // that condition ONCE, for the swipe gate — it must not gain a second copy
  // for the role chip.
  const row = bodyOf('MobileListRow');
  const occurrences = (row.match(/guest\.role !== 'bride'/g) ?? []).length;
  assert.equal(
    occurrences,
    1,
    `expected exactly the swipe gate's copy, found ${occurrences} — the role ` +
      'chip must defer to RoleChipEditor',
  );
});

test('the row is handed what those editors need', () => {
  const callSite = /<MobileListRow[\s\S]*?\/>/.exec(SRC)?.[0] ?? '';
  for (const prop of [
    'palette={palette}',
    'groups={groups}',
    'groupsById={groupsById}',
    'bulkRoleSections={bulkRoleSections}',
  ]) {
    assert.ok(
      callSite.includes(prop),
      `the compact-density call site does not thread ${prop}`,
    );
  }
});
