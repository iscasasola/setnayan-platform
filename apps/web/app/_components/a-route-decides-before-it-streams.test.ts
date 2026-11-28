/**
 * a-route-decides-before-it-streams.test.ts
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * A `loading.tsx` wraps its segment's page (and every segment below it) in a Suspense boundary, and a boundary
 * commits HTTP 200 the moment the first bytes leave. So a page under one that answers with `notFound()` or
 * `redirect()` while rendering does it AFTER streaming started: a missing receipt answers 200 with a skeleton and then
 * a "not found" body, a signed-out visitor gets a 200, a grey screen and a client-side hop instead of a 307. That is
 * the `/v/[slug]` soft-404, and it is why the loading-screens checker (PR #8450) left 17 routes with NO boundary —
 * so a tap on any of them froze until the server answered.
 *
 * ── THE FIX THIS PINS: DECIDE, THEN STREAM ──────────────────────────────────
 * A segment's `layout.tsx` sits OUTSIDE its own `loading.tsx` boundary. So each of those routes now asks its answers
 * that are not the page (sign in, not found, "go elsewhere") in a `cache()`d gate (`gate.ts`) awaited by its own
 * `layout.tsx`; the page asks the same gate and gets the same answer in the same request. The 404 / 307 is decided in
 * the shell, and the `loading.tsx` beside it paints at once on a tap.
 * A route whose answer needs `searchParams` (a layout is not given them) moves the boundary instead: the page decides
 * first, then returns a `<Suspense>` around a `…Streamed` component that only draws.
 *
 * ── WHAT THIS ASKS ──────────────────────────────────────────────────────────
 *   1. No page under a boundary, and no layout under an ANCESTOR's boundary, calls `notFound()` / `redirect()` /
 *      `permanentRedirect()` — except the named routes that already did when this was written
 *      (`streams-before-deciding.known.ts`, which only shrinks).
 *   2. Each route the checker found has the fix in its real shape: a boundary in its own folder + a deciding layout,
 *      or a page `<Suspense>` with every redirect / 404 above the streamed part.
 *   3. The public tour resolves its sample wedding in `tour/layout.tsx`, above every stop's boundary — a vanished
 *      sample is a 404, not a 200.
 *
 * ⚠ A source scan sees only the file it reads: a page that redirects through a helper it imports is not caught here.
 * Every scan strips comments with the repo's one stripper (`lib/strip-comments.ts`), so prose about `notFound()` is
 * never mistaken for a call and a string like `image/*` can never blank real code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { STREAMS_BEFORE_DECIDING_KNOWN } from './streams-before-deciding.known';

const APP = resolve(__dirname, '..');

const ANSWERS = /\b(?:redirect|permanentRedirect)\s*\(|\bnotFound\s*\(\s*\)/;
const code = (file: string) => stripComments(readFileSync(file, 'utf8'));
const answers = (file: string) => ANSWERS.test(code(file));

/** A `loading.tsx` in `dir` or any folder above it inside `app/`. */
function boundaryAtOrAbove(dir: string): string | null {
  let cur = dir;
  for (;;) {
    if (existsSync(join(cur, 'loading.tsx'))) return relative(APP, cur) || '.';
    if (cur === APP) return null;
    const up = dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

/** Every page and layout that runs AFTER a boundary has committed: a page at or below one, a layout strictly below. */
function streamedFiles(): { file: string; boundary: string }[] {
  const out: { file: string; boundary: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!e.name.startsWith('_') && e.name !== 'api' && e.name !== 'node_modules') walk(join(dir, e.name));
        continue;
      }
      const at =
        e.name === 'page.tsx' ? boundaryAtOrAbove(dir) : e.name === 'layout.tsx' && dir !== APP ? boundaryAtOrAbove(dirname(dir)) : null;
      if (at !== null) out.push({ file: relative(APP, join(dir, e.name)), boundary: at });
    }
  };
  walk(APP);
  return out;
}

/** The routes the checker found frozen, and the way each now decides before it streams. */
const LAYOUT_DECIDES = [
  'pay/[reference]',
  'proposals/[publicId]',
  'samahan/chat/[threadId]',
  'panood/control/[eventId]',
  'panood/program/[eventId]',
  'onboarding/[type]',
  'vendor/fit/[ref]',
  'papic/pool',
  'papic/order/[token]',
  'receipts/order/[orderId]',
  'receipts/payment/[paymentId]',
  'claim/[token]',
  'onboarding/simple',
  'open-shop/logo',
] as const;

/** Their answer needs `searchParams`, which a layout is not given: the page decides, then a `<Suspense>` streams. */
const PAGE_DECIDES_THEN_SUSPENDS = ['open-shop', 'samahan/chat/new'] as const;

const ALL = streamedFiles();

test('the anchor: the walk finds pages under boundaries, and the precedent shape', () => {
  assert.ok(ALL.length > 300, `only ${ALL.length} streamed pages/layouts found — the walk is broken and would pass forever`);
  assert.ok(
    ALL.some((f) => f.file === join('receipts', '[receiptId]', 'page.tsx')),
    'receipts/[receiptId] (a page under its own boundary) is not in the walked set',
  );
});

