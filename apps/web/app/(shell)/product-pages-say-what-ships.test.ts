import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

/**
 * THE PUBLIC PRODUCT PAGES MAY ONLY PROMISE WHAT THE APP DOES.
 *
 * Sibling of `app/features/features-page-says-what-ships.test.ts`, which guards
 * `/features` and the `lib/feature-pages` registry. That refresh (#6640,
 * 2026-10-18) found the same stale claims one directory over, on the product
 * doorways a signed-out stranger reaches from the rail (`/budget`,
 * `/guest-list`, `/schedule`, `/pakanta`, `/patiktok`, `/setnayan-ai` …) — pages
 * nothing was reading. They had kept selling:
 *
 *   · /budget — a suggested split with Save / Standard / Splurge levels, a
 *     per-category "typical range" and an overdue call-out. All four went with
 *     the split planner in the B2 redo (`budget/_components/budget-screen.tsx`).
 *   · /guest-list — "Yes, No or Maybe" and an "Allow plus-one" tick. Maybe was
 *     switched off 2026-09-30 (`lib/rsvp-ask.ts`); plus-ones are a count pick.
 *   · /schedule — "invitation site", eight times. It is the Event Hub.
 *   · /pakanta, /patiktok — "cleared for sharing", a licence fact no code shows.
 *   · /setnayan-ai — "one calm weekly digest" and "chases quiet suppliers / lines
 *     up their quotes": the digest has no caller, and `chase` was removed from
 *     the in-app value copy on 2026-08-12 as never having reached a person.
 *
 * Same contract as the /features guard: each banned phrase carries the shipped
 * fact that makes it false, so a session that genuinely builds the thing knows
 * exactly what to delete here and why. Every violation is COLLECTED, never just
 * the first. Comments are stripped first — the pages' docblocks quote the old
 * claims to explain the fix.
 *
 * NOT SCANNED, deliberately: the legal pages (privacy, terms, refunds, cookies,
 * acceptable-use) — their wording is a legal text with its own review, not
 * marketing copy.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

const LEGAL = new Set(['privacy', 'terms', 'refunds', 'cookies', 'acceptable-use']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

function productFiles(): string[] {
  return walk(HERE).filter((p) => !LEGAL.has(relative(HERE, p).split(sep)[0] ?? ''));
}

const rel = (p: string) => relative(WEB, p);

/** Each: the phrase, and the shipped fact that makes it a lie today. */
const BANNED: ReadonlyArray<{ phrase: RegExp; why: string }> = [
  {
    phrase: /\bSplurge\b|Save, Standard/i,
    why:
      'The Budget has no spending levels. The suggested-split planner was removed in the B2 redo ' +
      '(`app/dashboard/[eventId]/budget/_components/budget-screen.tsx`); the three levels survive ' +
      'only in the public demo under `app/tour/budget/`.',
  },
  {
    phrase: /suggested split|typical range/i,
    why:
      'No budget surface suggests a split or shows a per-category typical range any more. The page ' +
      'is Target · Agreed · Paid · Owed, one Next line and one list in three groups.',
  },
  {
    phrase: /overdue (?:ones )?called out|overdue call-?out/i,
    why:
      'The redo has no overdue call-out: the Next line names the next payment and its date ' +
      '(`budget-summary.tsx`). Describe the Next line.',
  },
  {
    phrase: /Allow plus-one/i,
    why:
      'There is no "Allow plus-one" tick. Plus-ones are a count pick (+1, +2…; `lib/guest-parse.ts` ' +
      'clamps 0–4) that creates linked rows (`lib/extra-seats-sync.ts`).',
  },
  {
    phrase: /Yes, No(?:,)? or Maybe|Yes, No o Maybe/i,
    why: 'Guests cannot answer Maybe — switched off by the owner 2026-09-30 (`lib/rsvp-ask.ts`). A reply is yes or no.',
  },
  {
    phrase: /cleared for sharing|cleared to share/i,
    why:
      'Nothing in the code can show a sharing licence. Patiktok plays a Setnayan-owned catalogue and ' +
      'Music Maker songs are made to order; whether either is cleared on every platform is a contract ' +
      'fact, not a code fact.',
  },
  {
    phrase: /weekly digest/i,
    why:
      'No weekly digest is sent: `assembleWeeklyDigest` (`lib/setnayan-ai-triggers.ts`) is wrapped only ' +
      'by `computeUserAiDigest`, which has no caller.',
  },
  {
    phrase: /chases? (?:the )?quiet|lines up (?:their )?quotes/i,
    why:
      '`chase` was removed from the Setnayan AI value copy on 2026-08-12 ' +
      '(`studio/setnayan-ai/_components/setnayan-ai-value-copy.ts`): it is a secretary message that ' +
      'never reaches a person. Re-add the day it does.',
  },
  {
    phrase: /invitation site/i,
    why: 'The page a guest opens is the Event Hub (owner rule: "Event Hub", never "website" or "site").',
  },
];

test('the product pages exist — the guard cannot silently scan an empty tree', () => {
  const files = productFiles().map(rel);
  assert.ok(files.length >= 30, `only ${files.length} files under app/(shell) — wrong directory?`);
  for (const must of ['app/(shell)/budget/page.tsx', 'app/(shell)/guest-list/page.tsx', 'app/(shell)/schedule/page.tsx']) {
    assert.ok(files.includes(must), `${must} was not scanned`);
  }
  assert.ok(!files.some((f) => f.startsWith('app/(shell)/privacy/')), 'the legal pages are not this guard’s to read');
});

test('the product pages make no claim the app cannot keep', () => {
  const found: string[] = [];
  for (const file of productFiles()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const { phrase, why } of BANNED) {
      const hit = phrase.exec(src);
      if (hit) found.push(`${rel(file)} claims "${hit[0]}" — and the app does not do it.\n    ${why}`);
    }
  }
  assert.deepEqual(
    found,
    [],
    `The product pages make ${found.length} claim(s) the app cannot keep:\n\n` +
      found.map((f, i) => `  ${i + 1}. ${f}`).join('\n\n') +
      '\n\nIf you have genuinely SHIPPED one of these, delete its entry from BANNED and say in the ' +
      'same commit what now makes it true. Do not weaken a pattern to get green.',
  );
});

test('the product pages follow the house words — event, Event Hub', () => {
  /*
    Owner 2026-10-04: say "event", never "celebration"; 2026-09-24: the guest
    page is the "Event Hub", never a "website". Machine strings are removed
    first (`type: 'website'` is Open Graph, `'WebSite'` and `#website` are
    schema.org), and a path segment (`/website/`) is code, not copy.

    /pawebsite is exempt from "website" ONLY: it is the page for people
    searching for a "wedding website" and names the category it replaces —
    every use there is about the other product, never ours.

    MUTATION: write "celebration" or "your website" into any product page → this fails.
  */
  const bad: string[] = [];
  for (const file of productFiles()) {
    const r = rel(file);
    const src = stripComments(readFileSync(file, 'utf8'))
      .replace(/type:\s*'website'/g, '')
      .replace(/#website/g, '');
    for (const m of src.matchAll(/\bcelebrations?\b|pagdiriwang/gi)) bad.push(`${r}: says "${m[0]}"`);
    if (!r.startsWith('app/(shell)/pawebsite/')) {
      for (const m of src.matchAll(/(?<![/.\-_#])\b[Ww]ebsites?\b(?![/\-_]|\.\w)/g)) bad.push(`${r}: says "${m[0]}"`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});
