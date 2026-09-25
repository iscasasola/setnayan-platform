/**
 * the-love-story-reaches-the-pixels.test.ts — Event Hub Maker Phase 7.
 *
 * The rules live in `lib/love-story-moments.ts` and are proved there. This
 * proves what a PERSON sees, and where the one gate sits:
 *
 *   1. 🔒 THE SERVER COUNTS. The one action asks the ACTIVE entitlement helper
 *      (`eventCoupleWebsiteProActive`) and `momentCapRefusal` BEFORE it writes
 *      — read from the source, because a fixture that supplied `ownsPro` itself
 *      would invent both sides of the question.
 *   2. The sixth story shows the ONE line — "Add more stories and your photos ·
 *      Go Event Hub Pro" — linking to the existing offer on the web, and the
 *      words alone (no link, no ₱) in the app-store shell.
 *   3. 🎨 NO THEME PICKER anywhere in Love Story — one theme line with a link
 *      to the Event Hub Maker (owner 2026-09-25).
 *   4. The guest widget draws one scene per visible moment.
 *
 * 🪤 `globalThis.React` is set before the DYNAMIC imports (tsconfig `jsx:
 * preserve` → tsx compiles the classic runtime). Precedent:
 * `launch/_components/hub-pro-offer-renders.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = __dirname;
const WEB = join(HERE, '..', '..', '..', '..', '..');
const noop = () => {};
const m = (id: string, y: number) => ({ id, date: { y }, line: `The words of ${id}`, canvas: {} });
const FIVE = [m('a', 2019), m('b', 2020), m('c', 2021), m('d', 2022), m('e', 2023)];

async function paint(overrides: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LoveStoryBook } = await import('./_components/love-story-book');
  return renderToStaticMarkup(
    React.createElement(LoveStoryBook, {
      eventId: 'E1',
      names: 'Indalecio & Claire',
      partners: ['Indalecio', 'Claire'],
      eyebrow: '14 Feb 2027',
      moments: FIVE,
      since: 2019,
      daysToTheDay: 507,
      themeName: 'Vintage',
      motionLabel: 'Calm',
      makerHref: '/dashboard/E1/launch',
      guestHref: '/cale-ice?phase=rsvp',
      ownsPro: false,
      storeShell: false,
      proHref: '/dashboard/E1/studio/website-pro',
      proPrice: '₱3,500',
      refused: null,
      sectionHidden: false,
      mediaUrls: {},
      action: noop,
      pickSlot: null,
      ...overrides,
    }),
  );
}

test('🔒 the ONE action asks the entitlement helper and the cap BEFORE it writes', () => {
  const src = readFileSync(join(HERE, 'actions.ts'), 'utf8');
  const start = src.indexOf('export async function loveStoryMomentAction');
  assert.ok(start > 0, 'loveStoryMomentAction exists');
  const body = src.slice(start);
  const pro = body.indexOf('eventCoupleWebsiteProActive(supabase, eventId)');
  const cap = body.indexOf('momentCapRefusal({ before, after, ownsPro })');
  const write = body.indexOf(".update({ love_story:");
  assert.ok(pro > 0, 'Pro is read with the ACTIVE gate');
  assert.ok(cap > pro, 'the cap is asked with that answer');
  assert.ok(write > cap, 'and only then is anything written');
  // Exactly one exported writer of moments — the cap cannot be walked around.
  const writers = src.match(/moments:\s*storableMoments\(/g) ?? [];
  assert.equal(writers.length, 1, 'one place writes love_story.moments');
});

test('✅ five stories: the add button, no Pro line', async () => {
  const html = await paint({ moments: FIVE.slice(0, 4) });
  assert.match(html, /Add a moment/);
  assert.doesNotMatch(html, /data-love-story-pro-line/);
});

test('🔒 the sixth: the one line, to the existing offer, with the catalogue price (web)', async () => {
  const html = await paint({});
  assert.match(html, /data-love-story-cap="reached"/);
  assert.match(html, /Add more stories and your photos/);
  assert.match(html, /href="\/dashboard\/E1\/studio\/website-pro"[^>]*>Go Event Hub Pro · ₱3,500/);
});

test('⛔ the store shell: the words only — no link, no button, no ₱', async () => {
  const html = await paint({ storeShell: true, proPrice: null, refused: 'stories' });
  assert.match(html, /data-love-story-pro-line="shell"/);
  assert.doesNotMatch(html, /Go Event Hub Pro/);
  assert.doesNotMatch(html, /studio\/website-pro/);
  assert.doesNotMatch(html, /₱/);
});

test('✅ Pro: no line at all, and the add button past five', async () => {
  const html = await paint({ ownsPro: true });
  assert.doesNotMatch(html, /data-love-story-pro-line/);
  assert.match(html, /Add a moment/);
});

test('🎨 one theme line with a link to the Maker — never a picker', async () => {
  const html = await paint({});
  assert.match(html, /data-love-story-theme-line/);
  assert.match(html, /Vintage/);
  assert.match(html, /Change in Event Hub Maker ↗/);
  // Grep guard over every Love Story file, the guest widget included.
  const files = [
    ...readdirSync(join(HERE, '_components')).map((f) => join(HERE, '_components', f)),
    join(HERE, 'page.tsx'),
    join(HERE, 'actions.ts'),
    join(WEB, 'app', '[slug]', '_components', 'our-love-story-widget.tsx'),
  ];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const banned of ['invite-theme-picker', 'setInviteTheme', 'HUB_THEMES', 'name="invite_theme"', 'pickableInviteThemes']) {
      assert.ok(!src.includes(banned), `${f} must not carry a theme picker (${banned})`);
    }
  }
});

test('🎬 the guest widget: one scene per visible moment', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { OurLoveStoryWidget } = await import('../../../../[slug]/_components/our-love-story-widget');
  const html = renderToStaticMarkup(
    React.createElement(OurLoveStoryWidget, {
      config: { moments: [...FIVE, { ...m('h', 2024), hidden: true }] },
    }),
  );
  assert.equal((html.match(/data-love-scene=/g) ?? []).length, 5);
  assert.doesNotMatch(html, /The words of h/);
  assert.equal(
    renderToStaticMarkup(React.createElement(OurLoveStoryWidget, { config: {} })),
    '',
    'an empty story draws nothing',
  );
});
