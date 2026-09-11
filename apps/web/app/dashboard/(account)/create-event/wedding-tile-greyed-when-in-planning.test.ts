/**
 * Owner ruling 2026-09-11 (DECISION_LOG.md, last row — "IF A WEDDING IS
 * ALREADY IN PLANNING, STARTING ANOTHER IS NOT OFFERED"), verbatim: "they
 * shouldn't even allow the creation/step 1 of clicking the wedding event. it
 * should be greyed out since it is not available."
 *
 * The one-wedding rule itself (wedding-guard.ts, owner-locked 2026-07-12) was
 * already correct and already tested (wedding-guard.test.ts). The DEFECT this
 * suite guards is upstream of the rule: the create-event picker's own click
 * handler redirected straight into /onboarding/wedding for the Wedding tile
 * BEFORE the in-planning check could run, so the guided-router block that
 * already existed in this file for exactly this state was dead code — a
 * signed-in account with a wedding in planning could tap Wedding and land on
 * step 1 of the wizard with no notice at all.
 *
 * ⚠ SCOPE, STATED. This reads SOURCE (stripComments over the real .tsx/.ts),
 * so it proves the check is WIRED — ordered correctly, not bypassable by the
 * redirect branch — not that a browser renders it. That is the honest ceiling
 * of a static check, which is why every assertion below is anchored to the
 * ACT (an early return before the redirect; a real href to the existing
 * wedding) rather than to the presence of a word like "greyed".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PICKER = join(HERE, '_components', 'event-type-picker.tsx');
const PHOTO_PICKER = join(HERE, '_components', 'event-type-photo-picker.tsx');
const ONBOARDING_PAGE = join(HERE, '..', '..', '..', 'onboarding', 'wedding', 'page.tsx');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

/**
 * Slice a `function name(` marker through its matching closing `}` — balancing
 * the PARAMETER PARENS first, then the BODY BRACES. A naive `\n}` regex is
 * wrong here: a destructured, typed param (`{ wedding }: { eventId: string;
 * ... }`) closes a brace of its own well before the function body does, so
 * brace-only balancing stops at the params, not the body.
 */
function extractBalanced(src: string, marker: string): string {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `"${marker}" not found in source`);

  let depth = 0;
  let i = src.indexOf('(', start);
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  assert.ok(depth === 0, `unbalanced parens reading "${marker}"`);

  depth = 0;
  let j = src.indexOf('{', i);
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error(`unbalanced body braces reading "${marker}"`);
}

test('the anchor: all three files exist and are not stubs', () => {
  for (const p of [PICKER, PHOTO_PICKER, ONBOARDING_PAGE]) {
    assert.ok(
      existsSync(p) && readFileSync(p, 'utf8').length > 400,
      `${p} is missing or a stub — every assertion below would pass vacuously`,
    );
  }
});

test('picker: tapping Wedding while one is in planning never reaches the onboarding redirect', () => {
  const src = read(PICKER);
  const body = extractBalanced(src, 'function handleSelect(');

  const guardIdx = body.indexOf(`type.key === 'wedding' && inPlanningWedding`);
  const redirectIdx = body.indexOf('router.replace(withNext(type.onboardingHref))');
  assert.ok(guardIdx >= 0, 'handleSelect must check the in-planning state for Wedding');
  assert.ok(redirectIdx >= 0, 'the onboardingHref redirect branch should still exist for every other type');
  assert.ok(
    guardIdx < redirectIdx,
    'the in-planning check must run BEFORE the onboardingHref redirect — otherwise Wedding ' +
      'always navigates into /onboarding/wedding step 1 regardless of the guard, which is the ' +
      'exact defect the owner reported',
  );
  // The blocked tap must reveal the guided router in place (setSelectedKey), never navigate.
  const guardClause = body.slice(guardIdx - 80, guardIdx + 200);
  assert.match(
    guardClause,
    /setSelectedKey\(type\.key\)/,
    'the blocked tap must set selectedKey so the guided-router block renders — it must not navigate',
  );
});

