/**
 * doors-are-designed.test.ts — the doors stay one door.
 *
 * A "door" is a page somebody meets BEFORE they are inside Setnayan: a claim
 * link, an invite, a join step, a dead token. Ten of them existed with SIX
 * different hand-rolled wrappers and ten eyebrows painted in a gold that fails
 * WCAG AA. Both regressions are silent — a seventh wrapper looks fine in
 * isolation, and unreadable text renders perfectly.
 *
 * 🛡 EVERY ASSERTION HERE WAS MUTATION-CHECKED: each rule was broken on
 * purpose, the OCCURRENCE COUNT printed before and after to prove the sabotage
 * landed, and the test confirmed RED before being trusted. This repo has had
 * guards pass while the thing they guard was gone; an unmeasured mutation
 * proves nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');

/** Every .tsx under app/, excluding tests — the input to the shape rule. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const TSX_FILES = walk(APP);

/**
 * Strip comments before matching.
 *
 * 🔑 NOT COSMETIC — it is the difference between this guard working and not.
 * Every ported door carries a note explaining that `text-terracotta` was
 * REMOVED from it, and that note contains the literal string. A guard reading
 * raw source finds the word inside the sentence announcing its own removal and
 * reports the defect it just fixed. Measured: raw source says 6 offences,
 * stripped source says 0, and 0 is the true number.
 */
const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');

/**
 * THE DOORS. Enumerated explicitly rather than globbed, because the set is a
 * product decision ("what does a stranger meet before they are inside?"), not
 * a directory shape — and a glob that silently stops matching is the failure
 * mode this file exists to prevent.
 *
 * ⛔ NOT IN THIS LIST, on purpose:
 *   • /login — the owner-locked single sign-in card (2026-07-18 "we only want
 *     1 login"). It already IS the designed door; DoorShell reproduces ITS
 *     register, not the other way round. Pinned by seam-invariants.test.ts.
 *   • /signup · /forgot-password · /reset-password — the marketing paper
 *     register (Wordmark + .m-serif + --m-* tokens), consistent with each
 *     other and with the public site. Moving them is a product call about
 *     which register the account funnel wears, not a port.
 */
const DOORS = [
  'claim/[token]/page.tsx',
  // ⚠ ADDED AFTER THE FACT, AND THAT IS THE POINT. The first cut of this list
  // MISSED /host/accept — a token-gated co-host invitation whose wrapper was
  // BYTE-IDENTICAL to the Samahan one being deleted three files away, carrying
  // the same two 3.37:1 gold eyebrows. The Samahan page's own comment says it
  // "mirrors /host/accept/[token]" and that sentence was read and not followed.
  // 🔑 A HAND-ENUMERATED LIST IS A LIST OF THE DOORS YOU THOUGHT OF. That is why
  // the shape rule below exists — it does not need to know the door's name.
  'host/accept/[token]/page.tsx',
  // ⚠ AND SO WAS THIS ONE — the +1 guest confirming their name after scanning a
  // QR. Its wrapper differed from JoinShell's by one word (`gap-8` vs `gap-6`)
  // and it was invisible to the first shape rule because it framed the page with
  // a `<div>` inside a bare `<main>`, not with the `<main>` itself.
  '[slug]/welcome/page.tsx',
  // …and a THIRD miss, found by an adversarial audit: the Live Studio camera
  // seat. Its own header calls it "A DIRECT clone of the Papic seat-claim page"
  // — whose original IS in this list — so it inherited both the wrapper and the
  // "one of the couple" copy its twin had already had corrected.
  // 🔑 A CLONE INHERITS THE BUG ITS TWIN ALREADY FIXED. When you fix a page,
  // grep for its own docblock's word "clone".
  'panood/cam/[token]/page.tsx',
  // The seven gate/dead-end screens ported on the owner's ruling 2026-08-17
  // ("do all nine"): on every one of them the card only ever said "you can't
  // come in — go get your link" or "this link is dead". The camera itself is a
  // different branch and never wore it, so porting could not change any camera.
  'papic/me/[token]/page.tsx',
  'papic/seat/[token]/page.tsx',
  'papic/guest/page.tsx',
  'papic/decorate/page.tsx',
  '3d_plan/demo/[token]/page.tsx',
  // ⚠ pool is NOT here: it keeps a <main> for its live gallery, which rule 2
  // would (correctly) refuse. Its gold was fixed in the same pass; the colour
  // rule simply does not cover it. (`pabati` stood beside it until the Pabati
  // product was retired on 2026-08-21 and its page deleted.)
  'vendor/claim/[token]/page.tsx',
  'vendor/claim/[token]/finalize/page.tsx',
  'join/[eventId]/page.tsx',
  'join/[eventId]/check-email/page.tsx',
  'join/[eventId]/set-password/page.tsx',
  'join/[eventId]/success/page.tsx',
  'join/[eventId]/_components/join-shell.tsx',
  'join/[eventId]/_components/join-flow.tsx',
  'papic/join/[token]/page.tsx',
  'papic/claim/[token]/page.tsx',
  'samahan/join/[token]/page.tsx',
];

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE GOLD NEVER CARRIES TEXT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * In this repo the Tailwind slot named `terracotta` is the atelier GOLD
 * #A9834B — 3.37:1 on the cream page, an AA failure at any text size. The CTA
 * terracotta #C24E25 (4.61:1) lives in the slot named `mulberry`. The names are
 * inherited and they are backwards, which is exactly why this keeps happening:
 * `text-terracotta` LOOKS like the safe brand colour and is the unsafe one.
 *
 * A gold ICON is allowed — non-text contrast needs 3:1 and 3.37 clears it.
 */
