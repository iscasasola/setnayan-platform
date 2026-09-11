/**
 * generic-onboarding-entrance-block.test.ts — owner ruling 2026-09-11
 * (DECISION_LOG.md, last row), verbatim last sentence: "Same treatment for any
 * other one-at-a-time event type (the generic onboarding's 'You already have
 * one of these in planning')."
 *
 * PR #5447 did this for weddings: the create-event picker's Wedding tile is
 * greyed with the reason, and /onboarding/wedding checks BEFORE rendering a
 * single screen. This suite guards the SAME treatment for the generic
 * (non-wedding) onboarding, for the five gated life types
 * (life-event-gate.ts: debut · christening · birthday · graduation ·
 * gender_reveal) — the only non-wedding types that cap at one in-planning per
 * account.
 *
 * ⚠ DELIBERATELY DIFFERENT FROM THE WEDDING TREATMENT IN ONE WAY, AND THE TEST
 * BELOW PINS IT: the wedding cap is unconditional, so its entrance check is a
 * hard dead end (no wizard renders at all). The generic gate keys on the
 * honoree (blocksLifeEventCreation in life-event-gate.ts) — who this is FOR —
 * and the wizard does not ask that until its 'honoree' screen, a couple of
 * screens past the entrance. So:
 *   - the create-event picker's tile is NOT greyed for these five types (the
 *     rule cannot be known before the honoree is typed, which happens on
 *     /onboarding/[type] itself, never at the tile) — event-type-picker.tsx /
 *     event-type-photo-picker.tsx stay untouched, and this suite pins that.
 *   - the entrance check on /onboarding/[type] runs with the DEFAULT (no
 *     honoree named yet, i.e. "for myself") candidate and shows a NOTICE, not
 *     a dead end — the wizard still renders and still lets the account name a
 *     different celebrant to open a new slot, exactly as it does today.
 *
 * ⚠ SCOPE, STATED. This reads SOURCE (stripComments over the real .tsx), so it
 * proves the check is WIRED — computed server-side before render, gated on a
 * real signed-in user, threaded into the client shell, and rendered on the
 * FIRST screen — not that a browser renders it. That is the honest ceiling of
 * a static check, mirroring wedding-tile-greyed-when-in-planning.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, 'page.tsx');
const GENERIC_ONBOARDING = join(HERE, '_components', 'generic-onboarding.tsx');
const PICKER = join(
  HERE,
  '..',
  '..',
  'dashboard',
  '(account)',
  'create-event',
  '_components',
  'event-type-picker.tsx',
);
const PHOTO_PICKER = join(
  HERE,
  '..',
  '..',
  'dashboard',
  '(account)',
  'create-event',
  '_components',
  'event-type-photo-picker.tsx',
);

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

/**
 * Slice a `marker` through its matching closing `}` — balancing the PARAMETER
 * / CONDITION PARENS first, then the BODY BRACES. Mirrors the extractor in
 * wedding-tile-greyed-when-in-planning.test.ts (same reason: a destructured,
 * typed param or a JSX conditional closes a brace of its own before the real
 * body does, so brace-only balancing stops in the wrong place).
 */
function extractBalanced(src: string, marker: string): string {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `"${marker}" not found in source`);

  let depth = 0;
  let i = src.indexOf('(', start);
  assert.ok(i >= 0, `no "(" after "${marker}"`);
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
  assert.ok(j >= 0, `no "{" after "${marker}"'s parens`);
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error(`unbalanced body braces reading "${marker}"`);
}

test('the anchor: all four files exist and are not stubs', () => {
  for (const p of [PAGE, GENERIC_ONBOARDING, PICKER, PHOTO_PICKER]) {
    assert.ok(
      existsSync(p) && readFileSync(p, 'utf8').length > 400,
      `${p} is missing or a stub — every assertion below would pass vacuously`,
    );
  }
});

