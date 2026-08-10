/**
 * GUARD — an outcome an action redirects with must be SHOWN, not just written.
 *
 * 🚨 NINE OF THEM WERE NOT. `style_set` · `style_error` · `quality_set` ·
 * `quality_error` · `showcase_set` · `showcase_error` · `faceTagging` ·
 * `vendorMedia` · `guestCameras` were each emitted by a `redirect()` on this
 * route and read by **nothing at all** — none appeared in the page's
 * searchParams type. So a couple changing their Papic look, their photo quality,
 * face matching, showcase state, vendor visibility or when guests may shoot got
 * no answer at all: not on success, and — worse — not on failure either.
 *
 * 🔑 A GUARD THAT REFUSES IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT PASSED.
 * Same family as the phantom column, the phantom enum value and the blocked
 * iframe: something happens, and the only symptom is an absence.
 *
 * 🔑 THE LIST IS DERIVED FROM THE ACTIONS, NOT TYPED HERE. That is the whole
 * point — a hand-typed list is silent about whatever nobody typed into it, and
 * the derived version found `guestCameras`, which no audit had ever named.
 *
 * ⚠ THIS CHECKS THREE THINGS, BECAUSE ANY ONE ALONE PASSES WHILE BROKEN:
 *   1. the param is in the page's searchParams TYPE (or it never arrives),
 *   2. it is PASSED to the banner component (or it arrives and is dropped),
 *   3. it is in the banner's BAIL-OUT condition (or the whole block returns
 *      null before rendering anything — the half that is easiest to forget).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = resolve(HERE, '..');
const PAGE = readFileSync(join(ROUTE, 'page.tsx'), 'utf8');

/**
 * Strip comments — this guard must never pass on the prose describing the bug.
 *
 * ⚠ APPLIED TO A SLICE, NEVER THE WHOLE FILE. Running the block-comment stripper
 * over all 1,900 lines destroyed the `searchParams: Promise<{` marker outright
 * (a `/*` somewhere earlier let the non-greedy match span past it), and the
 * slice silently came back EMPTY — which reads as "nothing here to check" and
 * would have passed every param forever. Slice from the raw text first, strip
 * inside the slice.
 */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** A named region of the page, comment-free — and never empty. */
function region(startMarker: string, endMarker: string): string {
  const i = PAGE.indexOf(startMarker);
  assert.ok(i > 0, `region start not found: ${startMarker}`);
  const j = PAGE.indexOf(endMarker, i + startMarker.length);
  assert.ok(j > i, `region end not found after start: ${endMarker}`);
  const out = codeOnly(PAGE.slice(i, j));
  assert.ok(out.trim().length > 0, `region came back EMPTY: ${startMarker}`);
  return out;
}

/**
 * Every `?key=` this route's actions redirect back to THIS page with.
 *
 * ⚠ Scoped to this page on purpose. `seat_set` / `seat_error` redirect to the
 * /crew child page and are read there, correctly; `next` is a login param. A
 * guard that cries wolf teaches you to skim past the one time it is right.
 */