test('no door paints TEXT in the 3.37:1 gold', () => {
  const offenders: string[] = [];
  for (const rel of DOORS) {
    const src = code(read(rel));
    const all = src.match(/text-terracotta\b(?!-)/g) ?? [];
    const icons = src.match(/text-terracotta"\s+strokeWidth/g) ?? [];
    const asText = all.length - icons.length;
    if (asText > 0) offenders.push(`${rel} (${asText})`);
  }
  assert.deepEqual(
    offenders,
    [],
    'A door is the one screen where the reader has no context to recover from ' +
      'unreadable text. Use `text-mulberry` (#C24E25, 4.61:1) for an eyebrow or ' +
      `an action, or \`text-link\` (8.22:1) for an inline link. Offenders: ${offenders.join(', ')}`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THERE IS ONE DOOR, NOT SEVEN
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Before the port these twelve files declared six different wrappers between
 * them — plus a local `Shell()` re-declared in four of them independently. Each
 * one was reasonable on its own; together they meant a guest, a supplier and a
 * crew member each met a different product.
 *
 * A door reaches the page through DoorShell, so it must never open its own
 * `<main>`. (join/[eventId]/page.tsx delegates to JoinFlow / InvalidTokenScreen
 * and renders no chrome itself, which is why "no bespoke main" is the rule
 * rather than "must import DoorShell".)
 */
test('no door hand-rolls its own page wrapper', () => {
  const offenders: string[] = [];
  for (const rel of DOORS) {
    if (/<main\b/.test(code(read(rel)))) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    'A door must render through <DoorShell>, which owns the page frame, the way ' +
      'home and the threshold colour. A seventh hand-rolled wrapper is how the ' +
      `first six happened. Offenders: ${offenders.join(', ')}`,
  );
});

test('the doors actually reach the shared shell — a rule nothing satisfies is not a rule', () => {
  // POSITIVE CONTROL. Rule 2 above is satisfied by a file with no markup at
  // all, so on its own it would pass vacuously if every door were gutted. At
  // least two thirds of the set must genuinely import the shell.
  const wearing = DOORS.filter((rel) => /door\/door-shell/.test(code(read(rel))));
  assert.ok(
    wearing.length >= 8,
    `Only ${wearing.length} of ${DOORS.length} doors import DoorShell. Rule 2 ` +
      'passes vacuously on a file that renders nothing — this is the check that ' +
      'says the shell is actually worn.',
  );
});

/**
 * THE RULE THAT DOES NOT NEED THE LIST.
 *
 * Rules 1 and 2 only ever look at DOORS — so they are exactly as good as my
 * memory of what a door is, and my memory already missed one. This rule instead
 * matches the SHAPE of the defect: a page outside the three authenticated trees
 * that opens its own full-height, centred, single-column card frame. That is
 * what all seven hand-rolled wrappers were, and it is what a NEW one would be.
 *
 * Scoped to `page.tsx` outside dashboard/admin/vendor-dashboard: inside the app
 * a centred frame is ordinary layout, and the marketing tree builds its frames
 * from `--m-*` inline styles rather than these utilities, so neither produces a
 * false positive. Measured at 0 offenders once the eight doors were ported, so
 * it is a WALL, not a ratchet — there is no baseline to pay down.
 *
 * 🪤 IT MATCHES `<div>` AS WELL AS `<main>`, AND THAT IS NOT BELT-AND-BRACES.
 * The first cut matched `<main>` only. An adversarial pass then rebuilt a door's
 * frame as a `<div>` wrapped around the shell and the rule stayed GREEN — and
 * widening it immediately surfaced a REAL eighth door (`[slug]/welcome`) that
 * frames its page exactly that way and had been missed. The evasion and the
 * genuine miss turned out to be the same blind spot.
 */
/**
 * 🪤 THE FIRST CUT OF THIS RULE REQUIRED THE WIDTH ON THE SAME TAG
 * (`max-w-`/`w-full` inside the `<main>` itself) — and the COMMONEST wrapper in
 * this codebase puts the width on an inner `<div>`:
 *
 *     <main className="flex min-h-screen items-center justify-center bg-cream …">
 *       <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 …">
 *
 * Four of the six wrappers <DoorShell> replaced looked exactly like that, so the
 * rule was blind to the very shape it was written for. It is now matched as a
 * PAIR — a full-height centred frame whose first child is a bounded card.
 */
const DOOR_CARD_FRAME =
  /<(?:main|div)[^>]*className="[^"]*min-h-(?:screen|dvh)[^"]*"[^>]*>\s*(?:\{[^}]*\}\s*)?<div[^>]*className="([^"]*)"/g;

/**
 * THE BILL, NAMED.
 *
 * THREE pages still carry that identical card (`w-full max-w-md rounded-2xl
 * border … bg-surface p-7`): the two live demos and /signup, each staying by
 * deliberate design (see the per-line notes below). This prose once said
 * "eight more pages … there were nine" — that was the pre-port bill; the nine
 * refusal screens were ported through <DoorShell> (e372a5e0f) and Pabati was
 * deleted with its product on 2026-08-21, and the count in this comment went
 * stale while the array beneath it stayed correct. The ARRAY is the bill;
 * this sentence now just describes it instead of counting it.
 * (Corrected 2026-08-24, W5-B — a doc that contradicts itself gets read from
 * whichever half is wrong.)
 *
 * ⚖ SO THEY ARE LISTED, NOT SILENCED — and the assertion pins the set EXACTLY.
 * A new page adopting the shape fails. Porting one of these also fails,
 * telling you to delete its line. A baseline is a bill, and this one is visible
 * and can only shrink.
 */
const KNOWN_DOOR_CARD_CLONES = [
  // Both of these ported their DEAD END to <DoorShell> and keep this card for
  // their LIVE demo — which is correct: a doorway's wordmark, eyebrow and
  // threshold edge would announce an entrance to somebody already inside the
  // thing. They are on the list because the shape is still present, not because
  // anything is owed.
  'panood/demo/[token]/page.tsx',
  'papic/demo/[token]/page.tsx',
  // /signup wears the door REGISTER (paper card, 3px terracotta top edge,
  // terracotta eyebrow and action) but keeps its own 960px TWO-COLUMN
  // composition — a brand panel beside the form, which <DoorShell> is not and
  // should not become. It is on this list because the shape is present and the
  // rule is honest about it, not because a port is owed.
  // 🔑 The guard caught this the moment the port landed, which is the whole
  // point of matching a shape rather than a filename.
  'signup/page.tsx',
].sort();

test('the door card is not copied onto a new page — the shape, not the list', () => {
  const found: string[] = [];
  const TREES = ['dashboard/', 'admin/', 'vendor-dashboard/'];
  for (const file of TSX_FILES) {
    const rel = file.slice(APP.length + 1);
    if (!rel.endsWith('page.tsx')) continue;
    if (TREES.some((t) => rel.startsWith(t))) continue;
    const src = code(readFileSync(file, 'utf8'));
    DOOR_CARD_FRAME.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DOOR_CARD_FRAME.exec(src))) {
      const child = m[1] ?? '';
      if (/max-w-/.test(child) && /(rounded-|ring-1|border)/.test(child)) {
        if (!found.includes(rel)) found.push(rel);
      }
    }
  }
  assert.deepEqual(
    found.sort(),
    KNOWN_DOOR_CARD_CLONES,
    'The centred bounded card is the door. A page NOT on this list has just copied ' +
      'it — render <DoorShell> instead. A page still ON the list that no longer ' +
      'matches has been ported — delete its line. Never add a line to go green: ' +
      'each one is a screen that looks like a door and is not one.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE SHELL ITSELF WEARS THE THRESHOLD COLOUR
   ══════════════════════════════════════════════════════════════════════════ */

test('DoorShell uses the locked action colour and never the gold slot', () => {
  const shell = code(read('_components/door/door-shell.tsx'));
  assert.match(
    shell,
    /text-mulberry/,
    'The eyebrow is the doorway label and belongs to the app side: #C24E25, ' +
      'matching the sign-in panel (.sn-signin-terra). ',
  );
  assert.doesNotMatch(
    shell,
    /text-terracotta\b(?!-)/,
    'The shell must never reach for the gold slot — it is 3.37:1 on cream.',
  );
  assert.match(
    shell,
    /border-t-mulberry/,
    'The 3px terracotta top edge is what makes a door recognisably a door; it ' +
      'is the one thing carried over from the shipped sign-in card.',
  );
});

test('a dead end does not wear the action colour', () => {
  const shell = code(read('_components/door/door-shell.tsx'));
  // The whole point of the tone split: painting "act on me" on a screen with
  // nothing to act on is a small lie told to someone who has just been refused.
  assert.match(
    shell,
    /dead_end/,
    'DoorShell must keep a dead-end tone distinct from a threshold.',
  );
  assert.match(
    shell,
    /border-t-ink\/20/,
    'A dead end gets the neutral edge, not the terracotta one.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · A DOOR IS OUTSIDE THE APP
   ══════════════════════════════════════════════════════════════════════════ */

test('no door mounts an app bottom bar', () => {
  // Seam invariant 5: the bottom bar is how a phone says "you are inside".
  // A door is by definition the moment before that. seam-invariants.test.ts
  // enforces this app-wide; this repeats it on the door set specifically,
  // because the doors are where somebody would most plausibly add one.
  const offenders = DOORS.filter((rel) =>
    /<(Customer|Admin|Vendor)BottomNav\b/.test(code(read(rel))),
  );
  assert.deepEqual(offenders, [], `Found: ${offenders.join(', ')}`);
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · A DOOR SPEAKS THE EVENT'S OWN WORDS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A DOOR IS OPENED FROM AN EMAILED LINK, SIGNED OUT, ON EVERY EVENT TYPE — and
 * two of them told the reader they were looking at a wedding.
 *
 * · `/host/accept/[token]` rendered `Wedding date: 3 September 2026` and fell
 *   back to the literal "a wedding" for an unnamed event. A family arranging a
 *   wake invites an aunt as co-host; she opens the link and reads that.
 * · `/vendor/claim/[token]` rendered "They're planning their wedding on …" in
 *   three places, to a supplier who had just been booked for the funeral.
 *
 * ⛔ THE FILE SET IS DERIVED, NOT THE `DOORS` LIST ABOVE. This file's own
 * docblock records why: *a hand-enumerated list is a list of the doors you
 * thought of*, and that list has already missed three real doors. A door for
 * THIS rule is simply a file that imports the shared shell — so a door added
 * tomorrow is covered on the day it is written, with nobody remembering to add
 * it. (Measured: 23 files, against the 21 hand-listed above.)
 *
 * 🛡 AND IT HAS A FLOOR. A derived sweep that stops matching finds nothing and
 * reports a clean pass — the exact failure this repo keeps paying for. Below
 * the floor it FAILS instead.
 */
const DOOR_IMPORT = /from\s+['"]@\/app\/_components\/door\/door-shell['"]/;
const DOOR_FLOOR = 15;

/**
 * 🔑 THE PLURALS ARE PART OF THE PATTERN. A sibling guard spelt these singular
 * with a trailing `\b`, which cannot match "couples" — so every plural was
 * invisible to it. Spelt once, used by both halves below.
 */
const WEDDING_WORD = /\b(weddings?|couples?|brides?|grooms?)\b/i;

/**
 * What a PERSON reads, as opposed to what the file merely contains. The anchor
 * is tried three ways because a line of copy rarely begins with its own words:
 * raw · with `{…}` interpolations removed · with JSX tags removed too. Without
 * the second, `{name} …their wedding…` is invisible; without the third,
 * `<Perk>…couples…</Perk>` is.
 */
const readsAsText = (line: string): boolean => {
  const t = line.trim();
  const noInterp = t.replace(/\{[^{}]*\}/g, '');
  const noTags = noInterp.replace(/<[^<>]*>/g, ' ').trim();
  const anchored = new RegExp(`^[^<>{}=(]*${WEDDING_WORD.source}`, 'i');
  const quoted = new RegExp(`['"\`][^'"\`]*${WEDDING_WORD.source}`, 'i');
  return quoted.test(t) || anchored.test(t) || anchored.test(noInterp) || anchored.test(noTags);
};

/**
 * THE BILL — AND IT IS KEYED ON A LINE, NOT ON A FILE.
 *
 * 🔑 THAT IS THE WHOLE LESSON OF THIS COMMIT. The sibling guard exempts by
 * FILE, and `recap/page.tsx` was exempt "an import of the Pro-tier helper, not
 * rendered text" — while the same file rendered "their wedding recap" to every
 * birthday and wake whose day had passed. A file-level exemption blinds a guard
 * to everything in the file, including the thing it is for. Here an entry
 * pardons one SNIPPET, so the rest of the file stays under guard.
 *
 * ⚖ These four are about SETNAYAN'S CUSTOMER BASE, not about the reader's own
 * event — "who else is on this marketplace". Whether Setnayan describes its
 * customers as "couples" now that it serves sixteen event types is a
 * positioning call and the owner's, not a typo fix. Surfaced, not silently
 * rewritten.
 */
const ALLOWED_DOOR_LINES: ReadonlyArray<{ file: string; snippet: string }> = [
  { file: 'forgot-password/page.tsx', snippet: 'One account for couples planning their' },
  { file: 'vendor/claim/[token]/page.tsx', snippet: 'Marketplace exposure to other PH couples' },
  { file: 'vendor/claim/[token]/page.tsx', snippet: 'Chat with couples in-app' },
  { file: 'vendor/claim/[token]/page.tsx', snippet: 'Couples browsing the marketplace' },
];

function doorFiles(): Array<{ rel: string; src: string }> {
  const out: Array<{ rel: string; src: string }> = [];
  for (const file of TSX_FILES) {
    const raw = readFileSync(file, 'utf8');
    if (!DOOR_IMPORT.test(raw)) continue;
    out.push({ rel: file.slice(APP.length + 1), src: code(raw) });
  }
  return out;
}

test('no door tells a mourner they are looking at a wedding', () => {
  const doors = doorFiles();
  assert.ok(
    doors.length >= DOOR_FLOOR,
    `Only ${doors.length} doors found (floor ${DOOR_FLOOR}). This rule DERIVES ` +
      'its file set from the DoorShell import; a sweep that has stopped matching ' +
      'finds nothing and reads exactly like a clean pass. Fix the derivation, ' +
      'never the floor.',
  );
  const offenders: string[] = [];
  for (const { rel, src } of doors) {
    for (const [i, line] of src.split('\n').entries()) {
      if (!WEDDING_WORD.test(line)) continue;
      if (!readsAsText(line)) continue;
      const pardoned = ALLOWED_DOOR_LINES.some(
        (a) => a.file === rel && line.includes(a.snippet),
      );
      if (!pardoned) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A door is opened from an emailed link by somebody with no session, and the ' +
      "event's type is always resolvable there. Resolve the word with " +
      '`eventWordsForEvent(eventId)` — which reads through the SERVICE-ROLE ' +
      'resolver, the only one that can answer a signed-out visitor.\n' +
      `${offenders.join('\n')}`,
  );
});

test('the door word bill is a BILL — every pardoned line still exists', () => {
  // A pardon nobody needs is permission left lying around. If the copy is gone,
  // the line here goes with it rather than standing as a standing exemption.
  const doors = doorFiles();
  const stale = ALLOWED_DOOR_LINES.filter(
    (a) => !doors.some((d) => d.rel === a.file && d.src.includes(a.snippet)),
  ).map((a) => `${a.file} :: ${a.snippet}`);
  assert.deepEqual(
    stale,
    [],
    `these pardons are no longer needed — delete their lines: ${stale.join(', ')}`,
  );
});

test('every door keeps a way out', () => {
  // DoorShell renders the wordmark → "/" for all of them, so this asserts the
  // single place that promise lives rather than twelve copies of it.
  const shell = code(read('_components/door/door-shell.tsx'));
  assert.match(
    shell,
    /href="\/"/,
    'The wordmark is the way out (owner 2026-08-13). On a dead link it is the ' +
      'only thing a person can still do, so it is never conditional.',
  );
});
