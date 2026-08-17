/**
 * The shipped NPC pack must not misstate the product to a regulator.
 *
 * WHY THIS EXISTS. On 2026-08-17 the compliance pack this app serves from
 * /admin/data-privacy/documents was measured against the product and was wrong
 * three ways at once — and every one of them had ALREADY been corrected in the
 * corpus markdown. The artifact never caught up:
 *
 *   • it declared FOURTEEN processing activities while nineteen were running;
 *   • it declared a **5-year hard limit** on wedding photos with 90-day-hot /
 *     5-year-cold tiering. That tiering was never built, no R2 lifecycle rule
 *     exists, and nothing is ever deleted — only its resolution changes. The
 *     pack therefore contradicted our own public /privacy page and committed us,
 *     in a filing, to destroying photos we in fact keep;
 *   • it placed media in a "PH region" that does not exist. The database is in
 *     Singapore and object storage is Cloudflare R2 Asia-Pacific.
 *
 * ROOT CAUSE, and the reason a date check would not have caught it: the PDF
 * generator's source list pointed at the superseded `_DRAFT_` documents while the
 * DPO's `_ADOPTED_` twins carried the corrections. **Regenerating alone would
 * have re-published the same false claims.** So this guard asserts on the
 * ARTIFACT — the bytes an admin downloads and a lawyer reads — never on a date,
 * a filename, or a markdown source that lives in a different repository.
 *
 * WHAT THIS GUARD IS NOT. It says nothing about whether the pack has been LODGED
 * with the NPC. Lodging is January 2027 (owner standing rule 2026-07-30: *"we
 * will do everything on january 2027 but let this run truthfully until then"*)
 * and is tracked by `npc_filing_tasks`. Truth is owed now; filing is scheduled.
 * Do not read a green run here as "we are filed", and do not relax it to match a
 * filing date.
 *
 * A CORRECTION IS NOT A DEFECT. Each corrected row keeps an audit trail that
 * quotes the wording it replaced ("previously declared a 5-year hard limit…",
 * 'Was "APAC / PH region"…'). That is exactly what a regulator should see, so a
 * naive substring search would condemn the very sentences that fix the problem.
 * Every check below therefore only fails on an occurrence that is NOT inside a
 * correction window. A guard that cried wolf here would teach the next reader to
 * skip it on the one day it is right.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';
import { NPC_DOCUMENTS } from './npc-documents';

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'npc-docs');

/** ASCII85 → bytes. The generator writes `/Filter [/ASCII85Decode /FlateDecode]`,
 *  so inflating alone yields NOTHING — which is how a check like this silently
 *  reads an empty string and passes. `assertReadable` below makes that fatal. */
