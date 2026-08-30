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
 * ⚠ THAT IS HISTORY — ALL NINE ARE WIRED, AND THIS GUARD IS WHY. Do not read
 * the paragraph above as a description of today. `quality_set` / `quality_error`
 * have since left the product entirely along with the photo-quality question
 * (owner, 2026-08-26), so the derived list no longer contains them; the floor
 * below therefore names `style_error` instead.
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
    // 🔴 THE `\n` USED TO BE IN THESE CHARACTER CLASSES, AND IT MADE THIS GUARD
    // BLIND TO EVERY PARAM AFTER A LINE BREAK. These redirects are template
    // literals wrapped across lines by the formatter, so the match died at the
    // first newline and each multi-line redirect contributed only its FIRST
    // parameter. Measured before the fix: the scan found 16 keys and missed
    // `papic_ref`, `papic_amount` and `papic_order` — all real outcomes, all on
    // continuation lines.
    //
    // 🔑 AND THE BLIND SPOT HAD BEEN WRITTEN DOWN AS A DECISION. Two of the
    // three sat in this file's exemption list, which reads as "we considered
    // these and they are fine" — but the scan had never seen them, so the
    // exemption was never doing anything. A guard's blind spot becomes a lie
    // the moment somebody records it as an intentional exclusion.
    //
    // Stopping at the closing backtick/quote instead is safe in the same
    // direction the old class was: it can only under-match, never over-match.
    const patterns = [/\/studio\/papic\?([^`'"]*)/g];
    if (targetsThisPage) patterns.push(/\$\{back\}\?([^`'"]*)/g);
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

/**
 * Props that DETAIL a banner rather than trigger one. A banner is keyed on its
 * own outcome param; these carry the words and the destination it renders with,
 * so they must not appear in `hasAny` (a URL carrying only one of them would
 * open an empty block) and they have no copy of their own to read.
 *
 * ⚠ THIS LIST IS A BILL, NOT A DECISION. Every entry is a promise that the prop
 * cannot be the ONLY thing a redirect sends. Adding one to silence a failure,
 * when it really is a banner's trigger, is how a confirmation gets written,
 * passed in and never shown — the exact defect the two tests below exist for.
 *   • connectedAccount · papicRef · papicAmount — words inside another banner
 *   • eventId — the route's own id, always present, never an outcome
 *   • papicOrder — the bill link's destination, shown only inside the
 *     `papic_purchased` banner, which has its own trigger
 */
const DETAIL_ONLY_PROPS = [
  'connectedAccount',
  'papicRef',
  'papicAmount',
  'eventId',
  'papicOrder',
];

/** The `<StatusBanners … />` call site, and the component's bail-out condition. */
function bannerCallSite(): string {
  return region('<StatusBanners', '/>');
}
function bailOut(): string {
  return region('const hasAny =', 'if (!hasAny) return null;');
}

test('the scan finds the outcomes (a guard reading nothing passes everything)', () => {
  // 🔑 THE FLOOR IS A REAL NUMBER, NOT A COMFORTABLE ONE. It sat at 15 while the
  // scan found 16 — one spare notch — so the day the pattern went blind to every
  // param after a line break (three real outcomes) the count fell to 16 and this
  // assertion still passed. A vacuity guard whose floor cannot be reached by the
  // narrowing it exists to catch is not a guard.
  //
  // Raise this deliberately when a redirect adds an outcome; NEVER lower it to
  // make a failing run green — a drop means the scan stopped seeing something.
  //
  // 19 → 21 on 2026-08-30: `allotment_set` / `allotment_error`, the couple's
  // per-guest numbers. They could NOT reuse `shots_set` / `shots_error` — those
  // belong to setCameraShots, and sharing them would show one control's
  // confirmation after another control's save.
  assert.ok(
    KEYS.length >= 21,
    `expected this route's redirect outcomes, found ${KEYS.length}: ${KEYS.join(', ')}`,
  );
  for (const spanning of ['papic_ref', 'papic_amount', 'papic_order']) {
    assert.ok(
      KEYS.includes(spanning),
      `${spanning} sits on a continuation line — if it is missing the scan has gone newline-blind again`,
    );
  }
  for (const known of ['style_set', 'style_error', 'faceTagging', 'guestCameras']) {
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

test('the detail-only exemption list is exactly what it claims', () => {
  // An exemption list silences the two tests below for whatever is in it, so a
  // real banner trigger added here disappears from BOTH without any failure.
  // Pinned so that widening it is a deliberate edit to this line, reviewed —
  // not a quiet way to make a red run green.
  assert.deepEqual(
    [...DETAIL_ONLY_PROPS].sort(),
    ['connectedAccount', 'eventId', 'papicAmount', 'papicOrder', 'papicRef'],
    'the exemption list changed — every entry must be a prop that DETAILS a banner, never one that triggers it',
  );
});

test('🚨 nothing handed to the banner dies at the bail-out', () => {
  // The half that is easiest to forget: add a banner below without adding its
  // param to `hasAny` and the whole component returns null before rendering
  // anything. The confirmation is written, passed in, and STILL never seen.
  const guard = bailOut();
  const props = bannerProps().filter((n) => !DETAIL_ONLY_PROPS.includes(n));
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
  const props = bannerProps().filter((n) => !DETAIL_ONLY_PROPS.includes(n));
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
