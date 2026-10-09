/**
 * the-loading-screen-is-the-page.test.ts — while the Event Hub loads, the
 * guest is looking at THAT page, not another one.
 *
 * Owner, 2026-09-27, watching his own event load: *"before the actual website
 * runs, i see another website under"* — and chose "A matching skeleton"
 * (DECISION_LOG: "THE EVENT HUB'S LOADING SCREEN BECOMES A SKELETON OF THE REAL
 * PAGE"). The old fallback set the couple's names in the theme's `font-display`
 * (Playfair under Vintage) where the masthead sets them in `font-pahina`
 * (Fraunces), printed "Loading your Invitation…", and drew grey boxes shaped
 * like nothing on the page — then a cream card that had never been there
 * replaced all of it.
 *
 * Asserted on RENDERED markup, both sides, so a reword of either file cannot
 * walk past it:
 *   1 · the skeleton's hero IS the masthead — byte-identical to `PahinaMasthead`
 *       given the same words, on every branch (the card · a wake's quiet
 *       masthead · the hero-photo masthead), once the slow parts (the mark, the
 *       photo) are set aside;
 *   2 · the couple's names are set in the masthead's face UTILITY, which is a
 *       CSS variable — never a literal family, never the theme's `font-display`;
 *   3 · the frame is the shell's frame: the same band classes and the same
 *       column classes as `invitation-shell.tsx`, read from its source;
 *   4 · the scenes are real scene cards (`.sn-hub-cards > section`), and no
 *       generic "Loading…" line is drawn (it is announced, `sr-only`).
 *
 * 🪤 `globalThis.React` before the dynamic import (tsconfig `jsx: preserve`).
 * Run from apps/web: `npx tsx --test "app/[slug]/_components/the-loading-screen-is-the-page.test.ts"`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { eventWordsFromProfile } from '../_lib/event-words';
import { invitationCard, mastheadEyebrow } from '../_lib/invitation-card';
import { WAKE_PROFILE, WEDDING_PROFILE, GENERIC_PROFILE } from '@/lib/event-type-profile';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** The masthead's root `<header data-pahina-first-screen …>…</header>`. The
 *  masthead holds exactly one `<header>`, so the first close ends it. */
function heroOf(html: string): string {
  const at = html.indexOf('<header data-pahina-first-screen=""');
  assert.ok(at >= 0, `no masthead in the render:\n${html.slice(0, 400)}`);
  const end = html.indexOf('</header>', at);
  return html.slice(at, end + '</header>'.length);
}

/** Set the slow parts aside: whatever sits in the mark slot, and the cover
 *  plate's media, become one token each on both sides. */
function slowPartsAside(hero: string): string {
  return hero
    .replace(/(<div class="scale-\[1\.85\]">)[\s\S]*?(<\/div><\/div>)/, '$1MARK$2')
    .replace(/(data-motion="arrive-mark" class="mt-6 flex justify-center">)[\s\S]*?(<\/div>)/, '$1MARK$2')
    .replace(/(<div data-pahina-parallax="[^"]*" class="absolute inset-0">)[\s\S]*?(<\/div>)/, '$1MEDIA$2');
}

type Case = { name: string; profile: typeof WEDDING_PROFILE; heroMedia: boolean };
const CASES: Case[] = [
  { name: 'a wedding (the card)', profile: WEDDING_PROFILE, heroMedia: false },
  { name: 'a generic event (one-line card)', profile: GENERIC_PROFILE, heroMedia: false },
  { name: 'a wake (the quiet masthead)', profile: WAKE_PROFILE, heroMedia: false },
  { name: 'a wedding with a hero photo (the cover plate)', profile: WEDDING_PROFILE, heroMedia: true },
];

const EVENT = {
  displayName: 'Indalecio & Claire',
  eventDate: '2026-12-12',
  venueName: 'San Agustin Church',
};

async function renderBoth(c: Case, monogramText: string | null = null) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InvitationSkeleton } = await import('./invitation-skeleton');
  const { PahinaMasthead } = await import('./pahina-masthead');
  const words = eventWordsFromProfile(c.profile);

  const skeleton = renderToStaticMarkup(
    React.createElement(InvitationSkeleton, {
      displayName: EVENT.displayName,
      monogramText,
      words,
      eventDate: EVENT.eventDate,
      heroMedia: c.heroMedia,
      venueName: EVENT.venueName,
    }),
  );

  // The REAL page's props, resolved the way site-body.tsx resolves them.
  const card = c.heroMedia ? null : invitationCard({ words, firstStartAt: null });
  const real = renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      eyebrow: mastheadEyebrow(words),
      displayName: EVENT.displayName,
      twoPeople: words.twoPeople,
      eventDate: EVENT.eventDate,
      venueName: EVENT.venueName,
      card: card ?? undefined,
      monogramSlot: React.createElement('span', null, 'the couple’s mark'),
      ...(c.heroMedia
        ? { mediaSlot: React.createElement('img', { alt: '' }), mediaCaption: EVENT.venueName }
        : {}),
    }),
  );
  return { skeleton, real };
}

