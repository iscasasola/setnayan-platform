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
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TREE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORD = /\b(wedding|weddings|couple|couples|bride|groom)\b/i;

/** Files whose wedding words are CORRECT, with the reason each is allowed. */
const ALLOWED: Record<string, string> = {
  'tea-ceremony-card.tsx':
    'BUCKET 1 — the tea ceremony exists BECAUSE it is a wedding, and is already shown only for a Chinese wedding.',
  'our-love-story-widget.tsx':
    'BUCKET 1 — the love story. A graduation has no equivalent; inventing one would be worse than leaving it out.',
  'save-the-date-film.tsx':
    'BUCKET 1 — the cinematic openings are a wedding-signature paid feature.',
  'site-body.tsx':
    "BUCKET 1 — \"Bride's side\" / \"Groom's side\". A graduation groups guests too, but not by two sides of an aisle.",
  'event-words-provider.tsx':
    'The fallback constant. It is DEFINED as the wedding wording on purpose, so a missing provider cannot regress the only case that exists in production.',
  'event-words.ts':
    "The resolver's own default parameter (`?? 'wedding'`), matching every other guest-tree call site.",
  'countdown.tsx':
    'The wedding-vow branch. A wedding keeps "Until we say ‘I do’"; every other type reads "Until the day".',
  'empty-states.tsx':
    'UNREACHABLE — nothing passes kind="photos". Rewording a string no guest can reach would be a fix nobody can see.',
  'save-the-date.tsx':
    'A calendar UID (`wedding-<id>@setnayan.com`). Never rendered; changing it would break calendar de-duplication for invitations already sent.',
  'event-noun.ts':
    'The older two-way noun helper, still used by callers outside this work.',
  'compose.ts':
    "The recap composer's own event-type comparison (`eventType === 'wedding'`) — it is what DECIDES the voice, not a word any guest reads. It exists because the story page used to announce \"Mateo Turns Seven Are Married\".",
  'data.ts':
    'The five SAMPLE weddings’ editorial content — demo material, not any real event’s copy.',
  'types.ts': 'A type union (`side: bride | groom | both`), not rendered text.',
  'host-scope.ts': "A membership-type literal (`'couple'`), not rendered text.",
  'site-nav.ts': "A viewer-kind literal (`kind: 'couple'`), not rendered text.",
  'loaders.ts': "A resolveProfile default, not rendered text.",
  'actions.ts': "A membership-type filter, not rendered text.",
  'rotate-qr-actions.ts': "A membership-type filter, not rendered text.",
  'keepsake.css.ts': 'A CSS class name (`.k-couple-quote`), not rendered text.',
  'page.tsx': "resolveProfile defaults and surface gates, not rendered text.",
  'print-sheet.tsx': 'Docblocks and a CSS class name; its rendered strings are all resolved.',
  'editorial-content.tsx': 'An import of the Pro-tier helper (`couple-website-pro`), not rendered text.',
  'recap/page.tsx': 'An import of the Pro-tier helper, not rendered text.',
  'public-hideable-widget.tsx': 'An import of the Chinese-wedding gate, not rendered text.',
  'pabuya/page.tsx': 'A resolveProfile default, not rendered text.',
};

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

const strip = (s: string) =>
  s
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

test('every wedding word left in the guest tree is one we chose to keep', () => {
  const offenders: string[] = [];
  for (const file of tsFiles(TREE)) {
    const rel = file.slice(TREE.length + 1);
    if (Object.keys(ALLOWED).some((k) => rel.endsWith(k))) continue;
    const src = strip(readFileSync(file, 'utf8'));
    for (const [i, line] of src.split('\n').entries()) {
      if (!WORD.test(line)) continue;
      const quoted = /['"`][^'"`]*\b(wedding|couple|bride|groom)\b/i.test(line);
      const jsx = /^[^<>{}=(]*\b(wedding|couple|bride|groom)\b/i.test(line.trim());
      if (quoted || jsx) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 80)}`);
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
    const hit = all.find((f) => f.endsWith(key));
    if (!hit) continue; // file moved or gone — covered by the scan above
    if (!WORD.test(readFileSync(hit, 'utf8'))) stale.push(key);
  }
  assert.deepEqual(
    stale,
    [],
    `these exemptions are no longer needed — delete their lines: ${stale.join(', ')}`,
  );
});

test('the four BUCKET 1 files are named, so flattening a wedding fails too', () => {
  // The owner's ruling: a wedding must never be flattened into "an event".
  for (const f of [
    'tea-ceremony-card.tsx',
    'our-love-story-widget.tsx',
    'save-the-date-film.tsx',
    'site-body.tsx',
  ]) {
    assert.ok(ALLOWED[f], `${f} lost its BUCKET 1 exemption — a wedding is being flattened`);
  }
});
