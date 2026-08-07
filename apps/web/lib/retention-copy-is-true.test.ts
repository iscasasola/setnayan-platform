/**
 * Guard: nothing user-facing may promise a photo lifetime the deletion sweep
 * does not honour.
 *
 * THE FACTS THIS PINS (owner, 2026-08-07): "6 months are initially kept as
 * original. they can sync with their google drive."
 *   · Full-resolution originals are held for SIX MONTHS from the event's FIRST
 *     capture, then dropped. The sweep runs unless deliberately disabled.
 *   · The compressed gallery stays online for good — that part IS forever.
 *   · Connecting Google Drive is the ONLY way a couple keeps originals past
 *     six months.
 *
 * WHY THIS EXISTS: four separate surfaces promised otherwise — a "5-year
 * backup" on the delivery panel (twice) and in its demo card, and "keep your
 * raws as long as you need" on the public features page. The live privacy
 * notice said five years. Every one of them pointed the same way: relax, you
 * have years. A couple who believes that downloads nothing and loses the good
 * version of their wedding at six months.
 *
 * ⚠ SCOPE MATTERS. The drop sweep reads photo_delivery_artifacts as well as the
 * Papic tables, so it covers VENDOR-DELIVERED albums too — not only Papic
 * captures. "That claim is about photographer delivery, so it's fine" is wrong
 * and was checked before writing this.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const ROOTS = [join(WEB, 'app'), join(WEB, 'lib')];

/** Every .ts/.tsx under the roots, skipping tests and generated output. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Comment-stripped, so the assertions test COPY and not the notes explaining it. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '');
}

const FILES = ROOTS.flatMap((r) => sources(r));

/**
 * Phrases that promise a lifetime for the ORIGINALS which we do not honour.
 * Deliberately narrow: each was a real string that shipped. A broad pattern
 * here would fire on the compressed gallery, which genuinely IS forever, and a
 * guard that cries wolf teaches you to skim past the one time it is right.
 */
const FALSE_PROMISES: Array<{ re: RegExp; why: string }> = [
  { re: /\b5-year backup\b/i, why: 'we hold full-resolution originals for 6 months, not 5 years' },
  { re: /\bfive-year backup\b/i, why: 'we hold full-resolution originals for 6 months, not 5 years' },
  { re: /keep your raws as long as you need/i, why: 'originals are dropped at 6 months' },
  // The month count itself. It moved 3 → 6 on 2026-08-02 and a dormant buy card
  // kept the old number for five days, so pin the stale one by name.
  { re: /after 3 months we keep a[^.]{0,30}compressed/i, why: 'the clock is 6 months, not 3' },
];

/**
 * ⚠ REJECTED PATTERNS, and why — do not "helpfully" add them back.
 *
 * /originals?.{0,40}forever/ and /full-res.{0,40}forever/ looked right and
 * fired on FOUR files, THREE of them innocent: two were Pakanta's "An ORIGINAL
 * SONG for your wedding — yours, forever" (a song, not a photo) and one was an
 * internal log line about the drop being deferred. The single real hit was a
 * heading on the Keep Full-Res buy card — where "keep your full-res forever" is
 * exactly what that product does, so it was not a lie either.
 *
 * A 3-in-4 false-positive rate is worse than no guard: it teaches the next
 * reader to skim past the one time it is right. Narrow beats broad here.
 */

test('no user-facing copy promises a lifetime for the originals that we do not keep', () => {
  const hits: string[] = [];
  for (const f of FILES) {
    const src = code(f);
    for (const { re, why } of FALSE_PROMISES) {
      if (re.test(src)) hits.push(`${relative(WEB, f)} — ${re} (${why})`);
    }
  }
  assert.deepEqual(
    hits,
    [],
    `Copy promises a photo lifetime the deletion sweep does not honour:\n${hits.join('\n')}\n\n` +
      'Originals: 6 months from the first capture. Compressed gallery: forever. ' +
      'Google Drive is how a couple keeps originals past 6 months.',
  );
});

test('the full-res warning email never points at an account export', () => {
  // There is NO user-facing account export — no settings route, no action.
  // It was the safest-sounding of three options offered to a worried couple,
  // and it saved nothing.
  const email = code(join(WEB, 'lib', 'daily-email-jobs.ts'));
  assert.doesNotMatch(
    email,
    /account export/i,
    'the full-res warning email offers an "account export" to save originals — no such export ' +
      'exists, so it sends a worried couple to a dead end',
  );
});

test('the decline-Drive button does not use the word "keep"', () => {
  // Declining Drive is the branch where originals ARE dropped. A decline button
  // reading "keep my photos in Setnayan" named the opposite of what it does.
  const panel = code(
    join(WEB, 'app', 'dashboard', '[eventId]', 'studio', 'photo-delivery', '_components', 'photo-delivery-panel.tsx'),
  );
  const label = panel.match(/deferLabel="([^"]*)"/)?.[1];
  assert.ok(
    label !== undefined,
    'could not find the decline label — update this test with the markup',
  );
  assert.doesNotMatch(
    label,
    /\bkeep\b/i,
    `the decline-Drive button reads "${label}" — declining is exactly the path where the ` +
      'originals are dropped, so it must not promise to keep them',
  );
});
