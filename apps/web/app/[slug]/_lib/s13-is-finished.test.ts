/**
 * S13 IS FINISHED — and this is what stops it coming undone.
 *
 * ── WHAT IT ASSERTS ─────────────────────────────────────────────────────────
 * No wedding word reaches a guest through the Event Hub EXCEPT from the four
 * places where a wedding word is the right answer. It scans the rendered text
 * of the whole guest tree, strips comments (several files now EXPLAIN this
 * work, and prose about the defect must not read as the defect), and pins the
 * survivors as an EXACT-MATCH bill.
 *
 * ── WHY A BILL AND NOT A ZERO ───────────────────────────────────────────────
 * The owner's ruling of 2026-08-17: *"there are parts that is dedicated for
 * weddings but there are parts that should also work for non wedding/other
 * events."* A zero here would be wrong — it would mean the wedding had been
 * flattened, which is the failure the ruling exists to prevent.
 *
 * 🔑 THE BILL IS EXACT IN BOTH DIRECTIONS. A new wedding word fails. REMOVING
 * one also fails, until its line is deleted deliberately — because each of
 * these is either a wedding-only feature or a decision not to touch something,
 * and both deserve a moment's thought rather than a silent sweep.
 *
 * Run from inside this directory: `npx tsx --test ./s13-is-finished.test.ts`
 * 🪤 With a bracketed path it prints "# tests 0" and exits GREEN.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TREE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORD = /\b(wedding|weddings|couple|couples|bride|groom)\b/i;

/**
 * Files whose wedding words are CORRECT, with the reason each is allowed.
 *
 * 🔴 KEYS ARE TREE-RELATIVE PATHS AND ARE MATCHED EXACTLY. They used to be BARE
 * BASENAMES matched with `rel.endsWith(k)`, which is not an exemption list — it
 * is a wildcard. `'page.tsx'` alone exempted **11 files** and `'actions.ts'`
 * exempted 4: measured, **36 of the 127 files in this tree — 28% — were exempt**,
 * and any new file shipping as a `page.tsx` or an `actions.ts` under
 * `app/[slug]/` was born exempt and silently unguarded.
 *
 * ✅ Re-running the detector over every previously-exempt file produces **ZERO
 * new offenders** — an exactness change with no behaviour delta today, and it is
 * what lets the guard see the next file.
 */
