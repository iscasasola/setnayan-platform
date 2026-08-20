/**
 * year-page-answers-created-or-not.test.ts — every row on the Year page must
 * SAY whether it is already an event ("Open plan") or a date still waiting for
 * one ("Start planning"), and the create branch must carry its preselect.
 *
 * ─── WHY ─────────────────────────────────────────────────────────────────────
 * Owner ask 2026-08-20 (from the Year page itself): "we want to show if an
 * event is existing or they still need to create one … maybe add a button —
 * start planning, and when there is existing, open plan." Before this, the two
 * states were distinguishable only by where a tap happened to land — the card
 * looked identical either way, so Christmas (no event) and a wedding (an event)
 * read as the same kind of row.
 *
 * ─── WHY A SOURCE-TEXT GUARD ─────────────────────────────────────────────────
 * The page is an async server component on the server Supabase client — it
 * cannot be imported by a plain `node:test` process, and a rendering harness
 * for two <span>s is more machinery than the thing it guards. Same call as
 * year-view-has-a-door.test.ts, whose helpers this file mirrors. The
 * DERIVATION half of the contract (which moments carry eventId /
 * createEventType) is unit-tested for real in year-moments.test.ts.
 *
 * ⚠ Reads go through `stripComments` — the page's own comments describe these
 * exact strings, and a raw-text scan matches its own explanation (this has
 * happened four separate times in this repo).
 *
 * Mutation-checked on 2026-08-20 — every sabotage measured as LANDED, by
 * occurrence count, before its result was trusted:
 *   delete the "Open plan" span            → 1→0 · RED
 *   delete the "Start planning" span       → 1→0 · RED
 *   drop the ?event_type= prefill          → 1→0 · RED
 *   fork a third create-event href         → 2→3 · RED
 *   plain <Link> instead of the carry link → 3→1 · RED
 *   stop passing the day to the carry      → 1→0 · RED
 *   onboarding stops calling takeMoment()  → 1→0 · RED
 *
 * 🪤 THE HARNESS MEASURED THE WRONG THING FIRST. It counted with `grep -c`,
 * which counts LINES — so the forked-href sabotage, which puts two hrefs on ONE
 * line, read as "did not land" and its result was thrown away as meaningless.
 * The guard had in fact fired. Count OCCURRENCES (`grep -o | wc -l`), or a
 * landed mutation reports as a non-event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const YEAR_PAGE = join(WEB, 'app/dashboard/(account)/year/page.tsx');
const ONBOARDING = join(WEB, 'app/onboarding/[type]/_components/generic-onboarding.tsx');

/** Source with comments blanked — never the raw text. */
function code(path = YEAR_PAGE): string {
  const src = stripComments(readFileSync(path, 'utf8'));
  // A stripper bug that blanked the file would make every count below pass
  // vacuously as 0 — refuse to run on an empty read.
  assert.ok(src.trim().length > 200, `${path}: stripped source is implausibly short`);
  return src;
}

function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length;
}

test('the Year page renders BOTH states — "Open plan" and "Start planning"', () => {
  const src = code();
  assert.equal(count(src, /Open plan/g), 1, 'exactly one "Open plan" branch');
  assert.equal(count(src, /Start planning/g), 1, 'exactly one "Start planning" branch');
});

test('the create branch preselects the event type when the moment knows it', () => {
  const src = code();
  assert.equal(
    count(src, /create-event\?event_type=/g),
    1,
    'the createEventType prefill must reach the href — dropping it silently degrades every birthday tap to the blank picker',
  );
  // Both create hrefs (prefilled + generic) plus the event deep-link must stay
  // the SAME ternary — a second, independently-built href is how one branch
  // gets fixed and the other forgotten.
  assert.equal(
    count(src, /\/dashboard\/create-event/g),
    2,
    'exactly two create-event hrefs: the preselected one and the generic fallback',
  );
});

// ── the carry must be REACHABLE, not merely written ─────────────────────────
// Both halves are easy to build and leave unwired, and the failure is silent:
// the wizard just asks again, exactly as it did before, with nothing in any log
// to find it by. This repo's recurring "a mechanism never proven reachable".

test('the create card actually HANDS the flow what the row knew', () => {
  const src = code();
  assert.ok(
    count(src, /<StartPlanningLink\b/g) >= 1,
    'the no-event card must render <StartPlanningLink> — a plain <Link> navigates but carries nothing',
  );
  assert.ok(
    count(src, /celebrationISO=/g) >= 1 && count(src, /forSelf=/g) >= 1,
    'both facts the row knows (the day, and whether it is yours) must be passed to the link',
  );
});

test('the onboarding wizard CONSUMES the carry', () => {
  const src = code(ONBOARDING);
  assert.ok(
    count(src, /\btakeMoment\(\)/g) >= 1,
    'generic-onboarding must read the moment carry — unread, the date and celebrant are asked again',
  );
});