function outcomeKeys(): string[] {
  const keys = new Set<string>();
  for (const name of readdirSync(ROUTE)) {
    if (!name.endsWith('actions.ts')) continue;
    const src = codeOnly(readFileSync(join(ROUTE, name), 'utf8'));
    const targetsThisPage = /const back = `\/dashboard\/\$\{eventId\}\/studio\/papic`/.test(src);
    const patterns = [/\/studio\/papic\?([^`'"\n]*)/g];
    if (targetsThisPage) patterns.push(/\$\{back\}\?([^`'"\n]*)/g);
    for (const m of patterns.flatMap((re) => [...src.matchAll(re)])) {
      for (const kv of m[1]!.split('&')) {
        const key = kv.split('=')[0]?.trim();
        if (key && /^[a-zA-Z_]+$/.test(key)) keys.add(key);
      }
    }
  }
  keys.delete('tab'); // navigation, not an outcome
  return [...keys].sort();
}

const KEYS = outcomeKeys();

/** The `<StatusBanners … />` call site, and the component's bail-out condition. */
function bannerCallSite(): string {
  return region('<StatusBanners', '/>');
}
function bailOut(): string {
  return region('const hasAny =', 'if (!hasAny) return null;');
}

test('the scan finds the outcomes (a guard reading nothing passes everything)', () => {
  assert.ok(KEYS.length >= 15, `expected this route's redirect outcomes, found ${KEYS.length}`);
  for (const known of ['style_set', 'quality_error', 'faceTagging', 'guestCameras']) {
    assert.ok(KEYS.includes(known), `${known} must be found by the scan`);
  }
});

test('🚨 every outcome arrives — it is in the page’s searchParams type', () => {
  const type = region('searchParams: Promise<{', '}>;');
  const missing = KEYS.filter((k) => !new RegExp(`\\b${k}\\?:`).test(type));
  assert.deepEqual(
    missing,
    [],
    `these are redirected with but never arrive — the page cannot see them:\n  ${missing.join('\n  ')}`,
  );
});

test('🚨 every outcome is CONSUMED — passed to something that can show it', () => {
  // ⚠ NOT "passed to StatusBanners". A first cut asserted that and reported
  // `papic_one_error` / `papic_pool_error` as dropped — they are handed straight
  // to their own cards as `error={…}` and shown there, correctly. The property
  // is that an outcome reaches SOMETHING that renders it, not that it takes one
  // particular route to the screen. A guard that cries wolf teaches you to skim
  // past the one time it is right.
  // ⚠ SCOPED TO THE PAGE'S OWN RENDER, NOT THE WHOLE FILE. A first cut searched
  // from the first `return (` to end-of-file — which swept in StatusBanners'
  // OWN body further down, so deleting the page's `guestCameras={guestCameras}`
  // prop still passed: the component's internal `{guestCameras ? …}` satisfied
  // the search. The guard was reading the wrong half of the wiring.
  const pageRender = region('return (', 'function StatusBanners');
  const camel = (k: string) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const dropped = KEYS.filter((k) => !new RegExp(`\\b${camel(k)}\\b`).test(pageRender));
  assert.deepEqual(
    dropped,
    [],
    `these arrive and are then dropped on the floor — nothing renders them:\n  ${dropped.join('\n  ')}`,
  );
});

/** The props actually handed to StatusBanners, derived from its call site. */
function bannerProps(): string[] {
  return [...bannerCallSite().matchAll(/(\w+)=\{/g)].map((m) => m[1]!);
}

test('🚨 nothing handed to the banner dies at the bail-out', () => {
  // The half that is easiest to forget: add a banner below without adding its
  // param to `hasAny` and the whole component returns null before rendering
  // anything. The confirmation is written, passed in, and STILL never seen.
  const guard = bailOut();
  const props = bannerProps().filter((n) => !['connectedAccount', 'papicRef', 'papicAmount'].includes(n));
  assert.ok(props.length >= 10, `expected the banner's props, found ${props.length}`);
  const swallowed = props.filter((n) => !new RegExp(`\\b${n}\\b`).test(guard));
  assert.deepEqual(
    swallowed,
    [],
    `passed to the banner but the block bails out before showing them:\n  ${swallowed.join('\n  ')}`,
  );
});

test('every banner prop has words a person can read', () => {
  const body = codeOnly(PAGE.slice(PAGE.indexOf('if (!hasAny) return null;')));
  const props = bannerProps().filter((n) => !['connectedAccount', 'papicRef', 'papicAmount'].includes(n));
  const unrendered = props.filter((n) => !new RegExp(`\\b${n}\\b`).test(body));
  assert.deepEqual(unrendered, [], `passed in but never rendered:\n  ${unrendered.join('\n  ')}`);
});

test('the confirmations speak plain English — no internal names leak', () => {
  const body = PAGE.slice(PAGE.indexOf('if (!hasAny) return null;'));
  for (const [pattern, why] of [
    [/papic_quality_tier|landing_page_visibility|papic_style/, 'a column name'],
    [/NEXT_PUBLIC_/, 'an environment flag'],
    [/\.tsx?\b/, 'a file name'],
  ] as Array<[RegExp, string]>) {
    assert.ok(!pattern.test(codeOnly(body)), `banner copy leaked ${why}`);
  }
});
