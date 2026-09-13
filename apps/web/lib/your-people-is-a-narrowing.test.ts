import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The properties that make the "Your people" chip safe to ship.
 *
 * Not a style test. Each assertion pins a rule whose failure is SILENT — a
 * shelf that quietly widens, a scope that quietly becomes "everyone", a
 * failed read that quietly claims a stranger is a friend. Every one was
 * mutation-checked by occurrence count before being trusted.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');

function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

const PEOPLE = readFileSync(join(HERE, 'your-people.ts'), 'utf8');
const PEOPLE_CODE = code(PEOPLE);
const COMPOSER = code(readFileSync(join(HERE, 'front-door-composition.ts'), 'utf8'));
const FEED = code(
  readFileSync(join(APP, 'app/_components/frontdoor/front-door-feed.tsx'), 'utf8'),
);
const DOOR = code(readFileSync(join(APP, 'app/_components/frontdoor/front-door.tsx'), 'utf8'));

test('the guards are reading real source, not a stub', () => {
  for (const [name, src] of [
    ['your-people.ts', PEOPLE_CODE],
    ['front-door-composition.ts', COMPOSER],
    ['front-door-feed.tsx', FEED],
    ['front-door.tsx', DOOR],
  ] as const) {
    assert.ok(src.length > 800, `${name} is missing or a stub — this guard reads nothing.`);
  }
});

/* ── 🚨 RLS IS A FLOOR, NOT A SCOPE ──────────────────────────────────────
   `member_reads_membership` and `community_roster_member_read` BOTH end in
   `OR is_admin()`, and production has an admin who is also an ordinary user —
   the owner's own account, the one he tests with. A read that leaned on RLS
   to scope it would hand HIM every event membership and every samahan roster
   in the database, so "Your people" would silently mean "everybody" for
   exactly one person. Same shape as the 2026-08-12 defect where My Shop read
   every other shop's correction requests.

   So every membership read must scope ITSELF. */
test('every membership read scopes itself — RLS is never the fence', () => {
  const chains = [...PEOPLE_CODE.matchAll(/\.from\('(event_members|community_members)'\)/g)];
  assert.ok(
    chains.length >= 4,
    `Expected at least 4 membership reads, found ${chains.length}. If they were ` +
      'removed this guard must be re-aimed, not deleted.',
  );
  /*
    🪤 THIS GUARD WAS DECORATION ON ITS FIRST RUN, for exactly the case it
    exists to catch. It sliced a FIXED 420 characters after each `.from(`, so
    when the sabotage removed `.eq('user_id', me)` from the first chain the
    window simply ran on into the NEXT chain — which has its own scoping call —
    and the guard passed while the defect was live. The mutation landed
    (2 → 1 occurrences) and reported green.

    A chain now ends where the next one begins. Bound the window by structure,
    never by a character count.
  */
  const starts = chains.map((m) => m.index ?? 0);
  const allFroms = [...PEOPLE_CODE.matchAll(/\.from\('/g)].map((m) => m.index ?? 0);
  for (const start of starts) {
    const next = allFroms.find((i) => i > start) ?? PEOPLE_CODE.length;
    const chain = PEOPLE_CODE.slice(start, next);
    const m = /\.from\('(event_members|community_members)'\)/.exec(chain)!;
    assert.match(
      chain,
      /\.eq\('user_id', me\)|\.in\('event_id',|\.in\('community_id',/,
      `A read of ${m[1]} is not explicitly scoped. It would inherit ` +
        "`OR is_admin()` from the policy and return EVERY row for an admin " +
        'account. Scope it by ids derived from a `user_id = me` read.',
    );
  }
});

test('no auth UUID leaves this module', () => {
  assert.doesNotMatch(
    PEOPLE_CODE,
    /\buserIds\b\s*[,}]\s*$/m,
    'the module appears to return raw user ids',
  );
  assert.match(
    PEOPLE_CODE,
    /slugs:\s*ReadonlySet<string>/,
    'YourPeople must expose SLUGS, never ids — a slug is public by ' +
      'construction, an auth UUID is not.',
  );
});

/* ── THE READ THAT FAILED IS NOT THE PERSON WITH NO FRIENDS ────────────── */
test('a failed read is distinguishable from having nobody', () => {
  assert.match(PEOPLE_CODE, /ok:\s*false/, 'nothing ever reports a failed read');
  assert.match(PEOPLE_CODE, /ok:\s*true/, 'nothing ever reports a successful empty read');
  /*
    ⚠ 2026-09-03 — DROPPED THE THIRD ASSERTION, NOT THE PROPERTY. This used to
    also require `yourPeopleOk` in `FEED` — the front door narrowed its shelf
    by "Your people" behind a chip, and a failed read had to be distinguished
    from an honest zero right there in the render. The 2026-09-03 redesign
    retired the chip (and every filter with it) but deliberately did NOT touch
    `your-people.ts` itself — see that module's own note and
    `front-door-composition.ts`'s docblock on `fromYourPeople`. Nothing
    downstream reads `yourPeopleOk` today, so there is no render left for this
    guard to check; the ok/false-vs-ok/true distinction above is still real
    and still asserted, on the module that still makes it.
  */
});

test('every Supabase read checks error explicitly — a catch cannot see a rejection', () => {
  const reads = (PEOPLE_CODE.match(/\.from\('/g) ?? []).length;
  const checks = (PEOPLE_CODE.match(/\berror\b/g) ?? []).length;
  assert.ok(
    checks >= reads,
    `${reads} reads but only ${checks} error mentions. Supabase RESOLVES with ` +
      '{ data: null, error } — a phantom column returns quietly and no catch runs.',
  );
});

/* ── THE CHIP IS RETIRED — 2026-09-03 ─────────────────────────────────────
   `front-door-composition.ts` no longer has a `selectShelf`/`fromYourPeople
   === true` narrowing to admit a story by, and `front-door-feed.tsx` no
   longer renders a chip bar at all (no `'Your people'`, no `signedIn` gate
   to pass it). Both tests that lived here (the composer's fail-closed
   comparison, the chip's signed-in gate) tested exactly that mechanism, and
   it does not exist to test any more — see `front-door-composition.ts`'s own
   docblock. `your-people.ts`, the READ underneath the retired chip, is
   unchanged and still tested above and below; only its front-door consumer
   is gone. */

test('the module never loads a story — that is the whole safety argument', () => {
  for (const table of ['creator_chapters', 'event_showcases', 'person_story_items']) {
    assert.doesNotMatch(
      PEOPLE_CODE,
      new RegExp(`\\.from\\('${table}'\\)`),
      `your-people.ts reads ${table}. It must only answer WHO the viewer ` +
        'knows; the shelf it filters is already public. The moment this ' +
        'module loads content, "it can only narrow" stops being true and the ' +
        'privacy reasoning has to start again.',
    );
  }
});

/* ── THE GROUP DELIBERATELY LEFT OUT ─────────────────────────────────────
   A guest at an event cannot read that event's member list, so counting the
   OTHER guests would let them infer that a stranger is also attending — a
   disclosure the product makes nowhere else. The omission is a decision. */
test('only events the viewer ORGANISES contribute their co-members', () => {
  assert.match(
    PEOPLE_CODE,
    /\.eq\('member_type', 'couple'\)/,
    'The organiser narrowing is gone. Without it this counts co-guests of ' +
      'events the viewer merely ATTENDS — people they cannot otherwise see — ' +
      'and a guest could learn from a chip that a stranger is at their event. ' +
      'Widening that is an owner/DPO call, not a filtering convenience.',
  );
});
