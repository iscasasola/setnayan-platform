/**
 * THE UNREAD BADGE REACHES THE CARDS — and says nothing when the read failed.
 *
 * `bench-unread.test.ts` proves the arithmetic dedupes and refuses. This file
 * proves it is WIRED, because those are two different claims:
 *
 *   🔑 A LOG LINE NEVER CHANGED A PIXEL. `rollupUnread` can dedupe perfectly and,
 *   if no head renders it, the couple sees nothing — or worse, a hand-rolled
 *   `vendors.length` count beside it that does not dedupe at all.
 *
 * ⚠ SOURCE GUARD, so it answers this class's known failure modes explicitly:
 *   • reads CODE, not prose, through the repo's canonical `stripComments`
 *     (`lint-one-comment-stripper.mjs` keeps there being exactly one) — the
 *     component's comments quote the patterns these assertions forbid, and an
 *     earlier guard of mine convicted its own fix that way, twice;
 *   • COUNTS the mounts instead of matching one, because a file-level match
 *     cannot say WHICH of five card call sites lost its badge;
 *   • pins the badge to the component it belongs to, not to a line number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));
const BENCH = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
const PAGE = read('app/dashboard/[eventId]/vendors/page.tsx');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('the page READS the unread counts and hands them down', () => {
  assert.match(
    PAGE,
    /readUnreadChatCountsByThread\(supabase, user\.id\)/,
    'the couple RLS client and this user — notifications are user-scoped',
  );
  assert.match(
    PAGE,
    /benchUnreadFrom\(unreadRead\)/,
    'error + complete must be folded into one measured flag, not read raw at a call site',
  );
  assert.match(
    PAGE,
    /unread=\{\{ pairs: \[\.\.\.benchUnread\.countByThread\], measured: benchUnread\.measured \}\}/,
    'pairs, not a Map — this file rebuilds Sets/Maps across the boundary by convention',
  );
});

test('🪤 the badge is on the SUPPLIER card and NOT on the search-result card', () => {
  /* ⚠ THIS ASSERTED 2 AND IT WAS WRONG — corrected on CI's evidence, not by
     flipping a number to go green. `InlineMoreCard` renders a
     `CategoryVendorResult`: a MARKETPLACE SEARCH result for the inline "More in
     {category}" row, whose type carries no thread, inquiry, unread or chat field
     at all, because these are vendors the couple has not added yet. A vendor with
     no conversation cannot have unread messages. tsc caught it (TS2339 on
     `v.threadId` at the InlineMoreCard call site) after three local typechecks
     were OOM-killed and the answer came from CI instead.

     🔑 So the count is 1, and the reason is asserted in BOTH directions — the
     supplier card must HAVE it and the search card must NOT — because a bare
     "expect 1" would be satisfied by putting the badge on the wrong one. */
  assert.equal(count(BENCH, /<UnreadBadge threadId=\{v\.threadId\} \/>/g), 1, 'exactly one card type carries it');

  const bodyOf = (fn: string) => {
    const from = BENCH.indexOf(fn);
    assert.ok(from > 0, `${fn} must exist — repoint this guard if it was renamed`);
    // Window ends at the next top-level function so it cannot borrow the next
    // component's markup and call it this one's.
    const next = BENCH.indexOf('\nfunction ', from + 1);
    return BENCH.slice(from, next > 0 ? next : undefined);
  };
  assert.match(
    bodyOf('function VendorCard('),
    /<UnreadBadge threadId=\{v\.threadId\} \/>/,
    'the supplier card lost its badge',
  );
  assert.doesNotMatch(
    bodyOf('function InlineMoreCard('),
    /<UnreadBadge/,
    'a marketplace search result has no conversation — badging it needs a new read, not a wider type',
  );
});