const ALLOWED: Record<string, string> = {
  '_components/tea-ceremony-card.tsx':
    'BUCKET 1 — the tea ceremony exists BECAUSE it is a wedding, and is already shown only for a Chinese wedding.',
  '_components/our-love-story-widget.tsx':
    'BUCKET 1 — the love story. A graduation has no equivalent; inventing one would be worse than leaving it out.',
  '_components/save-the-date-film.tsx':
    'BUCKET 1 — the cinematic openings are a wedding-signature paid feature.',
  '_components/site-body.tsx':
    "BUCKET 1 — \"Bride's side\" / \"Groom's side\". A graduation groups guests too, but not by two sides of an aisle.",
  '_components/event-words-provider.tsx':
    'The fallback constant. It is DEFINED as the wedding wording on purpose, so a missing provider cannot regress the only case that exists in production.',
  '_lib/event-words.ts':
    "The resolver's own default parameter (`?? 'wedding'`), matching every other guest-tree call site.",
  '_components/countdown.tsx':
    'The wedding-vow branch. A wedding keeps "Until we say ‘I do’"; every other type reads "Until the day".',
  '_components/save-the-date.tsx':
    'A calendar UID (`wedding-<id>@setnayan.com`). Never rendered; changing it would break calendar de-duplication for invitations already sent.',
  '_lib/event-noun.ts':
    'The older two-way noun helper, still used by callers outside this work.',
  '_components/editorial/voices.ts':
    "BUCKET 1 — the badges \"Parents of the bride\" / \"Parents of the groom\". These name WEDDING ROLES, and the roles themselves are wedding-only (`guests.role` has no birthday equivalent). A birthday's guests carry `guest`, so the badge never renders. Neutralising these would invent a role nobody holds.",
  '_components/editorial/compose.ts':
    "The recap composer's own event-type comparison (`eventType === 'wedding'`) — it is what DECIDES the voice, not a word any guest reads. It exists because the story page used to announce \"Mateo Turns Seven Are Married\".",
  '_components/editorial/data.ts':
    'The five SAMPLE weddings’ editorial content — demo material, not any real event’s copy.',
  '_lib/types.ts': 'A type union (`side: bride | groom | both`), not rendered text.',
  '_lib/host-scope.ts': "A membership-type literal (`'couple'`), not rendered text.",
  '_lib/site-nav.ts': "A viewer-kind literal (`kind: 'couple'`), not rendered text.",
  '_lib/loaders.ts': "A resolveProfile default, not rendered text.",
  'actions.ts': "A membership-type filter, not rendered text.",
  'rotate-qr-actions.ts': "A membership-type filter, not rendered text.",
  'print/keepsake.css.ts': 'A CSS class name (`.k-couple-quote`), not rendered text.',
  'page.tsx': 'resolveProfile defaults and surface gates, not rendered text.',
  'print/page.tsx':
    'resolveProfile defaults and the Pro-tier helper import, not rendered text. Named in its own right now that a bare "page.tsx" no longer wildcards eleven files.',
  'print/print-sheet.tsx': 'Docblocks and a CSS class name; its rendered strings are all resolved.',
  '_components/editorial/editorial-content.tsx': 'An import of the Pro-tier helper (`couple-website-pro`), not rendered text.',
  // 🛑 `recap/page.tsx` USED TO SIT HERE, exempt for "an import of the Pro-tier
  // helper, not rendered text". The import was real and the reason was FALSE:
  // the same file rendered "hasn’t published their wedding recap" to the guests
  // of every birthday, debut and wake whose day had passed. It is no longer a
  // FILE exemption — see ALLOWED_LINES below.
  '_components/public-hideable-widget.tsx': 'An import of the Chinese-wedding gate, not rendered text.',
  'pabuya/page.tsx': 'A resolveProfile default, not rendered text.',
};

/**
 * PARDONS KEYED ON A LINE, NOT ON A FILE — and this is the lesson of the commit
 * that added them.
 *
 * 🔴 A FILE-LEVEL EXEMPTION BLINDS THIS GUARD TO EVERYTHING IN THE FILE. That is
 * how `recap/page.tsx` came to be pardoned for an IMPORT while rendering a
 * wedding word to guests of every event type — a true sentence about one line
 * bought silence over the whole file, and nothing could ever report it.
 *
 * 🪤 AND THE FIRST ATTEMPT AT THIS FIX REPRODUCED THE DISEASE. It kept the file
 * exemption and merely rewrote its REASON to be true — which removed the file
 * from the derived claim-check below (whose subjects are the reasons that say
 * "not rendered text"), leaving the page unguarded a second time. The mutation
 * run caught it: reverting the sentence left the guard GREEN. Nothing but
 * measuring would have found that. **When only one line needs pardoning, pardon
 * the LINE.**
 */
const ALLOWED_LINES: ReadonlyArray<{ file: string; snippet: string; why: string }> = [
  {
    file: 'recap/page.tsx',
    snippet: "from '@/lib/couple-website-pro'",
    why: 'The Pro-tier helper import. The rest of this file — its rendered stand-in included — stays under the scan.',
  },
];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

/**
 * ONE strip, shared by every rule in this file — deliberately, because two
 * rules in one guard that resolve their input differently is how a regression
 * ships green here. The trailing-`//` pass is new: `? // the anchor lives on a
 * SHIPPED block; a couple's own column…` is a COMMENT, and the old
 * line-leading-only rule left it standing as prose that reads as a defect. The
 * `[^:]` lookbehind spares `https://`. Measured across the tree: it removes 2
 * comment hits and changes the offender count by 0.
 */
const strip = (s: string) =>
  s
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, (_m, p1: string) => p1);

