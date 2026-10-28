/**
 * The Wedding March maker MOUNTS on a march the shape of the owner's own event
 * (2026-10-06 crash report — 45 walks · 80 walking, Surname-first names,
 * hyphenated surnames, a best woman, a walk tied across the two sides, people
 * nobody has placed yet). Real emitted HTML, read the way a person would.
 *
 * `globalThis.React` before the dynamic import: tsx compiles JSX to the classic
 * runtime here (see `hub-stage-renders.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

test('the march maker renders the owner-shaped march, every walk numbered', async () => {
  const { renderToString } = await import('react-dom/server');
  const { buildEntourage } = await import('@/lib/entourage');
  const { marchSections, printedSectionOrder } = await import('@/lib/march-sections');
  const { ownerShapedMarch } = await import('@/lib/march-owner-shape.fixture');
  const { MarchMaker } = await import('./details-march');
  const groups = buildEntourage(ownerShapedMarch(), null, {}, 'surname-first', { march: true });
  const sections = marchSections(groups);
  const walks = sections.reduce((n, s) => n + s.rows.length, 0);
  const html = renderToString(
    React.createElement(MarchMaker, { eventId: 'e', sections, printed: printedSectionOrder(groups, null) }),
  );
  assert.equal((html.match(/data-march-walk="/g) ?? []).length, walks);
  assert.match(html, /Sacdalan-Casasola,/);
});

test('a throw inside the march draws ONE line in its own place — never the root crash card', async () => {
  const { renderToString } = await import('react-dom/server');
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { MarchBoundary } = await import('./details-march');
  // A thrown render becomes the boundary's own state…
  assert.deepEqual(MarchBoundary.getDerivedStateFromError(), { failed: true });
  // …which draws the one line and its Retry (React renders boundaries on the client only, so its
  // render is asked directly — the same method React calls).
  const b = new MarchBoundary({ children: React.createElement('i', null, 'march') });
  b.state = { failed: true };
  const html = renderToString(b.render() as React.ReactElement);
  assert.match(html, /The march couldn’t load/);
  assert.match(html, /data-march-retry/);
  assert.doesNotMatch(html, /Something on our end/);
  b.state = { failed: false };
  assert.match(renderToString(b.render() as React.ReactElement), /march/);
  // The page the Maker mounts IS the bounded one (the body is never exported bare).
  const src = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/launch/_components/details-march.tsx'), 'utf8');
  // (An unread draft draws the same one line first — 2026-10-06, the march waits for Apply.)
  assert.match(src, /export function MarchMaker\(props: MarchMakerProps\) \{[^}]*if \(props\.draftUnread\) return <CouldNotLoad onRetry=\{requestMakerRefresh\} \/>;\s*return \(\s*<MarchBoundary>\s*<MarchMakerBody \{\.\.\.props\} \/>/);
  assert.doesNotMatch(src, /export function MarchMakerBody/);
});
