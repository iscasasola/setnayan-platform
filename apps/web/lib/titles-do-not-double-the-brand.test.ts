/**
 * titles-do-not-double-the-brand.test.ts — the root layout already appends the
 * brand, so a page must not append it again.
 *
 * 🔴 WHAT THIS CAUGHT, LIVE. `app/layout.tsx` sets
 * `title: { template: '%s · Setnayan' }`. Eleven pages ALSO ended their own
 * `PAGE_TITLE` with `· Setnayan`, so every one of them served
 * "… · Setnayan · Setnayan" — in the browser tab, and in the ~60 characters
 * Google prints in a search result, on the highest-value product pages we have
 * (Papic, Live Studio, Event Hub, 3D Plan, Logo Maker, Setnayan AI, Alaala,
 * Patiktok, the monogram maker, our-story, why-setnayan).
 *
 * 🔑 THE NAIVE FIX MAKES IT WORSE, WHICH IS THE REAL REASON THIS FILE EXISTS.
 * `PAGE_TITLE` is used FOUR times per page: the document title, `openGraph.title`,
 * `twitter.title`, and sometimes a structured-data `name`. **Only the document
 * title passes through the template.** Stripping the brand from the constant
 * would have quietly removed it from every share card — trading a cosmetic
 * doubling for a real loss of branding on Facebook and X. So the brand is
 * stripped for the document title alone, via `DOC_TITLE`, and the share cards
 * keep the full string.
 *
 * WHAT IS ASSERTED: for any page declaring a `PAGE_TITLE` that ends in the
 * brand, the metadata-level `title:` must NOT be that constant. Share-card
 * titles are deliberately NOT constrained — they are correct with the brand.
 *
 * ⚠ This reads SOURCE, not rendered output. It cannot prove what Next actually
 * emits; it proves the page does not hand the template a pre-branded string.
 * The live symptom was confirmed by fetching the eight reachable pages first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(process.cwd(), 'app');
const BRAND_SUFFIX = /const PAGE_TITLE = '[^']*·\s*Setnayan';/;
/** the metadata-level `title:` sits at two-space indent; openGraph and twitter
 *  sit at four. Anchoring on the indent is what keeps this from flagging the
 *  share cards, which are supposed to carry the brand. */
const METADATA_TITLE_IS_PAGE_TITLE = /\n {2}title: PAGE_TITLE,/;

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) pageFiles(full, out);
    else if (entry === 'page.tsx') out.push(full);
  }
  return out;
}

test('no page hands the title template a string that already ends in the brand', () => {
  const files = pageFiles(APP);
  assert.ok(files.length > 50, `expected to scan many pages, scanned ${files.length}`);

  const offenders: string[] = [];
  let examined = 0;

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!BRAND_SUFFIX.test(src)) continue;
    examined += 1;
    if (METADATA_TITLE_IS_PAGE_TITLE.test(src)) {
      offenders.push(file.replace(process.cwd() + '/', ''));
    }
  }

  // a guard that examined nothing is not a guard — the count is asserted so a
  // refactor that renames PAGE_TITLE cannot silently turn this file green.
  assert.ok(
    examined >= 10,
    `expected to examine the pages that end their title in the brand, examined ${examined}`,
  );

  assert.deepEqual(
    offenders,
    [],
    'These pages end PAGE_TITLE in "· Setnayan" AND pass it to metadata.title, so the ' +
      'root layout appends the brand a second time. Add `const DOC_TITLE = ' +
      "PAGE_TITLE.replace(/ · Setnayan$/, '')` and use DOC_TITLE for metadata.title only — " +
      'leave openGraph.title and twitter.title on PAGE_TITLE, they are correct with the brand.',
  );
});
