/**
 * the-card-opens-at-the-tap.test.ts — ⚡ A GUEST'S CARD SHOWS THE PERSON AT THE TAP, AND ONLY THEIR CARD IS ASKED FOR.
 *
 * Owner, 2026-10-27, on his own event in the iPhone app: the Guests › guest card takes ~2 s to open. *"Consistent,
 * reliable AND fast."*
 *
 * The cause, measured (not guessed): a tap on a row moved the address (`?inspect=<id>`) with `router.push`, and Next
 * re-rendered the WHOLE Guests page on the server for it — every read of the list, and every name on it sent back to the
 * phone (~312 KB for a 182-guest list, measured in `/dev/guests-lab?part=screen&open=1&many=150`) — while the sheet said
 * only "Opening…". The person's name was not on screen until all of that had arrived and the whole list had been redrawn:
 * a median 3,153 ms tap → name in Chromium at 4× CPU (390 × 844), 1,068 ms in WebKit unthrottled. Closing it did the
 * same again.
 *
 * Held here — properties, each executed or read off the code that decides it:
 *
 *   1 · the row's tap hands the inspector a BODY IT READS ITSELF (`InspectorHeld`): `load` is the one card-only reader
 *       (`openGuestCard` from the Guest list's actions), and `head` draws the person from the row already on screen —
 *       never a bare `select(id)`, which is the full-page navigation.
 *   2 · the head is the card's OWN head: face · eyebrow · name · reply from `guest-card-head.tsx`, the module the card
 *       itself draws them with — so what shows at the tap is what the card arrives with, and the header does not jump.
 *   3 · `InspectorLayout`, given a held body on an in-place surface, opens WITHOUT a server render: it reads the one body
 *       and moves the address with a native `pushState` — `router.push` is not reached — and closing asks nothing either.
 *       Until the body arrives the sheet draws the head (its first paint awaits no network); a refusal is said, with
 *       "Try again", inside that head.
 *   4 · the page's own card takes over only for the id the address names (`inspectorId`), so a stale server body never
 *       stands in for another guest, and a save's revalidation (newer) replaces the held one.
 *   5 · the opener ships with the list: it is imported statically, so the first tap fetches no code before it asks.
 *   6 · the card read alone is no deeper than the page (`guests-page-reads.harness.ts` › cardAlone, executed in
 *       `the-guests-page-asks-once.test.ts`): who is asking rides beside the card's reads, on its own client.
 *
 * NOT CLAIMED: the milliseconds — those are the lab walk's (`/dev/guests-lab?part=screen&open=1&many=150`, Playwright,
 * 390 × 844, Chromium CPU 4× + WebKit), in the PR. A source can say what is asked and when; only a browser can time it.
 *
 * SABOTAGE (seen RED, then restored): the row's tap back to `inspector.select(id, el)` → (1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const G = 'app/dashboard/[eventId]/guests';
const SCREEN = read(`${G}/_components/guests-screen.tsx`);
const COLUMN = read('app/_components/inspector/inspector-column.tsx');
const ACTIONS = read(`${G}/_components/guest-actions-context.tsx`);
const PAGE = read(`${G}/page.tsx`);
const OPENER = read(`${G}/open-guest-card.tsx`);

/** The text of `const <name> = …` up to the next top-level-ish `\n  };` that closes it. */
function arrow(src: string, name: string): string {
  const at = src.indexOf(`const ${name} = (`);
  assert.ok(at >= 0, `\`const ${name} = (\` is gone`);
  const end = src.indexOf('\n  };', at);
  return src.slice(at, end);
}