for (const c of CASES) {
  test(`1 · the loading hero IS the masthead — ${c.name}`, async () => {
    const { skeleton, real } = await renderBoth(c);
    const a = slowPartsAside(heroOf(skeleton));
    const b = slowPartsAside(heroOf(real));
    // Sanity: the token landed, so the comparison is of the frame around the
    // mark and not of two renders that both lost it.
    assert.match(a, /MARK/, 'the mark slot was not found in the skeleton — rewrite slowPartsAside');
    assert.match(b, /MARK/, 'the mark slot was not found in the masthead — rewrite slowPartsAside');
    if (c.heroMedia) assert.match(a, /MEDIA/, 'the cover plate was not found in the skeleton');
    assert.match(a, /Indalecio/, 'the skeleton lost the couple’s names');
    assert.equal(
      a,
      b,
      'The loading hero is not the page’s hero. It must render PahinaMasthead with the ' +
        'words site-body.tsx gives it (invitationCard / mastheadEyebrow / twoPeople) — a ' +
        'hand-drawn copy is the "another website under" the owner saw.',
    );
  });
}

test('1b · a lettered mark is the page’s own mark, not a stand-in', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InvitationSkeleton } = await import('./invitation-skeleton');
  const { PahinaMasthead } = await import('./pahina-masthead');
  const { HeroMonogram } = await import('@/app/_components/hero-monogram');
  const { resolveMonogram } = await import('@/lib/monogram');
  const words = eventWordsFromProfile(WEDDING_PROFILE);
  const design = { monogram_style: null, monogram_font_key: null, monogram_frame_key: null };
  const monogram = resolveMonogram({ display_name: EVENT.displayName, monogram_text: 'IC', monogram_color: null, ...design });

  const skeleton = renderToStaticMarkup(
    React.createElement(InvitationSkeleton, {
      displayName: EVENT.displayName,
      monogramText: 'IC',
      words,
      eventDate: EVENT.eventDate,
      mark: { design, monogram },
    }),
  );
  const real = renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      eyebrow: mastheadEyebrow(words),
      displayName: EVENT.displayName,
      twoPeople: words.twoPeople,
      eventDate: EVENT.eventDate,
      card: invitationCard({ words, firstStartAt: null }) ?? undefined,
      monogramSlot: React.createElement(HeroMonogram, {
        event: design,
        monogram,
        animatedMonogram: false,
        bespokeSvg: null,
      }),
    }),
  );
  const hero = heroOf(skeleton);
  assert.match(hero, />IC</, 'the lettered mark did not render');
  assert.doesNotMatch(hero, /class="skeleton relative/, 'a lettered mark fell back to the shimmer stand-in');
  assert.equal(hero, heroOf(real), 'the skeleton draws the couple’s lettered mark differently from the page');
});

