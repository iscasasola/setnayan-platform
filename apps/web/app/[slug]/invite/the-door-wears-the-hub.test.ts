/**
 * THE RSVP WEARS THE EVENT HUB — its logo and its ground (owner 2026-09-28,
 * looking at the RSVP page of his own event):
 *
 *   · *the logo did not adapt* — the Event Hub hero drew the couple's real logo
 *     (made in the Maker's Logo tool), and the RSVP drew a generic "I & C";
 *   · *"background should follow the background of the event hub"* — the RSVP
 *     painted the door's own capiz lattice over the reveal photo, with a
 *     terracotta Next.
 *
 *   1 · ONE LOGO: every door's crest asks the resolver the Event Hub hero asks
 *       (`heroMarkSvg`), sanitised, draft-aware, initials only when there is no
 *       logo — and every door selects the columns it needs.
 *   2 · ONE GROUND: the RSVP page wears the Event Hub's own look (the SAME
 *       translation the layout wears) and its Main background (the SAME helper
 *       the Event Hub body calls); its frame paints nothing over them, its card
 *       stays a card, and its button is the Event Hub's.
 *
 * Rendered where it can be (the mark, the skin, the door); read as source only
 * where the claim IS about which function a page asks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { heroMarkSvg } from '@/lib/hero-monogram-data';
import { overlayHubDraftEvent } from '@/lib/hub-draft';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const APP = join(process.cwd(), 'app');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

/** A logo the Maker's Logo tool could have saved — a clean vector mark. */
const LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10 L90 90" stroke="#6b3e26" fill="none"/></svg>';
const DRAFT_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#6b3e26"/></svg>';

// The owner's own shape: no monogram text, a Maker logo, a studio config.
const ROW = {
  event_id: 'e-1',
  display_name: 'Ice & Cale',
  monogram_text: null,
  monogram_color: null,
  monogram_custom_svg: LOGO,
  monogram_uploaded_svg: null,
  monogram_studio_config: { text: '' },
  role_palette: null,
};

// ═══ 1 · one logo ═════════════════════════════════════════════════════════

test('1 · the couple\'s logo is the door\'s mark — sanitised, draft-aware, initials only without one', () => {
  assert.equal(heroMarkSvg(ROW), LOGO, 'a Maker logo did not reach the door');
  // Hostile markup never reaches a door — the read-time gate is the resolver's.
  assert.equal(heroMarkSvg({ ...ROW, monogram_custom_svg: '<svg viewBox="0 0 1 1"><script>x()</script></svg>' }), null);
  assert.equal(heroMarkSvg({ ...ROW, monogram_custom_svg: null }), null, 'no logo must mean the initials');
  // The Maker's canvas: a logo edited but not applied shows there.
  const drafted = overlayHubDraftEvent(ROW, { events: { monogram_custom_svg: DRAFT_LOGO }, widgets: {} } as never);
  assert.equal(heroMarkSvg(drafted), DRAFT_LOGO, 'the canvas shows the live logo, not the drafted one');
});

test('1 · the door and the Event Hub hero ask the SAME resolver — no second one', () => {
  const LOOK = read('[slug]/invite/_lib/load-invite-look.ts');
  const LOADERS = read('[slug]/_lib/loaders.ts');
  assert.match(LOOK, /mark: heroMarkSvg\(event\),/, 'the door crest resolves the logo some other way');
  assert.match(LOADERS, /const bespokeSvg = heroMarkSvg\(event\);/, 'the Event Hub hero resolves the logo some other way');
  assert.doesNotMatch(LOOK, /resolveEventMonogramSvg\(|safeMonogramSvg\(/, 'a second resolver in the door');
  // Every door that draws a crest selects what the crest needs.
  for (const door of ['[slug]/invite/page.tsx', '[slug]/invite/enter/page.tsx', '[slug]/invite/reply/page.tsx']) {
    const src = read(door);
    const select = /\.select\(\s*`([^`]*)`/.exec(src)?.[1] ?? '';
    assert.match(select, /\$\{INVITE_MARK_COLUMNS\}/, `${door} draws a crest without selecting the logo — it would say initials`);
  }
  assert.match(LOOK, /export const INVITE_MARK_COLUMNS = 'monogram_custom_svg, monogram_uploaded_svg, role_palette'/);
});

test('1 · every seal on every door draws through SealMark — never the initials alone', () => {
  const THEMES = '[slug]/invite/_components/themes/';
  let seals = 0;
  for (const skin of ['capiz', 'velvet', 'galeriya', 'abaca']) {
    const src = read(`${THEMES}${skin}.tsx`);
    for (const m of src.matchAll(/<span className=\{styles\.seal\}>([\s\S]*?)<\/span>/g)) {
      seals += 1;
      assert.match(m[1]!, /<SealMark mark=\{mark\} monogram=\{monogram\}/, `${skin}'s seal draws the initials past the logo`);
    }
  }
  assert.ok(seals >= 3, `found ${seals} seals — this scan is blind`);
});