/**
 * 🔴 THE OLD DETECTOR SPELT THE WORDS SINGULAR — `\b(wedding|couple|bride|
 * groom)\b` — while the gate above it (`WORD`) already knew the plurals. `\b`
 * after `couple` cannot match "couples", so EVERY plural was invisible to both
 * halves of the test. It is spelt once, here, and shared.
 */
const RENDERED_WORD = /\b(weddings?|couples?|brides?|grooms?)\b/i;

/** A wedding word inside a string/template literal — an import, a filter, a class. */
const isQuoted = (line: string) =>
  new RegExp(`['"\`][^'"\`]*${RENDERED_WORD.source}`, 'i').test(line);

/**
 * A wedding word standing in JSX TEXT — the kind a guest reads.
 *
 * 🔴 THE OLD RULE WAS ONE ANCHORED REGEX, AND IT IS WHY THE RECAP PAGE'S
 * SENTENCE WAS UNREACHABLE BY THIS GUARD EVEN WITHOUT ITS EXEMPTION.
 * `^[^<>{}=(]*` fails at character zero on a line that OPENS with `{` or `<` —
 * which is how guest-tree copy is normally written:
 *
 *     {event.display_name} hasn’t published their wedding recap.
 *     <Perk>Marketplace exposure to other PH couples</Perk>
 *
 * So the two most natural ways to write a sentence were the two shapes the
 * detector could not see. It now tries the anchor three times: on the raw line,
 * on the line with `{…}` interpolations removed, and on the line with JSX TAGS
 * removed as well — the last leaving only what a person actually reads.
 *
 * 📏 MEASURED BEFORE SHIPPING, over all 128 files of this tree: the widened
 * rule surfaces EXACTLY ONE line the old rule missed — the recap sentence this
 * commit fixes — and the non-exempt offender count stays 0. No churn, no
 * baseline to pay down.
 */
const isJsxText = (line: string) => {
  const t = line.trim();
  const noInterp = t.replace(/\{[^{}]*\}/g, '');
  const noTags = noInterp.replace(/<[^<>]*>/g, ' ').trim();
  const anchored = new RegExp(`^[^<>{}=(]*${RENDERED_WORD.source}`, 'i');
  return anchored.test(t) || anchored.test(noInterp) || anchored.test(noTags);
};