function ascii85(s: string): Buffer {
  s = s.replace(/\s/g, '');
  if (s.startsWith('<~')) s = s.slice(2);
  const end = s.indexOf('~>');
  if (end !== -1) s = s.slice(0, end);
  const out: number[] = [];
  let tuple: number[] = [];
  for (const ch of s) {
    if (ch === 'z' && tuple.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    tuple.push(ch.charCodeAt(0) - 33);
    if (tuple.length === 5) {
      let v = 0;
      for (const t of tuple) v = v * 85 + t;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      tuple = [];
    }
  }
  if (tuple.length) {
    const n = tuple.length;
    while (tuple.length < 5) tuple.push(84);
    let v = 0;
    for (const t of tuple) v = v * 85 + t;
    out.push(...[(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].slice(0, n - 1));
  }
  return Buffer.from(out);
}

/** Visible text of a PDF, whitespace-normalised. Dependency-free on purpose:
 *  `pdftotext` is not guaranteed in CI, and a guard that cannot run is no guard. */
function pdfText(file: string): string {
  const buf = readFileSync(join(DOCS_DIR, file));
  const chunks: string[] = [];
  let i = 0;
  while ((i = buf.indexOf(Buffer.from('stream'), i)) !== -1) {
    const isEnd = i >= 3 && buf.subarray(i - 3, i).toString() === 'end';
    if (!isEnd) {
      let s = i + 6;
      if (buf[s] === 0x0d) s++;
      if (buf[s] === 0x0a) s++;
      const e = buf.indexOf(Buffer.from('endstream'), s);
      if (e !== -1) {
        try {
          chunks.push(zlib.inflateSync(ascii85(buf.subarray(s, e).toString('latin1'))).toString('latin1'));
        } catch {
          /* not a text stream (font, image) — skip */
        }
      }
    }
    i += 6;
  }
  return (chunks.join('\n').match(/\((?:\\.|[^\\()])*\)/g) ?? [])
    .map((m) => m.slice(1, -1).replace(/\\([()\\])/g, '$1'))
    .join(' ')
    .replace(/\\\d{3}/g, ' ') // octal-escaped glyphs (·, —) become spaces
    .replace(/\s+/g, ' ');
}

/** Occurrences of `re` that are NOT inside a correction/audit-trail window. */
function liveClaims(text: string, re: RegExp): string[] {
  const WINDOW = 260;
  const CORRECTION = /CORRECTED|previously declared|Was "|no longer|superseded|retired/i;
  const hits: string[] = [];
  for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
    const before = text.slice(Math.max(0, m.index - WINDOW), m.index);
    if (!CORRECTION.test(before)) hits.push(text.slice(Math.max(0, m.index - 90), m.index + 90));
  }
  return hits;
}

/** A check that reads nothing always passes. Make that impossible. */
function assertReadable(file: string, text: string) {
  assert.ok(
    text.length > 2000,
    `${file}: extracted only ${text.length} chars — the reader is broken, so every ` +
      'assertion below is vacuous. Fix the extractor; do NOT relax the checks.',
  );
}

const ROPA = '03_Records_of_Processing_Activities.pdf';
const MANUAL = '02_Privacy_Manual.pdf';

test('every document the manifest offers actually exists in the bundle', () => {
  const missing = NPC_DOCUMENTS.filter((d) => !existsSync(join(DOCS_DIR, d.file)));
  assert.deepEqual(
    missing.map((d) => d.file),
    [],
    'a manifest entry with no file is a download that 404s for the DPO',
  );
});

test('the ROPA declares every processing activity the product runs', () => {
  const text = pdfText(ROPA);
  assertReadable(ROPA, text);
  const found = new Set(text.match(/DPS-\d+/g) ?? []);
  // The five added 2026-08-02, absent from the pack until 2026-08-17: guest
  // columns · shared photo pool · same-date demand · live video calls ·
  // coordinator day-of desk.
  for (const id of ['DPS-15', 'DPS-16', 'DPS-17', 'DPS-18', 'DPS-19']) {
    assert.ok(found.has(id), `${id} is running in the product but absent from the shipped ROPA`);
  }
  assert.ok(
    found.size >= 19,
    `the ROPA declares ${found.size} activities; the product runs at least 19`,
  );
});

test('the pack never claims wedding photos are destroyed on a schedule', () => {
  for (const file of [ROPA, MANUAL]) {
    const text = pdfText(file);
    assertReadable(file, text);
    const live = liveClaims(text, /5-year hard limit|90 days hot R2|5 years IA cold|90 days hot . 5 years cold/i);
    assert.deepEqual(
      live,
      [],
      `${file}: declares a retention rule that was never built. Nothing is deleted — ` +
        'only resolution changes. This contradicts the live /privacy page.',
    );
  }
});

test('the photo row states the real rule, not merely the absence of a false one', () => {
  // Removing a lie is not the same as telling the truth: assert the replacement.
  const text = pdfText(ROPA);
  assertReadable(ROPA, text);
  assert.match(text, /3 months after the event ENDS/i, 'the floor counts from the last day of the celebration');
  assert.match(text, /replaced by a compressed web copy/i);
  assert.match(text, /Nothing is deleted at 5 years|never deleted on a schedule/i);
});

test('the pack never places personal data in a Philippines region', () => {
  // There is no PH region in R2. Database: Singapore. Object storage: APAC.
  let examined = 0;
  for (const d of NPC_DOCUMENTS) {
    if (!existsSync(join(DOCS_DIR, d.file))) continue;
    if (d.group === 'packet') continue; // the merged packet repeats its members
    const text = pdfText(d.file);
    if (text.length < 2000) continue; // scanned/short doc, covered via its members
    examined++;
    const live = liveClaims(text, /APAC\s*\/\s*PH|APAC\/PH|PH[- ]region/i);
    assert.deepEqual(
      live,
      [],
      `${d.file}: claims a Philippines data region we have never had — our own ` +
        'filing would contradict our own public privacy notice.',
    );
  }
  // Without this, a broken extractor makes every document "too short", the loop
  // skips them all, and the test passes having read NOTHING. Measured: sabotaging
  // the extractor left this assertion GREEN until the counter was added.
  assert.ok(
    examined >= 8,
    `only ${examined} documents were actually read — the loop skipped the pack ` +
      'instead of clearing it. Fix the extractor; do NOT lower this floor.',
  );
});
