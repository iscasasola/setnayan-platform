/**
 * "THE COUPLE" IS NOT EVERY HOST — and these four files are where a guest met it.
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 * Twelve rendered strings across four files said "the couple" on every event
 * type. Nine of them are on the JOIN DOOR — the screen a guest scanning a QR
 * lands on — and two of those nine are in the SIGNED-OUT arm, which is the
 * branch a guest without an account actually reaches. The gift page was the
 * plainest: at a wake it said *"a quiet way to help the family"* in one line and
 * *"it goes directly to the couple's account"* three lines below.
 *
 * ── THE TWO RULES THIS PINS ─────────────────────────────────────────────────
 * 1 · NO HARDCODED "the couple" IN THESE FILES. Comments are stripped first —
 *   each file now EXPLAINS the defect, and prose about it must not read as it.
 * 2 · THE RESOLVER IS ACTUALLY CALLED. A file with no "couple" in it and no
 *   resolved noun either would pass rule 1 while saying nothing at all.
 *
 * 🔒 A WEDDING READS BYTE-IDENTICALLY. `organizerNoun` is `'couple'` for the
 * wedding profile, so every rewritten sentence reproduces its old text exactly;
 * `event-words.test.ts` is what pins those literals.
 * 🔒 THE FUNERAL NOUN IS `family`, NEVER `host` — no fallback in these files may
 * introduce "host", which is wrong for the one type this work exists for.
 *
 * ⚠ AND THE HALF THESE RULES COULD NOT SEE. Rule 2 counts that the resolver is
 * CALLED. It was — and it still answered "wedding" to every signed-out visitor,
 * because underneath it read `public.events` through the cookie-scoped session
 * client and that table has no SELECT policy admitting `anon`. So the wake's own
 * join door said "the couple" to the mourner who scanned its QR while this file
 * was green. *A resolver that is called is not a resolver that can answer.* The
 * read is service-role scoped now, and `lib/signed-out-words-are-the-events-own.test.ts`
 * pins the MECHANISM rather than the call.
 *
 * ── MUTATIONS, MEASURED ─────────────────────────────────────────────────────
 * · revert one signed-out string in the join door → `the couple` there 0 → 1 · RED
 * · drop the resolver call from the join door → `eventWordsForEvent` 1 → 0 · RED
 * · drop the required prop at the preview call site → TYPECHECK fails, which is
 *   that half's guard and is stronger than a string count.
 * · restore the gift-page possessive in ALL THREE spellings — straight `'`,
 *   curly `’`, and the `&rsquo;` entity that actually shipped — 0 → 1 each · RED
 *   each. Before this commit the entity spelling scored 0 and passed.
 * · restore "Their wedding song" in the recap data → 0 → 1 · RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Strip comments — several of these files now describe the defect they fixed. */
const strip = (s: string) =>
  s
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

/**
 * EVERY WAY A PERSON WRITES AN APOSTROPHE, COLLAPSED TO ONE.
 *
 * 🔴 WITHOUT THIS, THE POSSESSIVE CHECK BELOW COULD NOT MATCH THE STRING IT WAS
 * WRITTEN TO CONDEMN. It searched for `the couple’s` — the CURLY character
 * U+2019 — and the line this whole file exists because of was
 * `it goes directly to the couple&rsquo;s` — the HTML ENTITY. Measured against
 * the pre-fix source at 87edd2fc7^: curly 0 · straight 0 · entity 1. The guard
 * scored ZERO on the exact source it condemned, and reported a pass.
 *
 * 🔑 THE ENTITY IS NOT AN ODDITY, IT IS THE HOUSE STYLE. `react/no-unescaped-
 * entities` makes a bare `'` in JSX text a lint error, so anyone restoring this
 * sentence writes `&rsquo;` (or pastes `’`). The one spelling the old needle
 * knew was the one least likely to be typed. *A check that cannot match is not
 * a passing check* — same family as `f.event_dateX` and the recap page's own
 * exemption, which is fixed in the same commit.
 */