test('entrance: the server page computes entranceBlocking only for a real signed-in user', () => {
  const src = read(PAGE);

  assert.match(
    src,
    /import \{ isGatedLifeType \} from '@\/lib\/life-event-gate';/,
    'page.tsx must import isGatedLifeType — the gate must reuse the existing rule, never invent one',
  );
  assert.match(
    src,
    /import \{ getBlockingLifeEvent \} from '@\/app\/dashboard\/\(account\)\/create-event\/life-event-guard';/,
    'page.tsx must import the SAME server helper the create-event flow already uses for this cap',
  );

  const guardIdx = src.search(/if \(user && isGatedLifeType\(type\)\) \{/);
  assert.ok(
    guardIdx >= 0,
    'the entrance check must be gated on `user &&` BEFORE isGatedLifeType — reordering to ' +
      '`isGatedLifeType(type) && user` is not equivalent for a falsy-but-truthy edge and, more ' +
      'importantly, a missing `user &&` entirely would run the read for signed-out visitors, who ' +
      'must be unaffected',
  );

  const block = extractBalanced(src, 'if (user && isGatedLifeType(type)) {');
  assert.match(
    block,
    /getBlockingLifeEvent\(supabase, user\.id, \{/,
    'the entrance check must call getBlockingLifeEvent with the real signed-in user id',
  );
  assert.match(
    block,
    /eventType: type,/,
    'the candidate must check the CURRENT route type, not a hardcoded one',
  );
  assert.match(
    block,
    /honoreeLabel: null,\s*\n\s*honoreeDependentId: null,/,
    'the entrance candidate must be the DEFAULT (no honoree named yet) — the same "blank means ' +
      'for myself" convention the rest of the app uses — never a guess at what the user will type',
  );
  assert.match(
    block,
    /try \{[\s\S]*getBlockingLifeEvent[\s\S]*\} catch \{/,
    'the entrance read must fail OPEN (try/catch swallowing the error) — unlike the commit-time ' +
      'gate, this is a courtesy notice, not the enforcement point, and a flaky read must not 500 ' +
      'the page for every gated-type visitor',
  );
});

test('entrance: the server page hands entranceBlocking to the client shell', () => {
  const src = read(PAGE);
  assert.match(
    src,
    /<GenericOnboarding[\s\S]*?entranceBlocking=\{entranceBlocking\}/,
    'GenericOnboarding must receive entranceBlocking — computing it and never passing it down is ' +
      'the same dead end with extra steps',
  );
});

test('client shell: blockedBy is seeded from entranceBlocking, not hardcoded to null', () => {
  const src = read(GENERIC_ONBOARDING);

  assert.match(
    src,
    /entranceBlocking\?:\s*\{\s*eventId:\s*string;\s*displayName:\s*string\s*\}\s*\|\s*null;/,
    'Props must declare entranceBlocking with the same shape as blockedBy',
  );
  assert.match(
    src,
    /entranceBlocking = null,/,
    'entranceBlocking must be destructured from props (defaulting to null for every caller that ' +
      'does not pass it, keeping every existing call site byte-identical)',
  );
  assert.match(
    src,
    /const \[blockedBy, setBlockedBy\] = useState<\s*\{\s*eventId:\s*string;\s*displayName:\s*string\s*\}\s*\|\s*null\s*>\(entranceBlocking\);/,
    'blockedBy must initialize FROM entranceBlocking — seeding it with a literal null would throw ' +
      'away the server\'s answer and silently fall back to the old wedding-less-thorough behaviour',
  );
});

test('client shell: the welcome screen (the actual FIRST screen) renders the notice and a link out', () => {
  const src = read(GENERIC_ONBOARDING);
  const welcomeBlock = extractBalanced(src, "if (screen === 'welcome') {");

  assert.match(
    welcomeBlock,
    /\{blockedBy \? \(/,
    "the welcome screen must conditionally render on blockedBy — the entrance notice belongs on " +
      "the FIRST screen (screens[0] === 'welcome'), not only on the later 'honoree' screen where " +
      'the post-commit failure already showed it',
  );
  assert.match(
    welcomeBlock,
    /href=\{`\/dashboard\/\$\{blockedBy\.eventId\}`\}/,
    'the entrance notice must link straight to the actual blocking event, not just name it',
  );
  assert.match(
    welcomeBlock,
    /already have a \{label\.toLowerCase\(\)\} in planning/,
    'the notice must say which kind of event is blocked, using the real type label',
  );

  // ⚠ THIS IS NOT A DEAD END — pin that the wizard keeps rendering everything
  // else on this screen regardless of blockedBy (no early return, no replaced
  // component), unlike the wedding entrance which fully replaces the wizard.
  assert.match(
    welcomeBlock,
    /intro\?\.headline/,
    'the ordinary welcome copy must still render alongside the notice — this is a heads-up, not ' +
      'a replacement screen; only the honoree-gated wedding cap gets a hard entrance wall',
  );
});

test('picker tiles: the five gated life types are deliberately NOT greyed — only Wedding is', () => {
  const pickerSrc = read(PICKER);
  const photoPickerSrc = read(PHOTO_PICKER);

  // unavailableReasons exists (from #5447, wedding-only) and must stay keyed
  // ONLY by 'wedding'. Widening it to a gated life type would be WRONG here:
  // the rule depends on an honoree the tile is tapped before ever asking, so
  // greying the tile would block (or misleadingly warn) a subject the account
  // has not even named yet.
  assert.match(
    pickerSrc,
    /unavailableReasons=\{\s*inPlanningWedding \? \{ wedding: `Already planning \$\{inPlanningWedding\.displayName\}` \} : undefined\s*\}/,
    'unavailableReasons must still be keyed ONLY by wedding — a gated life type keyed in here ' +
      'would grey a tile using information the app does not have yet',
  );
  assert.doesNotMatch(
    pickerSrc,
    /isGatedLifeType\([^)]*\)\s*\?\s*\{[^}]*(debut|christening|birthday|graduation|gender_reveal)/,
    'no gated life type may be wired into the tile grey-out — the honoree it would need is typed ' +
      'on /onboarding/[type], never at the tile',
  );

  // The photo picker's grey-out machinery (from #5447) stays generic — it must
  // not gain any gated-life-type-specific branch (its TAGLINES map legitimately
  // names these types for unrelated copy, so the check is narrowed to actual
  // type-key BRANCHING, not the bare words). It is driven purely by whatever
  // unavailableReasons the caller supplies (still wedding-only, asserted above).
  assert.doesNotMatch(
    photoPickerSrc,
    /(type|t)\.key === '(debut|christening|birthday|graduation|gender_reveal)'/,
    'event-type-photo-picker.tsx must never special-case a gated life type by key — greying stays ' +
      'entirely driven by the generic unavailableReasons prop',
  );
});