test('2 · the names are set in the masthead’s face, which is a variable — never a literal', async () => {
  const { skeleton, real } = await renderBoth(CASES[0]!, 'IC');
  const faceOf = (html: string) => {
    const h1 = /<h1[^>]*class="([^"]*)"/.exec(heroOf(html));
    assert.ok(h1, 'no <h1> in the hero');
    return h1[1]!.split(/\s+/).filter((k) => /^font-(?!light|normal|medium|semibold|bold)/.test(k));
  };
  const skeletonFace = faceOf(skeleton);
  assert.deepEqual(skeletonFace, faceOf(real), 'the skeleton sets the names in a different face from the page');
  assert.deepEqual(skeletonFace, ['font-pahina'], `the names wear ${skeletonFace.join(' ')}`);

  // …and that utility is a CSS variable, so a theme or a couple's face moves both.
  const tw = read('tailwind.config.ts');
  const pahina = /\bpahina:\s*\[\s*'([^']+)'/.exec(tw);
  assert.ok(pahina, 'tailwind.config.ts no longer defines the `pahina` family');
  assert.match(pahina[1]!, /^var\(--[\w-]+\)$/, `font-pahina resolves to ${pahina[1]}, not a variable`);

  // Nothing in the skeleton names a face of its own — the old one set the names
  // in `font-display`, which Vintage points at Playfair.
  const src = stripComments(read('app/[slug]/_components/invitation-skeleton.tsx'));
  for (const literal of [/\bfont-display\b/, /\bfont-(playfair|cormorant|caslon|vidaloka|serif)\b/, /fontFamily/, /Playfair|Cormorant|Fraunces/]) {
    assert.doesNotMatch(src, literal, `invitation-skeleton.tsx names a face directly (${literal})`);
  }
});

test('3 · the frame is the shell’s frame — the same band and the same column', async () => {
  const shell = stripComments(read('app/[slug]/_components/invitation-shell.tsx'));
  const band = /<header data-sticky-top className="([^"]+)">\s*<div className="([^"]+)">/.exec(shell);
  assert.ok(band, 'invitation-shell.tsx no longer draws its pinned band — rewrite this guard');
  // The plain column (no spatial backdrop): the string after the ternary's `:`.
  const column = /:\s*'(mx-auto w-full max-w-3xl[^']+)'/.exec(shell);
  assert.ok(column, 'invitation-shell.tsx no longer states its column — rewrite this guard');

  const { skeleton } = await renderBoth(CASES[0]!, 'IC');
  assert.ok(
    skeleton.includes(`<header class="${band[1]}"><div class="${band[2]}">`),
    `the skeleton's band is not the shell's band:\n  shell: ${band[1]} | ${band[2]}`,
  );
  assert.ok(
    skeleton.includes(`<div class="${column[1]}">`),
    `the skeleton's column is not the shell's column — the page would jump when it lands:\n  shell: ${column[1]}`,
  );
  // The monogram sits where the shell puts it, in the shell's face.
  assert.match(skeleton, /<span class="sn-top-label font-pahina text-lg italic text-gild">IC<\/span>/);
});

test('4 · the scenes are real scene cards, and nothing says "Loading…" out loud', async () => {
  const { skeleton } = await renderBoth(CASES[0]!);
  const scenes = /<div class="sn-hub-cards[^"]*">([\s\S]*?)<\/div><\/div><\/main>/.exec(skeleton);
  assert.ok(scenes, 'the scene placeholders are not inside .sn-hub-cards');
  assert.ok((scenes[1]!.match(/<section /g) ?? []).length >= 2, 'fewer than two scene placeholders');
  // …and `.sn-hub-cards > section` is still the rule that draws a real scene card.
  const css = read('app/globals.css');
  assert.match(css, /\.sn-hub-cards > section,[\s\S]{0,320}border-radius: var\(--m-r-md\)/ /* 🔁 2026-10-09 (8c): the one card rule names three more parents of a scene — a page with a Scrub hand-over nests its scenes (`hub-stage` · `hub-after` · `hub-below`); the window grew with the list. */);

  // The loading state is announced to a screen reader, never drawn as a line.
  const status = /<p role="status" class="([^"]*)">([^<]*)<\/p>/.exec(skeleton);
  assert.ok(status, 'the loading state is no longer announced');
  assert.match(status[1]!, /\bsr-only\b/, 'the "Loading…" line is visible again — the owner saw exactly that line');
  const visible = skeleton.replace(/<p role="status"[^>]*>[^<]*<\/p>/, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(visible, /loading/i, 'a visible "loading" word is back on the skeleton');
});