test('picker: the Wedding tile is told it is unavailable, by name, when a wedding is in planning', () => {
  const src = read(PICKER);
  assert.match(
    src,
    /<EventTypePhotoPicker[\s\S]*?unavailableReasons=\{/,
    'EventTypePhotoPicker must receive an unavailableReasons prop',
  );
  assert.match(
    src,
    /inPlanningWedding \? \{ wedding: `Already planning \$\{inPlanningWedding\.displayName\}` \} : undefined/,
    'the reason must name the existing wedding by its display name, not just say "unavailable"',
  );
});

test('photo picker: a greyed-out tile stays a live tap target, not a dead disabled control', () => {
  const src = read(PHOTO_PICKER);

  // The greyed state must be a DIFFERENT thing from the admin `enabled=false`
  // "Coming soon" state — that one is genuinely inert, this one is not.
  assert.match(
    src,
    /const greyedOut = enabled && !!unavailableReason/,
    'greyed-out must require enabled=true — an admin-disabled type keeps its own dead-end state',
  );
  // The HTML disabled attribute must still be driven ONLY by `enabled` — a
  // greyed tile is reachable-as-disabled (port-control baseline: a greyed tile
  // is not a lost control).
  assert.match(
    src,
    /disabled=\{!enabled\}/,
    'the button must not gain a second, harder disabled condition — the greyed tile must stay clickable',
  );
  assert.doesNotMatch(
    src,
    /disabled=\{!enabled \|\| greyedOut\}/,
    'greyedOut must never be folded into the disabled attribute — that would turn the tile into ' +
      'a dead link instead of a reachable one',
  );
  // onClick must still fire for a greyed tile (gated on `enabled`, not on the reason).
  assert.match(
    src,
    /onClick=\{\(\) => enabled && onSelect\(t\)\}/,
    'the tap handler must still fire for an enabled-but-greyed tile',
  );
  assert.match(src, /Already in planning/, 'the tile must print the plain reason, not just grey out silently');
});

test('onboarding entrance: a signed-in account with a wedding in planning is answered before any wizard data is fetched', () => {
  const src = read(ONBOARDING_PAGE);

  const guardIdx = src.indexOf('if (inPlanningWedding) {');
  const promiseAllIdx = src.indexOf('await Promise.all([');
  const shellIdx = src.indexOf('<OnboardingShell');
  assert.ok(guardIdx >= 0, 'the page must check inPlanningWedding');
  assert.ok(promiseAllIdx >= 0, 'the page should still fetch the wizard data for the unblocked path');
  assert.ok(shellIdx >= 0, 'the page should still render OnboardingShell for the unblocked path');
  assert.ok(
    guardIdx < promiseAllIdx,
    'the guard must run BEFORE the wizard data fetch — the whole point is that a blocked ' +
      'account never walks even the fetch for step 2, let alone the screen',
  );
  assert.ok(guardIdx < shellIdx, 'the guard must return before OnboardingShell ever renders');

  // Signed-out visitors must be unaffected: the guard is conditional on a real user.
  assert.match(
    src,
    /earlyUser\s*\?\s*await getInPlanningWedding\(supabase, earlyUser\.id\)\s*:\s*null/,
    'an anonymous visitor must never be sent through getInPlanningWedding — the flow must stay ' +
      'open for signed-out visitors',
  );
});

test('onboarding entrance: the notice is not a dead end — it links to the real existing wedding', () => {
  const src = read(ONBOARDING_PAGE);
  const body = extractBalanced(src, 'function AlreadyPlanningWedding(');

  assert.match(
    body,
    /href=\{`\/dashboard\/\$\{wedding\.eventId\}`\}/,
    'the notice must link to the actual in-planning wedding, not just say it exists',
  );
  assert.match(body, /wedding\.displayName/, 'the notice must name the existing wedding, not just its id');
});