test('🪤 the tile head and BOTH folder-head branches carry the deduped rollup', () => {
  // The folder meta has two branches (flag ON summary / flag OFF "N considering").
  // A badge in only one would vanish when the flag flipped.
  assert.equal(
    count(BENCH, /<UnreadRollupBadge vendors=\{/g),
    3,
    'one tile head + both folder-head branches',
  );
  assert.match(BENCH, /<UnreadRollupBadge vendors=\{t\.vendors\} \/>/, 'the category row');
  assert.equal(
    count(BENCH, /<UnreadRollupBadge vendors=\{folder\.tiles\.flatMap\(\(x\) => x\.vendors\)\} \/>/g),
    2,
    'both folder-head branches',
  );
});

test('🪤 the rollup is the SHARED one — no hand-rolled count beside it', () => {
  // The defect the drawing would have shipped: summing per CARD. If a head ever
  // counts vendors itself, one supplier on three cards reads as 3.
  assert.doesNotMatch(
    BENCH,
    /unrd[^\n]*\{[^}]*\.vendors\.length/,
    'a head is counting cards instead of asking the deduped rollup',
  );
  assert.doesNotMatch(
    BENCH,
    /countByThread\.get\(/,
    'the component must not read the map directly — the dedupe lives in bench-unread.ts',
  );
});

test('🪤 an absent provider shows NO badge — the default is unmeasured', () => {
  assert.match(
    BENCH,
    /createContext<BenchUnread>\(UNREAD_UNKNOWN\)/,
    'defaulting to a measured empty map would render 0 badges as "nothing unread"',
  );
  assert.match(BENCH, /measured: unread\?\.measured === true/, 'absent prop must not be truthy-measured');
  assert.match(BENCH, /<UnreadCtx\.Provider value=\{benchUnread\}>/, 'the provider must actually wrap the tree');
});

test('🪤 the stylesheet literal holds no backtick — it cannot, and once did', () => {
  /* A source guard reads TEXT, not code: this file's six other tests all passed
     while `shortlist-categories.tsx` DID NOT COMPILE. The cause was a backtick in
     a comment INSIDE the `SLCAT_CSS = ` template literal — markdown-quoting a
     class name there ends the literal, and the rest of the stylesheet parses as
     JavaScript (TS1005). tsc caught it; no test could have.

     🔑 So this asserts the property tsc proved, in the place a future editor will
     be tempted to break it — because the habit of quoting `.a-class` in a comment
     is correct everywhere in this file EXCEPT inside that literal. */
  const raw = readFileSync(
    resolve(WEB, 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'),
    'utf8',
  );
  const open = raw.indexOf('const SLCAT_CSS = ' + '`');
  assert.ok(open > 0, 'SLCAT_CSS must exist — repoint this guard if the stylesheet moved');
  const bodyStart = open + ('const SLCAT_CSS = ' + '`').length;
  const bodyEnd = raw.indexOf('`;', bodyStart);
  assert.ok(bodyEnd > bodyStart, 'the stylesheet literal must be closed');
  const body = raw.slice(bodyStart, bodyEnd);
  assert.equal(
    (body.match(/`/g) ?? []).length,
    0,
    'a backtick inside SLCAT_CSS ends the template literal and the file stops compiling',
  );
});

test('the badge renders its own words from the shared helpers, and is reachable', () => {
  // Both badge components must go through unreadBadgeLabel (which returns null
  // for 0 and for unmeasured) rather than interpolating a number.
  // Two badge COMPONENTS (UnreadBadge + UnreadRollupBadge), each wording itself
  // through the shared helpers. This counts the components, not the mount sites.
  assert.equal(count(BENCH, /unreadBadgeLabel\(/g), 2, 'one per badge component');
  assert.equal(count(BENCH, /unreadBadgeAria\(/g), 2, 'every badge is announced');
  assert.match(BENCH, /if \(label == null\) return null;/, 'no string → no badge');
  // The class must exist in the stylesheet or the badge is invisible.
  assert.match(BENCH, /\.slcat \.unrd\{/, 'the badge needs its own rule');
  assert.doesNotMatch(BENCH, /\.unrd\{[^}]*position:absolute/, 'it sits inline — .pcorner already owns the corner');
});