/* ── 5 · THE LOADING SCREEN WEARS THE PAGE'S HERO DESIGN ─────────────────────
 * Hero Designs 2–4 (The Marquee · The Crest · The Letter) shipped after the
 * skeleton, and the skeleton never learned them: it always drew Design 1 · The
 * Card, so a page on any other design loaded as the wrong design and jumped —
 * worst in the Maker, whose canvas reloads right after a design is picked.
 * Held three ways: the render (same design → same hero), the resolver (the
 * body's rows, draft over live, through the body's own functions), and the
 * wiring (page.tsx hands the resolved design to the fallback; site-body reads
 * the hero canvas through the one shared function). */

/** Design-agnostic version of `slowPartsAside`: each design wraps the mark
 *  slot differently, so the slot's CONTENT is the token — the skeleton's
 *  shimmer stand-in on one side, the stand-in mark on the other. */
function markAside(hero: string): string {
  return hero
    .replace(/<span aria-hidden="true" data-skeleton-mark="" class="relative inline-flex[^"]*"><\/span>/, 'MARK')
    .replace('<span>the couple’s mark</span>', 'MARK')
    .replace(/(<div data-pahina-parallax="[^"]*" class="absolute inset-0">)[\s\S]*?(<\/div>)/, '$1MEDIA$2');
}

for (const design of ['card', 'marquee', 'crest', 'letter'] as const) {
  for (const heroMedia of [false, true]) {
    test(`5 · the loading hero wears the page's design — ${design}${heroMedia ? ' (hero photo)' : ''}`, async () => {
      const { renderToStaticMarkup } = await import('react-dom/server');
      const { InvitationSkeleton } = await import('./invitation-skeleton');
      const { PahinaMasthead } = await import('./pahina-masthead');
      const words = eventWordsFromProfile(WEDDING_PROFILE);
      const skeleton = renderToStaticMarkup(
        React.createElement(InvitationSkeleton, {
          displayName: EVENT.displayName,
          monogramText: null,
          words,
          eventDate: EVENT.eventDate,
          heroMedia,
          venueName: EVENT.venueName,
          design,
        }),
      );
      const card = heroMedia ? null : invitationCard({ words, firstStartAt: null });
      const real = renderToStaticMarkup(
        React.createElement(PahinaMasthead, {
          eyebrow: mastheadEyebrow(words),
          displayName: EVENT.displayName,
          twoPeople: words.twoPeople,
          eventDate: EVENT.eventDate,
          venueName: EVENT.venueName,
          card: card ?? undefined,
          design,
          monogramSlot: React.createElement('span', null, 'the couple’s mark'),
          ...(heroMedia ? { mediaSlot: React.createElement('img', { alt: '' }), mediaCaption: EVENT.venueName } : {}),
        }),
      );
      const a = markAside(heroOf(skeleton));
      const b = markAside(heroOf(real));
      assert.match(a, /MARK/, 'the mark slot was not found in the skeleton — rewrite markAside');
      assert.match(b, /MARK/, 'the mark slot was not found in the masthead — rewrite markAside');
      if (heroMedia) assert.match(a, /MEDIA/, 'the cover plate was not found in the skeleton');
      assert.equal(
        a,
        b,
        `The loading hero is not the page's hero on ${design}: the skeleton must draw the design the page wears.`,
      );
      // Off the default the design is stamped on the hero root — the proof the
      // comparison above is of two designed heroes, not of two Cards.
      if (design !== 'card') assert.match(heroOf(skeleton), new RegExp(`data-hero-design="${design}"`));
    });
  }
}

test('5b · the skeleton’s design is the body’s design: the same rows, draft over live, the same resolver', async () => {
  const { heroDesignForSkeleton, heroCanvasOf } = await import('../_lib/hero-design-of');
  const { heroDesignOf } = await import('@/lib/hero-design');
  const { emptyHubDraft } = await import('@/lib/hub-draft');
  type Row = import('@/lib/invitation-widgets').InvitationWidgetRow;
  const row = (widget_type: Row['widget_type'], config_json: unknown): Row => ({
    widget_id: `w-${widget_type}`,
    event_id: 'e',
    widget_type,
    display_order: 0,
    is_visible: true,
    is_always_on: widget_type === 'hero',
    tier: 'basic',
    config_json,
    created_at: '',
    updated_at: '',
  });
  const live = [row('greeting', { canvas: { design: 'letter' } }), row('hero', { canvas: { design: 'marquee' } })];

  // A guest: no draft → the live row's design, found on the HERO row only.
  assert.equal(heroDesignForSkeleton(live, null), 'marquee');
  assert.equal(heroDesignForSkeleton(live, null), heroDesignOf(heroCanvasOf(live)));
  // No hero row / no canvas / an invented design → The Card.
  assert.equal(heroDesignForSkeleton([row('greeting', {})], null), 'card');
  assert.equal(heroDesignForSkeleton([row('hero', { canvas: { design: 'poster' } })], null), 'card');

  // The Maker canvas: the couple just picked The Crest in their draft.
  const draft = { ...emptyHubDraft(), widgets: { hero: { canvas: { design: 'crest' as const } } } };
  assert.equal(heroDesignForSkeleton(live, draft), 'crest', 'the Maker canvas reloads in the LIVE design, not the one just picked');
  // …and picking The Card in the draft (an absence) is honoured too.
  const backToCard = { ...emptyHubDraft(), widgets: { hero: { canvas: {} } } };
  assert.equal(heroDesignForSkeleton(live, backToCard), 'card');
});

test('5c · SOURCE: page.tsx hands the fallback the resolved design; site-body reads the hero canvas through the shared function', () => {
  const page = stripComments(read('app/[slug]/page.tsx'));
  const fallback = /fallback=\{\s*<InvitationSkeleton([\s\S]*?)\/>/.exec(page);
  assert.ok(fallback, 'page.tsx no longer renders InvitationSkeleton as the fallback — rewrite this guard');
  const designProp = /\bdesign=\{(\w+)\}/.exec(fallback[1]!);
  assert.ok(designProp, 'the fallback is not handed a design — the loading screen is back to always drawing The Card');
  assert.match(
    page,
    new RegExp(`const ${designProp[1]} = await \\w+;`),
    `the fallback's design (${designProp[1]}) is not the awaited skeleton design`,
  );
  assert.match(page, /heroDesignForSkeleton\(widgets, draft\)/, 'page.tsx resolves the skeleton design some other way');

  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(body, /const heroCanvas = heroCanvasOf\(widgets\);/, 'site-body reads the hero canvas its own way — a second resolver');
  assert.doesNotMatch(body, /sanitizeHubCanvas\(heroRow/, 'site-body sanitises the hero row itself again — a second resolver');
});

/* ── 6 · NO GREY PLACEHOLDER OUTSTAYS ITS CONTENT (owner, live phone test
 * 2026-10-02: a grey logo circle and grey cards on the guest view). A drawn
 * mark's slot is EMPTY (its size kept, so nothing jumps) — never a grey disc,
 * and with no letters, nothing at all; and the scene cards give up after a
 * while (`.sn-skeleton-gives-up`), so a page that never lands never leaves
 * grey boxes standing. */
test('6 · a drawn mark waits in an empty slot, and the grey cards give up', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InvitationSkeleton } = await import('./invitation-skeleton');
  const html = renderToStaticMarkup(
    React.createElement(InvitationSkeleton, { displayName: EVENT.displayName, monogramText: null, eventDate: EVENT.eventDate, mark: null }),
  );
  const slot = /<span aria-hidden="true" data-skeleton-mark=""[^>]*>([\s\S]*?)<\/span>/.exec(html);
  assert.ok(slot, 'the drawn mark’s slot is gone — the page would jump when the mark lands');
  assert.doesNotMatch(slot[0], /class="[^"]*\bskeleton\b|style=/, 'the drawn mark is a grey shimmer disc again');
  assert.equal(slot[1], '', 'with no letters the slot must draw nothing');
  assert.match(html, /<div class="sn-hub-cards sn-skeleton-gives-up[^"]*">/, 'the scene placeholders no longer give up');
  const css = read('app/globals.css');
  assert.match(css, /\.sn-skeleton-gives-up \{\s*animation: sn-skeleton-give-up [^;]*forwards;/);
  assert.match(css, /@keyframes sn-skeleton-give-up \{\s*to \{\s*opacity: 0;\s*visibility: hidden;/);
});
