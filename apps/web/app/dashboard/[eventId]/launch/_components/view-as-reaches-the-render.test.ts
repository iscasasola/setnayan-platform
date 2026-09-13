/**
 * VIEW AS — SIX OBSERVATIONS, IN REAL EMITTED HTML.
 *
 * `lib/event-hub-roles.test.ts` proves the resolver and the gate. This proves
 * the PIXELS, and the gap between the two is the whole disease this build
 * exists against: a resolver that returns the right answer changes nothing
 * until something renders it differently. A guest error was already bound and
 * already in Sentry while a couple with 180 names was told "No guests yet."
 *
 * So this MOUNTS the stage once per role and reads what a person would see:
 *
 *   You .............. their own page, as themselves
 *   Coordinator ...... writes announcements · advances the running order · no editor
 *   Supplier ......... the desk · cannot advance · refused the gifts page
 *   Guest ............ the seat FINDER, no seat of their own
 *   Stranger ......... nothing, and no hint that anything exists
 *   Seat-holder ...... their seat · photos of them · their bound QR   (flagged)
 *
 * plus the one that matters most: a viewer the gate refused sees NO SWITCHER
 * AT ALL — not a disabled one, not an empty one.
 *
 * 🪤 `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORTS AND IS NOT A HACK TO
 * BE TIDIED AWAY. tsconfig sets `"jsx": "preserve"`, so `tsx` compiles these to
 * the CLASSIC runtime — bare `React.createElement` with no import of its own.
 * Without the global every component throws before an assertion runs, and the
 * imports must be DYNAMIC because a static one hoists above the assignment.
 * Same reasoning, same shape as `hub-stage-renders.test.ts` beside it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const MNL = 'Asia/Manila';
const NOW = new Date('2026-11-28T10:00:00+08:00').getTime();

type Mod = typeof import('./hub-stage');
type Control = typeof import('@/lib/event-hub-control');

async function paint(opts: {
  memberType: string | null;
  namedGuestEnabled?: boolean;
  viewas?: string | string[];
  slug?: string | null;
  guestsShared?: boolean;
  guestsMeasured?: boolean;
}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubStage }: Mod = await import('./hub-stage');
  const control: Control = await import('@/lib/event-hub-control');
  const { PUBLIC_SITE_PAGES } = await import('@/lib/public-site-pages');

  const read = {
    measured: true,
    eventDate: '2026-12-12',
    eventEndDate: null,
    clearedAt: null,
    timezone: MNL,
    slug: opts.slug === undefined ? 'maria-and-jomar' : opts.slug,
  };
  const guests = {
    shared: opts.guestsShared ?? true,
    measured: opts.guestsMeasured ?? true,
    invited: 90,
    replied: 61,
  };
  const standing = control.resolveHubStanding(read, NOW);
  const facts = control.resolveHubFacts(read, guests, NOW);

  const offered = control.hubPreviewRoles({
    memberType: opts.memberType,
    namedGuestEnabled: opts.namedGuestEnabled ?? false,
  });
  const armedRole = control.resolveArmedHubRole({ param: opts.viewas, offered });
  const roles = offered.map((role) =>
    control.resolveHubRoleView({ role, standing, slug: read.slug, guests }),
  );

  const idx = PUBLIC_SITE_PAGES.findIndex((p) => p.phaseParam === standing.stage);
  const channel = idx >= 0 ? PUBLIC_SITE_PAGES[idx] : null;
  return renderToStaticMarkup(
    React.createElement(HubStage, {
      slug: read.slug,
      standing,
      facts,
      channelName: channel?.name ?? null,
      channelBlurb: channel?.blurb ?? null,
      channelIndex: channel ? idx + 1 : null,
      channelCount: PUBLIC_SITE_PAGES.length,
      editHref: '/dashboard/E1/website/editor',
      roles,
      armedRole,
      roleHrefBase: '/dashboard/E1/launch',
    }),
  );
}

// ── THE GATE, AT THE PIXEL ─────────────────────────────────────────────────

test('a `guest`-typed member row renders NO switcher — not a disabled one, none', async () => {
  const html = await paint({ memberType: 'guest' });
  assert.doesNotMatch(html, /View as/, 'the switcher must not be painted for a guest row');
  assert.doesNotMatch(html, /Coordinator/, 'no chip for a role they may not preview');
  assert.doesNotMatch(html, /viewas=/, 'and no door to one either');
  // The stage itself still paints — the gate refuses the switcher, not the page.
  assert.match(html, /As your guests see it/);
});

test('a `guest` row cannot arm a role by hand-typing the param', async () => {
  const html = await paint({ memberType: 'guest', viewas: 'host' });
  assert.doesNotMatch(html, /View as/);
  assert.doesNotMatch(html, /Open your page/, 'the host door must not appear');
});

test('a host sees the switcher, and the FIVE generic chips', async () => {
  const html = await paint({ memberType: 'couple' });
  assert.match(html, /View as/);
  for (const chip of ['You', 'Coordinator', 'Supplier', 'Guest', 'Stranger']) {
    assert.match(html, new RegExp(`>${chip}<`), `the "${chip}" chip must be painted`);
  }
  assert.match(html, /The stage above becomes their page/);
});

// ── THE SIX OBSERVATIONS ───────────────────────────────────────────────────

test('OBSERVATION 1 · You — their own page, as themselves', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'host' });
  assert.match(html, /Your own page, as yourself/);
  assert.match(html, /href="\/maria-and-jomar"[^>]*target="_blank"/);
  assert.match(html, /The only role that may edit the site/);
});

test('OBSERVATION 2 · Coordinator — two floor powers, and no site editor', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'coordinator' });
  assert.match(html, /A host key/);
  assert.match(html, /announcements/i);
  assert.match(html, /advance the running order/i);
  assert.match(html, /Cannot edit the site itself/);
  assert.match(html, /hired/i, 'a coordinator you HIRED is a supplier, not this');
});

test('OBSERVATION 3 · Supplier — the desk, never a guest surface, refused pabuya', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'supplier' });
  assert.match(html, /call sheet/i);
  assert.match(html, /No gifts page\. A supplier is not a guest/);
  assert.match(html, /cannot advance it/i);
  // No fabricated door: a booking cannot be minted for a preview.
  assert.doesNotMatch(html, /viewas=supplier"[^>]*target="_blank"/);
});

test('OBSERVATION 4 · Guest — the seat FINDER, opening the stage they are on', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'guest' });
  assert.match(html, /seat finder/i);
  // 14 days out, the guests are on the invitation — so the door opens there.
  assert.match(html, /href="\/maria-and-jomar\?phase=rsvp"/);
  assert.match(html, /you cannot un-be the host/i, 'the preview is honest about its own limit');
});

test('OBSERVATION 5 · Stranger — nothing, no hint, and NO signed-in door', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'stranger' });
  assert.match(html, /What somebody who found the link sees/);
  assert.match(html, /not a hint/i);
  assert.match(html, /private window/i);
  assert.doesNotMatch(
    html,
    /href="\/maria-and-jomar[^"]*"[^>]*target="_blank"[^>]*>[\s\S]{0,120}Open the stage/,
    'a stranger preview must never carry the host session',
  );
});

test('OBSERVATION 6 · Seat-holder — four cells that are theirs, behind the flag', async () => {
  // Flag OFF (production): the chip does not exist, and the param cannot summon it.
  const dark = await paint({ memberType: 'couple', viewas: 'named_guest' });
  assert.doesNotMatch(dark, />Seat-holder</, 'the named read ships dark');
  assert.doesNotMatch(dark, /as=replied/, 'and no door to it');
  // It falls back to the first offered read rather than painting nothing.
  assert.match(dark, /Your own page, as yourself/);

  const lit = await paint({ memberType: 'couple', namedGuestEnabled: true, viewas: 'named_guest' });
  assert.match(lit, /their seat, and the walk to it/i);
  assert.match(lit, /Photos of them/i);
  assert.match(lit, /bound to their name/i);
  assert.match(lit, /href="\/maria-and-jomar\?phase=rsvp&amp;as=replied"/);
  assert.match(lit, /SAMPLE seat-holder, not one of your guests/i);
});

// ── UNREAD ≠ EMPTY, AT THE PIXEL ───────────────────────────────────────────

test('a guest list the host never shared paints NOT_SHARED — never a zero', async () => {
  const html = await paint({
    memberType: 'coordinator',
    viewas: 'guest',
    guestsShared: false,
    guestsMeasured: false,
  });
  const { NOT_SHARED }: Control = await import('@/lib/event-hub-control');
  assert.match(html, new RegExp(NOT_SHARED));
  assert.doesNotMatch(html, /0 of them have not replied/);
});

test('a refused guest read says only that — not shared, and not zero', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'guest', guestsMeasured: false });
  assert.match(html, /We could not read this/);
  assert.doesNotMatch(html, /Not shared with you/, 'refused is a different fact from withheld');
});

test('no slug ⇒ the read still paints, the door does not', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'guest', slug: null });
  assert.match(html, /seat finder/i, 'the description survives');
  assert.doesNotMatch(html, /href="\/null/, 'never a link to `/null`');
  assert.doesNotMatch(html, /Open the stage they are on/, 'and no door label without a door');
});

// ── EVERY MARK CARRIES A WORD ──────────────────────────────────────────────

test('every ●/◐/○ is spoken — a glyph alone tells a screen-reader user nothing', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'supplier' });
  assert.match(html, /Yes:/);
  assert.match(html, /Partly:/);
  assert.match(html, /No:/);
});
