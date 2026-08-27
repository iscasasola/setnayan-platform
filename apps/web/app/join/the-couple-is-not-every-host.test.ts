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
 * ── MUTATIONS, MEASURED ─────────────────────────────────────────────────────
 * · revert one signed-out string in the join door → `the couple` there 0 → 1 · RED
 * · drop the resolver call from the join door → `eventWordsForEvent` 1 → 0 · RED
 * · drop the required prop at the preview call site → TYPECHECK fails, which is
 *   that half's guard and is stronger than a string count.
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

const count = (h: string, n: string) => h.split(n).length - 1;

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
    count(strip(src).toLowerCase(), 'the couple’s'),
    0,
    'the gift page must not name a wedding on a funeral',
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
