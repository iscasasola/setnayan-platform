import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  ============================================================================
  THE STORIES SWITCH MUST REACH EVERY KIND OF DAY — AND MUST NAME THE REAL
  REMEDY WHEN IT WON'T APPEAR
  ============================================================================

  Owner, 2026-08-15: "each event they create will have an editorial not just
  wedding", and on the most intimate kinds: "making it public will be the
  user's decision … so yes." That ruling deleted five `event_type='wedding'`
  filters from the gallery, the sitemap and the credited-vendor portfolio.
  `lib/editorial-event-types.ts` holds the one remaining home of the kind
  question.

  🔴 THE STORY MAKER'S TWO DOORS DID NOT MOVE WITH IT, and a real celebration
  paid for it: a published `date` story on a PUBLIC page whose host was never
  offered the switch. The editor rendered "Feature our story in Stories" behind
  a wedding-only boolean computed at its call site, and `setStoryShowcase`
  refused a non-wedding opt-in server-side — quoting a filter that no longer
  existed.

  🔑 A GATE WHOSE HANDLE WAS REMOVED IS INVISIBLE FROM BOTH SIDES: the gallery
  looks correctly empty, and the host looks like somebody who never opted in.

  🔑 AND THE GATE WAS NEVER A BOUNDARY. The privacy page's `setShowcaseConsent`
  writes the IDENTICAL per-user consent flag and had NO kind check at all — two
  doors to one fact, one bolted. Both ask the same question now.

  🔴 THE ONE CAVEAT THAT DID RENDER NAMED THE WRONG FIX: "Make it Public or
  Unlisted", while the gallery was tightened the same 2026-08-15 to
  `landing_page_visibility = 'public'` because "unlisted" is what the privacy
  screen sells as LINK ONLY. Following our own advice left you invisible.
  A caveat that names the wrong remedy is worse than none: it gets followed.

  Every assertion below was mutation-checked by restoring the old shape and
  confirming this file goes red. See the PR body for the before → after counts.
*/

const WEB = join(import.meta.dirname, '..');
const ACTION = join(WEB, 'app/dashboard/[eventId]/story/actions.ts');
const EDITOR = join(WEB, 'app/dashboard/[eventId]/story/_components/editorial-editor.tsx');
const EDITOR_PAGE = join(WEB, 'app/dashboard/[eventId]/story/page.tsx');
const PRIVACY_PAGE = join(WEB, 'app/dashboard/[eventId]/website/privacy/page.tsx');
const PRIVACY_ACTION = join(WEB, 'app/dashboard/[eventId]/website/privacy/actions.ts');

/**
 * Strip comments before matching. EVERY file touched here carries a docblock
 * QUOTING the wedding-only test it removed, so a raw scan reports the defect it
 * just fixed — the exact false positive `doors-are-designed.test.ts` records.
 * A state machine, not a line-prefix filter: a prefix filter's survivors are
 * mostly block-comment continuation lines.
 */
function codeOnly(path: string): string {
  const src = readFileSync(path, 'utf8');
  let out = '';
  let i = 0;
  let mode: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code';
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && n === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { mode = 'block'; i += 2; continue; }
      if (c === "'") mode = 'sq';
      else if (c === '"') mode = 'dq';
      else if (c === '`') mode = 'tpl';
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i += 2; continue; } i++; continue; }
    // inside a string literal
    if (c === '\\') { out += c + (n ?? ''); i += 2; continue; }
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) mode = 'code';
    out += c; i++;
  }
  return out;
}