test('1 · the mark is drawn inert — the hero\'s own renderer, a data-URI image, never injected markup', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SealMark } = await import('./_components/themes/seal-mark');
  const logo = renderToStaticMarkup(React.createElement(SealMark, { mark: LOGO, monogram: 'I & C', px: 46 }));
  assert.match(logo, /<img[^>]*src="data:image\/svg\+xml;utf8,/, 'the logo is not drawn as an inert image');
  assert.doesNotMatch(logo, /<svg|<path/, 'the logo markup was injected into the page');
  assert.doesNotMatch(logo, /I &amp; C/, 'the initials are drawn beside the logo');
  const initials = renderToStaticMarkup(React.createElement(SealMark, { mark: null, monogram: 'I & C', px: 46 }));
  assert.equal(initials, 'I &amp; C');
  const SRC = read('[slug]/invite/_components/themes/seal-mark.tsx');
  assert.doesNotMatch(SRC, /dangerouslySetInnerHTML/);
});

// ═══ 2 · one ground ═══════════════════════════════════════════════════════

test('2 · the RSVP door paints nothing over the Event Hub — and its card stays a card', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { hubDoorSkin } = await import('./_components/hub-door-skin');
  const { DoorShell } = await import('@/app/_components/door/door-shell');
  const render = (mark: string | null) =>
    renderToStaticMarkup(
      React.createElement(
        DoorShell,
        { title: 'Ice & Cale', eyebrow: 'You’re invited', width: 'lg', skin: hubDoorSkin({ mark, monogram: 'I & C' }) },
        React.createElement('button', { className: 'button-primary', type: 'submit' }, 'Send'),
      ),
    );
  const html = render(LOGO);
  const main = /<main[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(main, 'no door frame rendered');
  // The frame is transparent — no paper, no lattice, no photo over the hub's ground.
  assert.doesNotMatch(main, /\bbg-cream\b/, 'the door lays its own paper over the Event Hub\'s ground');
  assert.doesNotMatch(html, /-z-10 overflow-hidden/, 'the door draws a ground of its own');
  // The button is the Event Hub's: no door colour scope over it.
  assert.doesNotMatch(main, /data-door-action/, 'the door repaints the Event Hub\'s button');
  // The card is on the page's paper — the colour every ink in the scope was computed against.
  assert.match(main, /--surface:rgb\(var\(--color-cream\)\)/, 'the card is not on the page\'s paper');
  assert.match(html, /rounded-2xl border border-ink\/10 bg-surface/, 'the card stopped being a card');
  // The crest is their logo; their initials only when there is none.
  assert.match(html, /data-door-mark="logo"[\s\S]*?<img[^>]*data:image\/svg\+xml/, 'the RSVP crest is not the couple\'s logo');
  const plain = render(null);
  assert.match(plain, /data-door-mark="initials"[\s\S]*?I &amp; C/, 'no logo, and no initials either');
});

test('2 · the RSVP page wears the Event Hub\'s look and Main background — the same translations, draft-aware', () => {
  const REPLY = read('[slug]/invite/reply/page.tsx');
  // The door composition is gone from this page; the hub skin is on.
  assert.doesNotMatch(REPLY, /loadInviteLook\(|look\.skin/, 'the RSVP paints the door\'s composition again');
  assert.match(REPLY, /skin=\{hubDoorSkin\(doorMarkFor\(event\)\)\}/);
  // The look: the one translation the layout wears, around the whole door.
  assert.match(REPLY, /return \(\s*<GuestLookScope \{\.\.\.lookScopeProps\(hub\.look\)\}>\s*\{hub\.ground\}\s*<DoorShell\b/);
  // For a guest: the very value the layout wears (cached). On the canvas with a
  // drafted colour: re-resolved from the drafted row, as the Event Hub canvas does.
  const wear = REPLY.slice(REPLY.indexOf('async function wearTheHub('));
  assert.match(wear, /const row = overlayHubDraftEvent\(shell as Record<string, unknown>, hostDraft\) as EventShellRow;/);
  assert.match(wear, /HUB_DRAFT_LOOK_COLUMNS\.some\(\(c\) => c in hostDraft\.events\)/);
  assert.match(wear, /\? guestLookFrom\(row, await resolveHubTheme\(row\), true\)\s*: await loadGuestLook\(slug\)/);
  // The ground: the Event Hub body's own helper, over the drafted hero row.
  assert.match(wear, /overlayHubDraftWidgets\(await loadWidgets\(admin, shell\.event_id\), hostDraft\)/);
  assert.match(wear, /mainGroundLayerFor\(\{\s*theme: look\.theme,/);
  const PAGE = read('[slug]/page.tsx');
  assert.match(PAGE, /guestLookFrom\(event, hub, true\)/, 'the Event Hub canvas resolves its drafted look some other way — keep the two in step');
});