test('no page or layout answers with a 404 or a redirect after its boundary has streamed', () => {
  const known = new Set(STREAMS_BEFORE_DECIDING_KNOWN);
  const fresh = ALL.filter((f) => answers(join(APP, f.file)) && !known.has(f.file.split(/[\\/]/).join('/')));
  assert.deepEqual(
    fresh.map((f) => `${f.file}  (boundary at ${f.boundary})`),
    [],
    'These files call notFound() / redirect() while rendering under a loading boundary, so the 404 / 307 arrives ' +
      'after an HTTP 200 and a skeleton. Decide first: a cache()d gate awaited by the route\'s own layout.tsx (outside ' +
      'its loading.tsx), or a <Suspense> in the page placed after the checks.',
  );
});

test('the known list still describes real offenders (it only shrinks)', () => {
  const offending = new Set(ALL.filter((f) => answers(join(APP, f.file))).map((f) => f.file.split(/[\\/]/).join('/')));
  const stale = STREAMS_BEFORE_DECIDING_KNOWN.filter((f) => !offending.has(f));
  assert.deepEqual(stale, [], 'These no longer stream before deciding (or are gone) — drop them from streams-before-deciding.known.ts');
});

for (const route of LAYOUT_DECIDES) {
  test(`${route}: its layout decides, then its own loading.tsx streams`, () => {
    const dir = join(APP, route);
    assert.ok(existsSync(join(dir, 'loading.tsx')), `${route} has no loading.tsx — a tap on it shows nothing until the server answers`);
    assert.ok(existsSync(join(dir, 'layout.tsx')), `${route} has no layout.tsx to decide in before its boundary streams`);
    assert.equal(
      boundaryAtOrAbove(dirname(dir)),
      null,
      `${route}: a boundary ABOVE the route wraps its layout too, so the layout's answer would arrive after a 200`,
    );
    assert.doesNotMatch(code(join(dir, 'page.tsx')), ANSWERS, `${route}/page.tsx answers with a 404 / redirect under its boundary`);

    const gateFile = ['gate.ts', 'gate.tsx'].map((f) => join(dir, f)).find((f) => existsSync(f));
    assert.ok(gateFile, `${route} has no gate.ts — the one place its answers are decided`);
    const gate = code(gateFile);
    const name = gate.match(/export (?:const|function) (gate\w+)/)?.[1];
    assert.ok(name, `${route}/gate exports no gate…() function`);
    assert.match(gate, ANSWERS, `${route}/gate decides nothing (no notFound / redirect) — the scan would be theatre`);
    if (/export const gate\w+\s*=/.test(gate)) {
      assert.match(gate, new RegExp(`export const ${name}\\s*=\\s*cache\\(`), `${name} is not cache()d — the layout and the page would read twice`);
    }
    const layout = code(join(dir, 'layout.tsx'));
    assert.match(layout, new RegExp(`\\b${name}\\(`), `${route}/layout.tsx does not call ${name}() — nothing is decided before streaming`);
    assert.match(layout, /\{children\}|return children/, `${route}/layout.tsx never renders its children`);
    assert.match(code(join(dir, 'page.tsx')), new RegExp(`\\b${name}\\(`), `${route}/page.tsx does not ask ${name}() — it would draw without the gate`);
  });
}

for (const route of PAGE_DECIDES_THEN_SUSPENDS) {
  test(`${route}: the page decides, then streams the rest inside a <Suspense>`, () => {
    const dir = join(APP, route);
    assert.equal(boundaryAtOrAbove(dir), null, `${route} sits under a loading boundary, which streams before the page decides`);
    const src = code(join(dir, 'page.tsx'));
    const streamedAt = src.search(/\bfunction \w+Streamed\s*\(/);
    assert.ok(streamedAt > 0, `${route}/page.tsx has no …Streamed component — nothing streams after the decision`);
    assert.match(src, /<Suspense\b[^>]*fallback=/, `${route}/page.tsx renders no <Suspense> boundary`);
    assert.match(src.slice(0, streamedAt), ANSWERS, `${route}/page.tsx decides nothing before the boundary — the check is theatre`);
    assert.doesNotMatch(
      src.slice(streamedAt),
      ANSWERS,
      `${route}/page.tsx answers with a 404 / redirect inside the streamed part, after the boundary has committed a 200`,
    );
  });
}

test('the tour resolves its sample wedding above every stop\'s boundary', () => {
  const tour = join(APP, 'tour');
  assert.equal(boundaryAtOrAbove(tour), null, 'a boundary above tour/ would stream before the sample is resolved');
  assert.match(
    code(join(tour, 'layout.tsx')),
    /await getSampleEvent\(\)/,
    'tour/layout.tsx does not await getSampleEvent(): a vanished sample would answer 200 + skeleton on the stops that stream',
  );
  // The reader's fail-safe is what the layout relies on: no sample → notFound(), never a fall-through.
  const reader = code(join(tour, '_lib', 'sample-event.ts'));
  assert.match(reader, /export const getSampleEvent = cache\(/, 'getSampleEvent is not cache()d — every stop would read again');
  assert.match(reader, /if \(!data\) notFound\(\)/, 'getSampleEvent no longer 404s when the sample is missing');
  for (const stop of ['budget', 'gallery', 'vendors']) {
    assert.ok(existsSync(join(tour, stop, 'loading.tsx')), `tour/${stop} lost its boundary — this check no longer covers what it says`);
  }
});