test('1 · a tap on a row hands the inspector the card read alone, and the person drawn from the row', () => {
  const open = arrow(SCREEN, 'openCard');
  const select = open.match(/inspector\.select\(id, el, \{([\s\S]*?)\n {4}\}\);/);
  assert.ok(select, 'the row’s tap no longer hands `select` a held body — a bare select(id) re-renders the WHOLE list to open one card');
  assert.match(select[1]!, /load: \(\) => openGuestCard\(eventId, id\)/, 'the held body must be read by the ONE card-only reader');
  assert.match(select[1]!, /head: \(body\) =>[\s\S]*<InspectorColumn[\s\S]*\{body\}[\s\S]*<\/InspectorColumn>/, 'the head must wrap whatever the body says meanwhile');
  assert.match(SCREEN, /const \{ openGuestCard \} = useGuestActions\(\);/, 'the reader must come from the Guest list’s actions (the lab hands in a stand-in)');
  // The only bare select left is for an id the list does not hold (nothing to draw a head from).
  const bare = [...open.matchAll(/inspector\.select\(id, el\)/g)].length;
  assert.ok(bare <= 1, 'more than one bare select(id) — a row path that waits for the whole page again');
  assert.match(open, /const g = byId\.get\(id\);\s*if \(!g\) \{\s*inspector\.select\(id, el\);/, 'a bare select is only for an id the list does not hold');
});

test('2 · the head at the tap is the card’s own head — the same words, the same face', () => {
  const open = arrow(SCREEN, 'openCard');
  assert.match(SCREEN, /import \{ GuestCardAvatar, guestCardEyebrow, guestCardReply, guestCardTitle \} from '\.\/guest-card-head';/);
  for (const piece of [
    /eyebrow=\{guestCardEyebrow\(g, \{ hasSides, roleNames, plusOneOf \}\)\}/,
    /title=\{title\}/,
    /const title = guestCardTitle\(g, plusOneOf\);/,
    /badge=\{guestCardReply\(g,/,
    /lead=\{<GuestCardAvatar guest=\{g\} photoDisplayUrl=\{faceByGuest\[id\] \?\? null\} size="head" \/>\}/,
    /\bpinSlot\b/,
    /swapKey=\{id\}/,
  ]) {
    assert.match(open, piece, `the head at the tap no longer draws ${piece} the way the card does`);
  }
  // …and the card draws its head from the very same module (re-exported by the body).
  const BODY = read(`${G}/_components/guest-card-body.tsx`);
  assert.match(BODY, /export \{ GuestCardAvatar, guestCardEyebrow, guestCardReply, guestCardTitle \} from '\.\/guest-card-head';/);
  for (const fn of ['guestCardEyebrow', 'guestCardTitle', 'guestCardReply', 'GuestCardAvatar']) {
    assert.doesNotMatch(BODY, new RegExp(`export function ${fn}\\(`), `${fn} has a second definition in the body — two heads can drift`);
  }
  // The +1's card wording rides on the row's words, so a +1's head says "+1 of …" at the tap too.
  assert.match(open, /const plusOneOf = plusWords\.get\(id\)\?\.card \?\? null;/);
});

test('3 · in place, InspectorLayout opens and closes without a server render — the head paints first', () => {
  const at = COLUMN.indexOf('const select = useCallback(');
  const sel = COLUMN.slice(at, COLUMN.indexOf('\n  );', at));
  const inPlace = sel.match(/if \(inPlace && h\) \{([\s\S]*?)\n {6}\}/);
  assert.ok(inPlace, 'select() no longer has an in-place branch for a held body');
  assert.match(inPlace[1]!, /read\(id, h\);/, 'the held body is not read');
  assert.match(inPlace[1]!, /shallow\(id\);/, 'the address must move WITHOUT a navigation');
  assert.match(inPlace[1]!, /return;/, 'the in-place branch falls through to push(id) — the full-page render');
  assert.doesNotMatch(inPlace[1]!, /\bpush\(/, 'the in-place branch navigates');
  assert.match(COLUMN, /const shallow = useCallback\(\s*\(id: string \| null\) => \{\s*window\.history\.pushState\(null, '', buildUrl\(id\)\);/, 'shallow must be a native pushState (Next follows it, the server is not asked)');
  const ci = COLUMN.indexOf('const close = useCallback(');
  const close = COLUMN.slice(ci, COLUMN.indexOf('\n  }, [', ci));
  assert.match(close, /if \(inPlace\) \{[\s\S]*shallow\(null\);\s*return;/, 'closing an in-place card asks the server for the whole list again');
  // While the body is being read, the sheet shows the head — never nothing, never a navigation's wait.
  assert.match(COLUMN, /heldNow\.card \?\?\s*serverBody \?\?\s*heldNow\.head\(/, 'until the card arrives, the head must be drawn');
  assert.match(COLUMN, /heldNow\.reason \?[\s\S]*?<StatusLine[\s\S]*?label: 'Try again'/, 'a refused read must be said, with Try again, inside the head');
  assert.match(COLUMN, /<InspectorSheet onClose=\{close\}>\{shown\}<\/InspectorSheet>/, 'the phone sheet must draw what is shown (the held body), not only the server’s');
});

test('4 · the page’s card counts only for the id the address names; a newer server card replaces the held one', () => {
  assert.match(PAGE, /inspectorId=\{inspectorBody && inspectedGuest \? inspectedGuest\.guest_id : null\}/, 'the Guests page must say whose card it rendered');
  assert.match(COLUMN, /const serverBody = hasSelection && \(!inPlace \|\| inspectorId === selectedId\) \? inspector : null;/);
  assert.match(COLUMN, /setHeld\(\(cur\) => \(cur && hasSelection && inspectorId === cur\.id \? null : cur\)\);/, 'a newer server card for the held id must take over');
});

test('5 · the card-only opener ships with the list (no code fetched at the first tap), and answers for the list', () => {
  assert.match(ACTIONS, /^import \{ openGuestCard \} from '\.\.\/open-guest-card';$/m, 'the opener must be imported statically');
  assert.doesNotMatch(ACTIONS, /import\(['"]\.\.\/open-guest-card['"]\)/, 'a lazy import fetches a chunk at the first tap, before the card is even asked for');
  assert.match(ACTIONS, /openGuestCard: \(eventId, guestId\) => openGuestCard\(eventId, guestId, 'list'\)/);
  assert.match(OPENER, /list: \(eventId: string, guestId: string\) => `\/dashboard\/\$\{eventId\}\/guests\?inspect=\$\{guestId\}`/, 'a failed save on a list card must land back on that open card');
});

test('6 · who is asking rides beside the card’s reads, on its own client', () => {
  const fn = OPENER.slice(OPENER.indexOf('export async function openGuestCard('));
  const user = fn.indexOf('const userRead = getCurrentUser();');
  const cardRead = fn.indexOf('await readGuestCard(');
  const userWait = fn.indexOf('await userRead');
  assert.ok(user > 0 && cardRead > user && userWait > cardRead, 'the sign-in check is awaited before the card’s reads leave — one trip in front of every read');
  assert.doesNotMatch(fn, /supabase\.auth\.getUser\(\)/, 'a sign-in check on the card’s own client holds its auth lock: every read waits behind it');
  assert.match(fn, /if \(!user\) return \{ ok: false, reason: COULD_NOT_OPEN \};/, 'a stranger must still be refused');
});