test('the Story Maker refuses a kind only through editorialAllowsEventType', () => {
  const src = codeOnly(ACTION);
  assert.ok(
    src.includes('editorialAllowsEventType'),
    'setStoryShowcase must ask the one home of the kind question.',
  );
  assert.equal(
    /!==\s*['"]wedding['"]/.test(src),
    false,
    'A hardcoded `!== "wedding"` refusal is back in the Story Maker action. ' +
      'The gallery has accepted every kind since 2026-08-15.',
  );
  assert.equal(
    /weddings only/i.test(src),
    false,
    '"Stories features weddings only" is back — that sentence has been false since 2026-08-15.',
  );
});

test('the opt-in fails CLOSED on an unreadable event', () => {
  const src = codeOnly(ACTION);
  /* 🪤 THIS ASSERTION WAS DECORATION ON ITS FIRST CUT. It was an `||` of the
     destructure and the refusal, so deleting `error: evError` left the second
     branch matching and the guard reported a clean pass with the sabotage in
     place (measured: evError 2 -> 1, 8 pass / 0 fail). A guard that ORs two
     facts passes while either survives — both are asserted separately now. */
  assert.ok(
    /error:\s*evError/.test(src),
    'setStoryShowcase must DESTRUCTURE the query error. Dropping it let ' +
      '`?? "wedding"` answer for a failed lookup, making a broken read ' +
      'indistinguishable from a real wedding.',
  );
  assert.ok(
    /evError\s*\|\|\s*!ev/.test(src),
    'setStoryShowcase must REFUSE on an unreadable event — reading the error ' +
      'and not acting on it is the same bug with more code.',
  );
});

test('the switch is gated on the KIND, never on a boolean from the call site', () => {
  const editor = codeOnly(EDITOR);
  assert.ok(
    editor.includes('editorialAllowsEventType'),
    'The editor must derive the switch from the kind question itself.',
  );
  assert.equal(
    /isWedding/.test(editor),
    false,
    'The wedding-only boolean is back in the editor. It hid this switch from ' +
      'fifteen of the sixteen kinds for three weeks.',
  );
  const page = codeOnly(EDITOR_PAGE);
  assert.equal(
    /isWedding=/.test(page),
    false,
    'The call site is computing a wedding boolean again — pass the kind itself.',
  );
  assert.ok(
    /eventType=\{/.test(page),
    'story/page.tsx must hand the editor the event kind.',
  );
});

test('the caveat names the remedy that actually works, and is not hidden behind the switch', () => {
  const editor = codeOnly(EDITOR);
  assert.equal(
    /Make it Public or Unlisted/i.test(editor),
    false,
    '"Public or Unlisted" is back. Unlisted stopped qualifying on 2026-08-15 — ' +
      'it is what the privacy screen sells as LINK ONLY, so following this ' +
      'advice leaves you invisible, silently.',
  );
  assert.ok(
    /landingVisibility !== 'public'/.test(editor),
    'The caveat must fire for every non-public state, not just Private — the two ' +
      'middle states used to say nothing at all.',
  );
  assert.equal(
    /featured && landingVisibility/.test(editor),
    false,
    'The caveat is gated on `featured` again, so it only appears AFTER opting ' +
      'in — never to the person still deciding.',
  );
});

test('both visibility unions carry the real fourth state', () => {
  for (const [path, label] of [
    [EDITOR, 'editorial-editor.tsx'],
    [EDITOR_PAGE, 'story/page.tsx'],
  ] as const) {
    const src = codeOnly(path);
    const union = /type LandingVisibility =([^;]+);/.exec(src);
    if (!union) {
      assert.fail(`${label} must declare LandingVisibility.`);
    }
    assert.ok(
      union[1]!.includes('invited_accounts'),
      `${label} omits 'invited_accounts' — a REAL state in the database's own ` +
        `CHECK constraint. Omitting it made the cast relabel it, and the caveat ` +
        `told the host their page was "Private" when it was not.`,
    );
  }
});

test('the privacy badge separates consent from eligibility', () => {
  const src = codeOnly(PRIVACY_PAGE);
  /* 🪤 THE FIRST CUT OF THIS TEST WAS DECORATION. It asserted only that the
     word `showcaseBlocker` appeared somewhere in the file — so replacing the
     badge's whole conditional with the bare claim still left the const
     declaration and the className branch matching, and it reported a clean
     pass (measured: showcaseBlocker 4 -> 2, 8 pass / 0 fail). A file-level
     substring cannot say which EXPRESSION still consults a value. */
  assert.ok(
    /const showcaseBlocker/.test(src),
    'The page must derive what stands between consent and actually appearing.',
  );
  assert.ok(
    /event\.slug/.test(src),
    'The blocker must include the missing-address case — a consented public ' +
      'page with no slug still never appears.',
  );
  /* ⚠ AND THE SECOND CUT WAS STILL DECORATION FOR ONE MUTATION. Matching
     `showcaseOptedIn ? showcaseBlocker ?` was satisfied by the CLASSNAME
     branch, which has the identical shape — so deleting the conditional
     SENTENCE and keeping the conditional COLOUR passed (measured:
     showcaseBlocker 4 -> 2, 8 pass / 0 fail). The colour is not the claim.
     Assert the sentence that names the blocker. */
  assert.ok(
    src.includes('On — but ${showcaseBlocker}'),
    'The BADGE TEXT claims eligibility unconditionally again. Saying yes records ' +
      'CONSENT; the gallery also needs a public page and an address, so the ' +
      'SENTENCE must name what is missing — a colour change alone still tells ' +
      'the host they are eligible.',
  );
});

test('both doors to the consent flag ask the same kind question', () => {
  const privacyAction = codeOnly(PRIVACY_ACTION);
  /* 🪤 ALSO DECORATION ON ITS FIRST CUT: it matched the bare identifier, which
     the IMPORT satisfies. Gutting the call to `if (false)` left the import
     standing and the guard passed (measured: editorialAllowsEventType 2 -> 1,
     8 pass / 0 fail). Assert the CALL, and that it still guards a refusal. */
  assert.ok(
    /if\s*\(\s*!editorialAllowsEventType\(/.test(privacyAction),
    'setShowcaseConsent writes the SAME users.public_summary_consent_at flag as ' +
      'setStoryShowcase and must ask the same question, as a live call. A rule ' +
      'written twice with one copy laxer means the laxer copy is the real rule.',
  );
});

test('no refusal on the privacy door is silent', () => {
  const action = codeOnly(PRIVACY_ACTION);
  const page = codeOnly(PRIVACY_PAGE);
  const emitted = [...action.matchAll(/showcase=([a-z]+)/g)].map((m) => m[1]);
  assert.ok(emitted.length > 0, 'The privacy action must signal its refusals.');
  /* ⚠ Match the READ, not the bare literal: renaming the query key breaks the
     wiring while `'blocked'` still appears in the file, so a literal-only check
     cannot see it (measured: the naive probe never moved, 1 -> 1). */
  for (const outcome of emitted) {
    assert.ok(
      page.includes(`search.showcase === '${outcome}'`),
      `setShowcaseConsent redirects with showcase=${outcome} and the page never ` +
        `reads that outcome. A guard that refuses in silence is ` +
        `indistinguishable from one that passed.`,
    );
  }
});

test('the caveat names the visibility settings in the privacy screen\'s own words', () => {
  /*
    🔑 GUARD TWO SURFACES AGAINST EACH OTHER. The caveat's whole job is to send
    somebody to a control and name it, so the name has to be the one printed on
    that control. My own first cut said "Link only" for a card the privacy
    screen titles "Unlisted" — the same defect one rung down: the host goes
    looking for a radio button that does not exist. These are the three
    non-public card titles, read out of the privacy page itself rather than
    re-typed, so a rename there fails here instead of drifting.
  */
  const privacy = codeOnly(PRIVACY_PAGE);
  const titles = [...privacy.matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
  for (const t of ['Public', 'Unlisted', 'Only guests with a Setnayan account', 'Private']) {
    assert.ok(
      titles.includes(t),
      `The privacy screen no longer offers a card titled "${t}" — the Stories ` +
        `caveat names it, so update both together.`,
    );
  }
  const editor = codeOnly(EDITOR);
  for (const t of ['Unlisted', 'Only guests with a Setnayan account', 'Private']) {
    assert.ok(
      editor.includes(`'${t}'`),
      `The Stories caveat must name "${t}" exactly as the privacy screen titles ` +
        `it. Describing a setting in words the control does not use sends the ` +
        `host hunting for a button that is not there.`,
    );
  }
});