test('every wedding word left in the guest tree is one we chose to keep', () => {
  const offenders: string[] = [];
  for (const file of tsFiles(TREE)) {
    const rel = file.slice(TREE.length + 1);
    // EXACT. `endsWith` here is what made 28% of this tree exempt by accident.
    if (Object.hasOwn(ALLOWED, rel)) continue;
    const src = strip(readFileSync(file, 'utf8'));
    for (const [i, line] of src.split('\n').entries()) {
      if (!WORD.test(line)) continue;
      if (!(isQuoted(line) || isJsxText(line))) continue;
      // A LINE pardon covers exactly its own line — never the file around it.
      if (ALLOWED_LINES.some((a) => a.file === rel && line.includes(a.snippet))) continue;
      offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a wedding word is reaching a guest from a file that is not on the allowed ' +
      `list:\n${offenders.join('\n')}\n\nEither resolve it from the event type, ` +
      'or add the file to ALLOWED with the reason it is correct.',
  );
});

test('the allowed list is a BILL — every entry still has a wedding word in it', () => {
  // If a file no longer contains one, the exemption is stale and must be
  // deleted rather than left standing as permission nobody needs.
  const stale: string[] = [];
  const all = tsFiles(TREE);
  for (const key of Object.keys(ALLOWED)) {
    const hit = all.find((f) => f.slice(TREE.length + 1) === key);
    if (!hit) continue; // file moved or gone — covered by the scan above
    if (!WORD.test(readFileSync(hit, 'utf8'))) stale.push(key);
  }
  assert.deepEqual(
    stale,
    [],
    `these exemptions are no longer needed — delete their lines: ${stale.join(', ')}`,
  );
});

test('the LINE pardons are a bill too — every snippet still exists', () => {
  // A pardon nobody needs is permission left lying around. If the line is gone,
  // its entry goes with it rather than standing as silence over a file.
  const gone = ALLOWED_LINES.filter(({ file, snippet }) => {
    const abs = join(TREE, file);
    return !existsSync(abs) || !strip(readFileSync(abs, 'utf8')).includes(snippet);
  }).map((a) => `${a.file} :: ${a.snippet}`);
  assert.deepEqual(
    gone,
    [],
    `these line pardons are stale — delete them: ${gone.join(', ')}`,
  );
});

/**
 * AN EXEMPTION IS A CLAIM. THIS RE-CHECKS THE CLAIM AGAINST THE FILE.
 *
 * 🔴 WHY IT EXISTS. `recap/page.tsx` was exempt "An import of the Pro-tier
 * helper, not rendered text." The import was real; the reason was false — the
 * same file rendered "hasn’t published their wedding recap" to the guests of
 * every birthday, debut and wake whose day had passed. Nothing could catch it:
 * the exemption is FILE-level, so it blinds the scan to everything in the file,
 * and the sentence's shape was invisible to the detector anyway. Two
 * independent failures, stacked, and each one alone was enough.
 *
 * 🔑 THE FILE SET IS DERIVED FROM THE REASONS, NOT HAND-LISTED. Whichever
 * entries CLAIM their wedding words are not rendered text are the entries this
 * re-checks — so a new exemption written with that phrase is covered the day it
 * is added, and nobody has to remember to add it here. A hand-typed list here
 * would be the very thing that let the recap page through.
 *
 * ⚖ SCOPED TO `.tsx` ON PURPOSE. Only a `.tsx` file can hold JSX text. A `.ts`
 * file's wedding words are types, filters and CSS class names — `keepsake.css.ts`
 * writes `.k-couple-quote` inside a CSS template and would otherwise be reported
 * three times. A guard that cries wolf teaches you to skim past the one time it
 * is right, so it is narrowed rather than left noisy.
 *
 * 🛡 AND IT HAS A FLOOR. If the reason wording is ever reworded away, this scan
 * would silently check nothing and pass — the shape of an empty sweep reading
 * as a clean result. Below the floor it FAILS.
 */
const CLAIMS_NOT_RENDERED = /not rendered text|never rendered|not a word any guest reads/i;
const CLAIM_CHECK_FLOOR = 5;

test('an exemption that claims "not rendered text" is telling the truth', () => {
  const liars: string[] = [];
  let checked = 0;
  for (const [rel, reason] of Object.entries(ALLOWED)) {
    if (!CLAIMS_NOT_RENDERED.test(reason)) continue;
    if (!rel.endsWith('.tsx')) continue;
    const abs = join(TREE, rel);
    if (!existsSync(abs)) continue; // moved/gone — the BILL test above reports it
    checked++;
    for (const [i, line] of strip(readFileSync(abs, 'utf8')).split('\n').entries()) {
      if (!WORD.test(line)) continue;
      if (isQuoted(line)) continue; // a quoted literal is not rendered TEXT
      if (isJsxText(line)) liars.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
    }
  }
  assert.ok(
    checked >= CLAIM_CHECK_FLOOR,
    `this check swept only ${checked} files (floor ${CLAIM_CHECK_FLOOR}) — the ` +
      'reason wording it derives its file set from has drifted, and an empty ' +
      'sweep looks exactly like a clean result. Fix the derivation, not the floor.',
  );
  assert.deepEqual(
    liars,
    [],
    'these files are exempt on the grounds that their wedding words are not ' +
      'rendered text, and a guest can read these lines:\n' +
      `${liars.join('\n')}\n\nResolve the word from the event type, or rewrite ` +
      'the exemption so it says what is actually true.',
  );
});

test('the four BUCKET 1 files are named, so flattening a wedding fails too', () => {
  // The owner's ruling: a wedding must never be flattened into "an event".
  for (const f of [
    '_components/tea-ceremony-card.tsx',
    '_components/our-love-story-widget.tsx',
    '_components/save-the-date-film.tsx',
    '_components/site-body.tsx',
  ]) {
    assert.ok(ALLOWED[f], `${f} lost its BUCKET 1 exemption — a wedding is being flattened`);
  }
});
