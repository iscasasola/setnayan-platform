/**
 * GUARD — a `?folder=` / `?tile=` a shipped link carries must be a REAL one.
 *
 * 🚨 WHAT THIS CAUGHT, LIVE IN PRODUCTION. Three of the couple's seven Wedding
 * Essentials buttons pointed at folders that do not exist:
 *
 *     Browse venues     → /explore?folder=reception
 *     Browse caterers   → /explore?folder=catering
 *     Browse officiants → /explore?folder=ceremony
 *
 * `reception`, `catering` and `ceremony` are TILE words, not folder words —
 * leftovers from the 12-folder model the 2026-05-31 shrink replaced with 15
 * folders keyed `venue` · `feast` · … `/explore` validates `?folder=` against
 * that list and, finding no match, **silently drops the scope**: no error, no
 * empty state, no 404 — the couple is simply dropped into the entire catalogue.
 *
 * Measured on www.setnayan.com before the fix, not inferred:
 *   ?folder=feast      → 1 section rendered   (scoped, correct)
 *   ?folder=venue      → 1 section rendered   (scoped, correct)
 *   ?folder=catering   → 28 sections          (the whole marketplace)
 *   ?folder=reception  → 28 sections
 *   ?folder=ceremony   → 28 sections
 *
 * 🔑 THE CLASS: a query param that reads perfectly and means nothing. The
 * validator fails OPEN by design (a typo'd share link should not 404), which is
 * right for a stranger's URL and is exactly what hides a wrong link we ship
 * ourselves. Same family as the phantom column / enum value / RPC argument:
 * rejected, not thrown, and the only symptom is an absence — here, an absence of
 * narrowing, which looks like a working page.
 *
 * 🔑 WHY IT ALSO SCANS THE SOURCE AND NOT JUST THE SEVEN ESSENTIALS. Guarding
 * the file where the bug happened to live is how the NEXT one ships from a
 * different file. Case 3 sweeps every hardcoded `folder=…` in `app/` and `lib/`
 * — one shape is not a survey.
 *
 * ⚠ It STRIPS COMMENTS FIRST. Eight of the nine surviving `folder=reception` /
 * `folder=ceremony` occurrences in this repo are stale PROSE describing the old
 * model. A raw-source match reports the defect it just fixed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { WEDDING_ESSENTIALS } from './wedding-essentials';
import { WEDDING_FOLDER_SLUG, WEDDING_TILE_SLUG } from './taxonomy';

const FOLDER_SLUGS = new Set<string>(Object.values(WEDDING_FOLDER_SLUG));
const TILE_SLUGS = new Set<string>(Object.values(WEDDING_TILE_SLUG));

/** Query params off an in-app href, without needing a base URL. */
function paramsOf(href: string): URLSearchParams {
  const q = href.indexOf('?');
  if (q === -1) return new URLSearchParams();
  const hash = href.indexOf('#');
  return new URLSearchParams(href.slice(q + 1, hash === -1 ? undefined : hash));
}

test('META: there are essentials to check, and some of them do carry a scope', () => {
  // Without this floor a refactor that empties the list, or renames the param,
  // turns every assertion below into a pass over nothing.
  assert.ok(WEDDING_ESSENTIALS.length >= 7, `expected the 7 essentials, got ${WEDDING_ESSENTIALS.length}`);
  const scoped = WEDDING_ESSENTIALS.filter((e) => paramsOf(e.primaryHref('E1')).has('folder'));
  assert.ok(scoped.length >= 3, `expected at least 3 folder-scoped essentials, got ${scoped.length}`);
});

test('every essential button points somewhere that exists', () => {
  const broken: string[] = [];
  for (const e of WEDDING_ESSENTIALS) {
    const href = e.primaryHref('E1');
    assert.ok(href.startsWith('/'), `${e.id}: "${href}" is not an in-app path`);
    const p = paramsOf(href);
    const folder = p.get('folder');
    if (folder !== null && !FOLDER_SLUGS.has(folder)) {
      broken.push(`${e.id} → "${e.primaryCtaLabel}" → ${href}   (folder "${folder}" does not exist)`);
    }
    const tile = p.get('tile');
    if (tile !== null && !TILE_SLUGS.has(tile)) {
      broken.push(`${e.id} → "${e.primaryCtaLabel}" → ${href}   (tile "${tile}" does not exist)`);
    }
  }
  assert.deepEqual(
    broken,
    [],
    'These buttons drop the couple into the WHOLE marketplace instead of the ' +
      'category their own label promises. /explore fails open on an unknown ' +
      `scope, so nothing errors:\n  ${broken.join('\n  ')}`,
  );
});

/** Every .ts/.tsx under app/ and lib/, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Block and line comments removed — stale prose must not read as a link. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('no file anywhere ships a hardcoded folder= that is not a folder', () => {
  const roots = ['app', 'lib'].filter((d) => {
    try {
      return statSync(d).isDirectory();
    } catch {
      return false;
    }
  });
  assert.ok(roots.length === 2, `expected to scan app/ and lib/, resolved ${roots.join(', ')}`);

  const files = roots.flatMap((r) => sourceFiles(r));
  // Floor: the scan must actually be reading this codebase.
  assert.ok(files.length > 500, `expected to scan the app, only found ${files.length} files`);

  const offenders: string[] = [];
  let checked = 0;
  for (const file of files) {
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/folder=([a-z][a-z0-9_-]*)/g)) {
        const slug = m[1]!;
        checked += 1;
        if (!FOLDER_SLUGS.has(slug)) offenders.push(`${file}:${i + 1}  folder=${slug}`);
      }
    });
  }
  // Second floor: if the regex stops matching, "0 offenders" means "0 looked at".
  assert.ok(checked > 0, 'the scan matched no folder= literal at all — it is measuring nothing');

  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} hardcoded folder scope(s) name a folder that does not ` +
      'exist. /explore drops an unknown scope silently, so the link looks fine ' +
      `and shows the whole catalogue:\n  ${offenders.join('\n  ')}`,
  );
});

test('the officiant essential sends couples to the ceremony venue, not to a shop', () => {
  // ⚖ OWNER RULING 2026-08-27: *"for priest (there are rules) so this needs to
  // be under their church (which is at the ceremony venue)."* A priest is not a
  // supplier you browse — all 20 officiant services are marketplace-hidden, so
  // an officiant marketplace has never existed and a button promising one is a
  // fake door. Reversing this is an owner decision (it opens a supplier
  // category), which is why it is pinned here rather than left to drift.
  const officiant = WEDDING_ESSENTIALS.find((e) => e.id === 'officiant');
  assert.ok(officiant, 'the officiant essential is gone — that is a product change, not a refactor');
  const href = officiant.primaryHref('E1');
  assert.equal(
    paramsOf(href).get('tile'),
    WEDDING_TILE_SLUG.ceremony_venue,
    `officiant CTA must scope to the ceremony venue, got "${href}"`,
  );
  assert.doesNotMatch(
    officiant.primaryCtaLabel,
    /browse\s+officiant/i,
    'the button must not offer to browse officiants — there are none to browse',
  );
});
