/**
 * plan3d-stage-renders.test.ts — THE MEASUREMENT REACHES THE RENDER.
 * Mounts the stage with real resolver output and reads the HTML: a refused
 * read shows "could not read", a draft says draft, a live room offers the
 * guest door, an empty plan draws the promise and not an apology.
 * Recipe: hub-stage-renders.test.ts (React on the global, dynamic imports).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
(globalThis as unknown as { React: unknown }).React = React;

const NOW = new Date('2026-09-05T04:00:00Z').getTime();

async function paint(o: { measured?: boolean; published?: boolean; tables?: number; slug?: string | null }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Plan3dStage } = await import('./plan3d-stage');
  const c = await import('@/lib/plan3d-control');
  const ev = { measured: true, slug: o.slug === undefined ? 'maria-and-jose' : o.slug, eventDate: '2026-12-12', timezone: 'Asia/Manila', guestListEditDeadline: null, guestListLockedAt: null };
  const plan = { measured: o.measured ?? true, published: o.published ?? false, publishedAt: o.published ? '2026-09-01T00:00:00Z' : null, tables: o.tables ?? 22, seated: 174, boothCount: 1, brandedBooths: 1, photoVisibility: 'table' as const };
  const guests = { shared: true, measured: o.measured ?? true, total: 178, withAvatar: 12 };
  const standing = c.resolvePlan3dStanding(ev, plan, NOW);
  const facts = c.resolvePlan3dFacts(ev, plan, guests, NOW);
  const mini = plan.measured
    ? { tables: Array.from({ length: plan.tables }, (_, i) => ({ x: 10 + i * 3, y: 40, kind: 'round' })), stage: { x: 50, y: 6, w: 24, h: 7 }, dance: { enabled: true, x: 50, y: 55, w: 22, h: 14 }, entrance: { enabled: true, x: 50, y: 94 }, booths: [{ x: 8, y: 30, branded: true }] }
    : null;
  return renderToStaticMarkup(
    React.createElement(Plan3dStage, {
      slug: ev.slug, standing, facts,
      lede: standing.measured ? { strong: standing.state === 'draft' ? 'Only you can see this.' : 'Live.', rest: '…' } : { strong: 'We could not read your room just now.', rest: '…' },
      miniature: mini, tableCount: plan.measured ? plan.tables : null,
      editHref: '/e', walkHref: '/w', publicHref: standing.state === 'live' && ev.slug ? `/${ev.slug}/venue` : null,
    }),
  );
}

test('a refused read renders as unread — not as a draft, not as an empty room', async () => {
  const html = await paint({ measured: false });
  assert.match(html, /could not read your room/i);
  assert.doesNotMatch(html, />Draft</);
  assert.doesNotMatch(html, /once you place the first table/);
  // the three facts behind the refused reads are em-dashes; "Days to go" comes
  // from the EVENT read, which succeeded, and must still show — a refusal
  // silences only what it refused.
  assert.equal((html.match(/>—</g) ?? []).length, 3, 'three unread facts');
  assert.match(html, /98 · 12 Dec/, 'the measured fact still renders');
});

test('draft: says so, offers the couple their own walk, no guest door', async () => {
  const html = await paint({ published: false });
  assert.match(html, />Draft</);
  assert.match(html, /Walk it yourself/);
  assert.doesNotMatch(html, /Open as a guest/);
  assert.match(html, /setnayan\.com\/maria-and-jose\/venue/);
});

test('live: the guest door, the address, the since-date', async () => {
  const html = await paint({ published: true });
  assert.match(html, />Live</);
  assert.match(html, /href="\/maria-and-jose\/venue"/);
  assert.match(html, /Open as a guest/);
  assert.match(html, /Live · since 1 Sep/);
});

test('empty seat plan: the promise, drawn dashed — never an apology', async () => {
  const html = await paint({ tables: 0 });
  assert.match(html, /once you place the first table/);
  assert.match(html, /stroke-dasharray/);
  assert.doesNotMatch(html, /sorry|nothing here|empty/i);
});

test('the miniature draws what it was given: 22 tables and a gold branded booth', async () => {
  const html = await paint({ tables: 22 });
  // Count inside the miniature only — the lucide Eye icon is a <circle> too.
  const svg = html.slice(html.indexOf('viewBox="0 0 100 60"'), html.indexOf('</svg>', html.indexOf('viewBox="0 0 100 60"')));
  assert.equal((svg.match(/<circle /g) ?? []).length, 22);
  assert.match(svg, /fill="#CBA766" fill-opacity="0\.9"/, 'the branded booth is gold');
  assert.match(html, /22 tables, drawn from your seat plan/);
});