const oneApostrophe = (s: string) =>
  s.replace(/&rsquo;|&#8217;|&#x2019;|&apos;|&#39;|[‘’ʼ‛`´]/gi, "'");

const count = (h: string, n: string) => h.split(n).length - 1;
/** Count a phrase however its apostrophe was spelt. Needle uses a plain `'`. */
const countAnyApostrophe = (haystack: string, needle: string) =>
  count(oneApostrophe(haystack).toLowerCase(), oneApostrophe(needle).toLowerCase());

const JOIN_DOOR = join('app', 'join', '[eventId]', '_components', 'join-flow.tsx');
const GIFT_CARDS = join('app', '_components', 'pabuya', 'pabuya-card-list.tsx');
const FACE_GATE = join('lib', 'face-gate.ts');
const RECAP_DATA = join('app', '[slug]', '_components', 'editorial', 'data.ts');

test('the join door hardcodes no wedding noun, in EITHER arm', () => {
  const src = strip(read(JOIN_DOOR));
  assert.equal(
    count(src.toLowerCase(), 'the couple'),
    0,
    'the join door is where a QR-scanning guest lands, on every event type — ' +
      'including a wake. Resolve the noun from the event, never hardcode it.',
  );
});

test('the join door RESOLVES its words, once, for all nine sentences', () => {
  const src = strip(read(JOIN_DOOR));
  assert.ok(
    count(src, 'eventWordsForEvent(eventId)') >= 1,
    'join-flow.tsx must resolve the event words. It is already an async server ' +
      'component holding the event id, so this needs no prop and no call-site change.',
  );
  // The nine sites: 4 refusal sentences + 5 rendered strings across both arms.
  const uses = count(src, 'w.theOrganizer') + count(src, 'w.TheOrganizer');
  assert.ok(
    uses >= 9,
    `expected at least 9 resolved-noun sites in the join door, found ${uses} — ` +
      'a sentence has been reverted to a hardcoded word',
  );
});

test('the gift-page trust note takes a REQUIRED noun, with no default', () => {
  const src = read(GIFT_CARDS);
  assert.ok(
    /organizerPossessive:\s*string;/.test(src),
    'the prop must be required (no `?`, no `= ...` default). It has TWO ' +
      "guest-audience callers — the public gift page and the couple's live " +
      'preview of it — and a default would let the two drift apart silently.',
  );
  assert.ok(
    !/organizerPossessive\?:/.test(src) && !/organizerPossessive\s*=/.test(src),
    'a default here hides the second caller — the parity the preview exists for',
  );
  assert.equal(
    countAnyApostrophe(strip(src), "the couple's"),
    0,
    'the gift page must not name a wedding on a funeral — in ANY spelling of ' +
      "the apostrophe (straight ' · curly ’ · &rsquo; · &#8217; · &apos;)",
  );
});

test('every gift-note call site supplies the noun', () => {
  const sites = [
    join('app', '[slug]', 'pabuya', 'page.tsx'),
    join('app', 'dashboard', '[eventId]', 'pabuya', '_components', 'pabuya-manager.tsx'),
  ];
  for (const f of sites) {
    const src = read(f);
    const mounts = count(src, '<PabuyaTrustNote');
    const supplied = count(src, 'organizerPossessive=');
    assert.equal(
      mounts,
      supplied,
      `${f}: every <PabuyaTrustNote> must be handed the event's own noun ` +
        `(${mounts} mounted, ${supplied} supplied)`,
    );
  }
});

test('the vision helper returns a CODE and never grows event context', () => {
  const src = read(FACE_GATE);
  assert.equal(
    count(strip(src).toLowerCase(), 'the couple'),
    0,
    'lib/face-gate.ts is a pure browser quality helper with no event and no ' +
      'words. A sentence naming the organiser cannot live here.',
  );
  assert.ok(/reasonCode\?:\s*FaceGateReason/.test(src), 'it must report a code, not a sentence');
  assert.ok(
    !/eventId|eventWords|organizerNoun/.test(src),
    'do NOT pass this helper an event — that is how the next leak gets written',
  );
});

test('the capture screen owns the sentence, using the resolved words', () => {
  const src = read(join('app', '[slug]', '_components', 'selfie-capture.tsx'));
  assert.ok(/function faceGateHint\(/.test(src), 'the code→sentence map lives at the screen');
  assert.ok(
    /faceGateHint\(gate\.reasonCode, w\.theOrganizer\)/.test(src),
    'the hint must be rendered from the resolved words already in scope here',
  );
});

test('the recap resolves BOTH the organiser noun and the event word', () => {
  const src = read(RECAP_DATA);
  assert.ok(
    /organizer:\s*organizerNoun,\s*\n\s*eventWord:\s*eventNoun,/.test(src),
    'a guest who ANSWERED a prompt reading "birthday" met it again on the recap ' +
      'saying "event", because only the organiser noun was passed',
  );
});

test('the song credit is never hardcoded to a wedding', () => {
  // 🔴 `songLabel` fell back to the literal "Their wedding song", and that
  // fallback ALWAYS fired for a non-wedding: its alternative is
  // `love_story.anchors.song`, a WEDDING-shaped field a birthday or a debut
  // never carries. So any other celebration that bought a custom song had it
  // credited to every guest reading their recap as the couple's wedding song.
  // The event word is already resolved a few hundred lines above for the
  // challenge prompts — it costs nothing to be right here too.
  const src = strip(read(RECAP_DATA));
  assert.equal(
    countAnyApostrophe(src, 'wedding song'),
    0,
    'the recap must not credit a wedding song on a birthday, a debut or a wake ' +
      '— derive it from the event word already resolved in this function',
  );
  assert.ok(
    /Their \$\{eventNoun\} song/.test(src),
    'the credit must be built from the resolved event word, so a wedding still ' +
      'reads "Their wedding song" byte-for-byte and every other type reads its own',
  );
});

test('no file in this fix falls back to "host" — a funeral says "family"', () => {
  for (const f of [JOIN_DOOR, GIFT_CARDS]) {
    const src = strip(read(f));
    assert.ok(
      !/['"`]the host['"`]/i.test(src),
      `${f} must not hardcode "the host" as a fallback — the funeral noun is ` +
        '"family", and "host" is wrong for the one event type this exists for',
    );
  }
});
