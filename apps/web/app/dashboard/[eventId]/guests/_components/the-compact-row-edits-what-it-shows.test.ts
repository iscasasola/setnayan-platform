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
 * The sub-line's editors are ONE horizontally-scrolling track, never a wrapping one:
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
 *    (2026-10-05: only the TABLE may wrap now — owner; the editors' track
 *    still may not — see that test)
 *
 * ⚠ The AddToGroupControl mutation had to be applied by LINE, not by string:
 * the same six-line block appears three times in this file (desktop row, photo
 * card, this row) and a naive replace hits the wrong one, which would have
 * "measured" a mutation of a component this file does not test.
 *
 * ⚠ RETIRED 2026-09-20 — 'the density toggle no longer decides which fields
 * exist' test REMOVED, not repointed. Owner: "remove the grid view on guest
 * list. make it same sa row view only." `GuestCard` (the grid density this
 * test compared MobileListRow against) is deleted along with `MobileGridItem`
 * — there is no second density left to decide anything. The surviving
 * property this test actually protected — that a phone gets the same editors
 * a desktop gets — did not stop mattering; it is pinned against the real
 * comparison (DesktopRow, not a retired sibling row) in
 * the-phone-card-edits-what-the-desktop-row-edits.test.ts, so keeping a second
 * copy here would just be a second rule to drift. The rest of this file (the
 * avatar-as-side-trigger, the scrolling sub-line, the un-forked couple lock,
 * the threaded props) is untouched — none of it depended on GuestCard.
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

test('the sub-line\'s editors scroll, never wrap — only the TABLE may drop under them', () => {
  // A wrapping sub-line grows the row a THIRD time for a guest in several
  // groups, which would give the compact density away entirely. So the
  // editors (role · groups · + · +N) sit in ONE track that never shrinks and
  // never wraps — wider than the card, it scrolls.
  // ⚖ 2026-10-05, owner on maria-and-jose at 375 px ("the name fits —
  // truncate gracefully or wrap"): the TABLE name is the one thing allowed
  // under that track. A sponsor's "Principal Sponsor (Ninong)" left it ~13 px,
  // so it was cut off at the card's edge ("· T"); it now moves under the
  // line, whole (lib/table-words.test.ts pins the span itself).
  const row = bodyOf('MobileListRow');
  assert.ok(
    /<span className="flex shrink-0 items-center gap-1\.5">/.test(row),
    'the editors need one unshrinkable track so chips keep their natural width',
  );
  assert.ok(
    /m-no-scrollbar/.test(row),
    'use the shared .m-no-scrollbar utility (globals.css), not a re-rolled one',
  );
  // The only wrapping box is the line itself, and its FIRST child is that
  // unshrinkable track — so nothing among the editors can ever wrap.
  const wrapAt = row.indexOf('flex flex-wrap');
  assert.ok(wrapAt > -1, 're-anchor: the line lost its wrap');
  const afterWrap = row.slice(wrapAt);
  assert.match(
    afterWrap,
    /^flex flex-wrap[^"]*">\s*<span className="flex shrink-0 items-center gap-1\.5">/,
    'the wrapping line must hold the editors in ONE unshrinkable track — the editors themselves must not wrap',
  );
  const track = afterWrap.slice(0, afterWrap.indexOf('data-row-table'));
  assert.equal(track.indexOf('flex-wrap', 'flex flex-wrap'.length), -1, 'a second wrapping box appeared among the editors');
  assert.match(track, /<RoleChipEditor/, 'the role editor left the unshrinkable track');
  assert.match(track, /<GroupChipList/, 'the groups left the unshrinkable track');
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
