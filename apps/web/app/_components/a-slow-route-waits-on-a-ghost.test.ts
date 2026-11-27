/**
 * a-slow-route-waits-on-a-ghost.test.ts
 *
 * The speed audit of 27 Nov 2026 (`docs/audits/2026-11-27/speed.md`, Group J
 * and the ⓛ marks in its per-route table) found routes with NO loading
 * boundary at or above them and several database reads before the first
 * paint. A tap on one of them showed nothing at all until the server answered:
 * the old page stayed on screen, the URL did not move, nothing said "we heard
 * you". Each now has its own `loading.tsx`, drawn in the house "D · Ghost"
 * style (motion standard § 9): what is already known shows as itself, the rest
 * is a grey block under the Sheen.
 *
 * ── What this pins, per route ───────────────────────────────────────────────
 *   1. The boundary exists, in the route's OWN folder (a parent's boundary is
 *      the wrong shape — see `the-skeleton-promises-only-what-the-page-draws`).
 *   2. It is built from the ONE skeleton system, `@/components/skeletons`.
 *   3. Its own tree carries a `<Ghost>` (read off the real element tree, not a
 *      grep), inside the shared `<Screen>` or a shared page template.
 *   4. Rendered to HTML, it shows NO words that say "Loading". The only such
 *      word allowed is the shared `<Screen>`'s one `sr-only` announcement.
 *   5. No spinner and no `animate-pulse`: the Sheen is the one allowed loop.
 *
 * ── Why a list here ─────────────────────────────────────────────────────────
 * These are the routes the audit found frozen. The list is the finding, so it
 * is kept as the finding: a route here losing its boundary is the regression.
 * The title and header-actions honesty of each loader is asked separately, by
 * `the-skeleton-promises-only-what-the-page-draws.test.ts`, for every loader.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsx compiles this repo's JSX to the classic runtime, which needs React in scope.
(globalThis as unknown as { React: unknown }).React = React;

import { stripComments } from '@/lib/strip-comments';
/* eslint-disable-next-line import/first */
import * as SKELETONS from '@/components/skeletons';

const APP = resolve(__dirname, '..');

/** Route folders (relative to `app/`) the audit found with no boundary. */
const ROUTES = [
  // Group J (named by the audit)
  'pay/[reference]',
  'receipts/order/[orderId]',
  'receipts/payment/[paymentId]',
  'proposals/[publicId]',
  'samahan/chat/[threadId]',
  'samahan/chat/new',
  'panood/control/[eventId]',
  'panood/program/[eventId]',
  'claim/[token]',
  'join/crew/[token]',
  'open-shop',
  'onboarding/[type]',
  'onboarding/simple',
  'vendor/fit/[ref]',
  // ⓛ with 3+ reads before paint (the per-route table)
  'open-shop/invite',
  'open-shop/logo',
  'wall/[eventId]',
  'papic/decorate',
  'papic/pool',
  'papic/order/[token]',
  'tour/budget',
  'tour/gallery',
  'tour/vendors',
] as const;

const TEMPLATES = new Set(
  Object.entries(SKELETONS)
    .filter(([k]) => k.endsWith('PageSkeleton') || k === 'Screen')
    .map(([, v]) => v as unknown),
);

type El = { type?: unknown; props?: Record<string, unknown> & { children?: unknown } };

/** Every element in the loader's OWN tree, without running any component. */
function elements(node: unknown, out: El[] = []): El[] {
  if (node == null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const n of node) elements(n, out);
    return out;
  }
  const el = node as El;
  out.push(el);
  if (el.props) {
    for (const v of Object.values(el.props)) {
      if (v && typeof v === 'object') elements(v, out);
    }
  }
  return out;
}

/** The words a sighted person sees: markup minus the one sr-only announcement. */
function visibleText(html: string): string {
  return html
    .replace(/<span class="sr-only">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('the audit found enough routes for this to ask something', () => {
  assert.ok(ROUTES.length >= 20, `only ${ROUTES.length} routes listed (floor 20)`);
});

for (const route of ROUTES) {
  const file = join(APP, route, 'loading.tsx');

  test(`${route}: waits on a Ghost skeleton, never the word "Loading"`, async () => {
    assert.ok(existsSync(file), `${route}/loading.tsx is missing — a tap on this route shows nothing until the server answers.`);
    const s = stripComments(readFileSync(file, 'utf8'));

    assert.match(s, /from '@\/components\/skeletons'/, `${route}/loading.tsx must build from @/components/skeletons, the one skeleton system.`);
    assert.doesNotMatch(s, /animate-pulse|animate-spin|Spinner|Loader2/, `${route}/loading.tsx draws a spinner or a pulse; the Sheen is the one allowed loop.`);

    const mod = (await import(file)) as { default: () => unknown };
    assert.equal(typeof mod.default, 'function', `${route}/loading.tsx has no default export.`);
    const tree = mod.default();
    const els = elements(tree);

    assert.ok(
      els.some((e) => e.type === SKELETONS.Ghost),
      `${route}/loading.tsx renders no <Ghost>: the known parts of the page must show as themselves, the rest as grey.`,
    );
    assert.ok(
      TEMPLATES.has((tree as El)?.type),
      `${route}/loading.tsx must be wrapped in the shared <Screen> (or a shared page template), which announces the wait once.`,
    );

    const html = renderToStaticMarkup(tree as React.ReactElement);
    assert.match(html, /aria-busy="true"/, `${route}/loading.tsx does not announce the wait.`);
    assert.match(html, /class="skeleton|data-ghost="known"/, `${route}/loading.tsx paints no skeleton block and no known text.`);
    assert.doesNotMatch(visibleText(html), /loading/i, `${route}/loading.tsx shows the word "Loading" on screen.`);
  });
}
