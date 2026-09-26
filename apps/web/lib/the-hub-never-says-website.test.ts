import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

/**
 * THE HUB NEVER SAYS "WEBSITE" (owner, 2026-09-24: *"Not a website. Event Hub"*;
 * re-affirmed for the Event Hub Maker, 2026-09-25).
 *
 * The couple's one link is an **Event Hub**. The editor and the controller were
 * built when it was "the wedding website", and the word survived in the copy a
 * couple reads — the editor's title, the address row, the music switch, the
 * dress-code page — long after the ruling. Nothing fails when it does: the
 * page renders, the row routes, and the couple is told the product is a thing
 * the owner said it is not.
 *
 * WHAT THIS READS: every non-test `.ts`/`.tsx` under the Maker's own tree —
 * `dashboard/[eventId]/website/**` and `dashboard/[eventId]/launch/**` — and
 * `lib/customer-menu.ts`, with COMMENTS STRIPPED by the one canonical lexer
 * (`lib/strip-comments.ts`), because half these files explain the rename in
 * prose and quote the word while doing it.
 *
 * WHAT IS NOT A WORD A COUPLE READS, and so is not counted:
 *   · the route segment `/website/…` and identifiers (`websiteOn`,
 *     `website_open_browse`, `WEBSITE_PRO_ITEMS`) — the word is joined to a
 *     `/`, `_`, `-` or a letter;
 *   · the bare KEY literal `'website'` — a profile surface name
 *     (`surfaceEnabled(profile, 'website')`), never rendered.
 * Routes and keys are frozen on purpose (owner: "label change only").
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const ROOTS = [
  'app/dashboard/[eventId]/website',
  'app/dashboard/[eventId]/launch',
];
const FILES = ['lib/customer-menu.ts'];

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
}

/** The word, standing alone — not a path segment, not part of an identifier. */
const WORD = /(?<![/\w-])[Ww]ebsites?(?![/\w-])/g;
/** A bare key literal: the whole string is the word. */
const KEY_LITERAL = /^['"`]websites?['"`]$/;

export function renderedWebsiteWords(source: string): string[] {
  const code = stripComments(source);
  const hits: string[] = [];
  for (const m of code.matchAll(WORD)) {
    const i = m.index ?? 0;
    const around = code.slice(Math.max(0, i - 1), i + m[0].length + 1);
    if (KEY_LITERAL.test(around)) continue;
    const lineStart = code.lastIndexOf('\n', i) + 1;
    const lineEnd = code.indexOf('\n', i);
    hits.push(code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim());
  }
  return hits;
}

test('the guard can see the word it is looking for', () => {
  assert.deepEqual(renderedWebsiteWords(`const t = 'Play music on my website';`).length, 1);
  assert.deepEqual(renderedWebsiteWords(`<p>Your Website is live</p>`).length, 1);
  // …and does not see what a couple never reads.
  assert.equal(renderedWebsiteWords(`// the website editor\nconst a = 1;`).length, 0);
  assert.equal(renderedWebsiteWords("href={`/dashboard/${id}/website/editor`}").length, 0);
  assert.equal(renderedWebsiteWords(`surfaceEnabled(profile, 'website')`).length, 0);
  assert.equal(renderedWebsiteWords(`const websiteOn = x.website_open_browse;`).length, 0);
});

test('no copy in the Event Hub Maker says "website"', () => {
  const files: string[] = [];
  for (const root of ROOTS) {
    const abs = path.join(WEB, root);
    assert.ok(existsSync(abs), `${root} is gone — this guard would pass on nothing`);
    walk(abs, files);
  }
  for (const f of FILES) {
    const abs = path.join(WEB, f);
    assert.ok(existsSync(abs), `${f} is gone — this guard would pass on nothing`);
    files.push(abs);
  }
  assert.ok(files.length > 40, `only ${files.length} files scanned — the walk went blind`);

  const offenders: string[] = [];
  for (const file of files) {
    for (const line of renderedWebsiteWords(readFileSync(file, 'utf8'))) {
      offenders.push(`${path.relative(WEB, file)}: ${line}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a couple would read "website" here — it is an Event Hub:\n  ${offenders.join('\n  ')}`,
  );
});

/*
 * THE EVENT HUB'S OWN LANDING PAGE (added 2026-09-26, GEO audit).
 *
 * `/pawebsite` is not in the Maker's tree, so the test above never read it — and
 * it was the page telling answer engines what the product IS: its title, its
 * SoftwareApplication `name` and its FAQ all called the Event Hub a "website".
 *
 * Two uses of the word are NOT a description of the product and stay allowed,
 * each deliberately (see the docblock above PAGE_TITLE in that file):
 *   · `keywords` — the search terms couples actually type;
 *   · "alternative to a wedding website" — the CATEGORY the Event Hub replaces,
 *     named as such, so the page still ranks for the phrase without claiming it.
 * Every other rendered "website" on the page is a couple being told the wrong
 * name for the thing they are buying.
 */
const HUB_LANDING = 'app/(shell)/pawebsite/page.tsx';

export function landingPageWebsiteWords(source: string): string[] {
  const code = stripComments(source)
    .replace(/\bkeywords:\s*\[[^\]]*\]/, '')
    .replace(/alternative to a wedding website/gi, '');
  return renderedWebsiteWords(code);
}

test('the landing-page carve-outs are exactly two, and nothing wider', () => {
  // SABOTAGE: widen either carve-out → one of these goes RED.
  assert.equal(landingPageWebsiteWords(`keywords: ['wedding website builder'],`).length, 0);
  assert.equal(landingPageWebsiteWords(`const t = 'Event Hub — the free alternative to a wedding website';`).length, 0);
  assert.equal(landingPageWebsiteWords(`const t = 'Event Hub — Your Editorial Wedding Website';`).length, 1);
  assert.equal(landingPageWebsiteWords(`name: 'Event Hub — Editorial Wedding Website',`).length, 1);
  assert.equal(landingPageWebsiteWords(`q: 'What’s on the website?',`).length, 1);
});

test('the Event Hub landing page never calls the product a website', () => {
  const abs = path.join(WEB, HUB_LANDING);
  assert.ok(existsSync(abs), `${HUB_LANDING} is gone — this guard would pass on nothing`);
  const offenders = landingPageWebsiteWords(readFileSync(abs, 'utf8'));
  assert.deepEqual(
    offenders,
    [],
    `${HUB_LANDING} tells a couple the Event Hub is a "website":\n  ${offenders.join('\n  ')}`,
  );
});
