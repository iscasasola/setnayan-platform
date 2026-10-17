/**
 * 🕯 THE VINTAGE ART KIT — owner 2026-10-16, DECISION_LOG "APPROVED — THE VINTAGE ART KIT, AS THE PROOF SHOWS":
 * *"Approved — build the vintage art kit as the proof shows (decorations come with the Vintage look, with an On/Off
 * switch)."* And on pricing, the same evening: *"the accents we added should be part of pro."*
 *
 * What this holds (each sabotaged once when it was written — see the PR):
 *   1 · each scene draws ONLY its own accent (owner 2026-10-16, "AN ACCENT BELONGS TO ITS SCENE…"): its pick, else
 *       the look's default (Vintage: on; any other look: None); None draws nothing; 1c · the Maker's one Accent ▾;
 *   2 · no kit (or every scene at None) = NO kit markup — every mount renders byte for byte what it did before;
 *   3 · the Pro gate is ONE constant (`ART_KIT_IS_PRO`), held for BOTH values: on the guest page, in the draft's
 *       pricing, and on the Apply sheet's line;
 *   4 · reduce motion = no animation; a piece moves only while on screen; the keyframes move only rotate/translate;
 *   5 · the kit's files exist, and the whole kit is ≤ 600 KB (each piece ≤ 80 KB);
 *   6 · the seal's tap unveils — it is deaf to the pointer and sits over the veil's own full-screen hit-zone, whose
 *       tap calls `unveil()`;
 *   7 · the closing never shows another couple's photo — its one picture is the event's own cover photo, or none.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ACCENT_NONE,
  ACCENT_SCENES,
  ACCENT_SLOT,
  ART_KITS,
  ART_KIT_BYTE_CEILING,
  ART_KIT_IS_PRO,
  ART_KIT_ORNAMENTS,
  ART_KIT_SLOTS,
  ART_KIT_SLOT_SCENE,
  KIT_DEFAULT_ACCENTS,
  SCENE_ACCENTS,
  accentsTurnOn,
  artKitCss,
  artKitFor,
  artKitView,
  kitFiles,
  kitPlacements,
  sanitizeSceneAccents,
  viewPlacements,
} from './art-kits';
import { INVITE_THEMES, INVITE_THEME_IDS } from './invite-themes';
import { eventItemIsPro, mergeHubDraft, emptyHubDraft, type HubLiveState } from './hub-draft';
import { hubDraftProEffects } from './hub-pro-effects';
import { stripComments } from './strip-comments';
import { KitClosing, KitPiece, KitSeal, KitSlot, sealLetters } from '../app/[slug]/_components/kit-piece';
import { PahinaMasthead } from '../app/[slug]/_components/pahina-masthead';
import { ReplyCardRow } from '../app/[slug]/_components/guest-me-parts';
import { PabuyaCardList } from '../app/_components/pabuya/pabuya-card-list';

/* The pieces are JSX: under `tsx --test` it compiles to React.createElement (the house idiom). */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const h = React.createElement;
const VINTAGE = artKitFor('vintage')!;
/** The Vintage page with every scene at the look's default — what a Pro Vintage event draws before any pick. */
const VIEW = artKitView({ theme: 'vintage', accents: {}, ownsPro: true, tryOn: false })!;

/* ── 1 · only Vintage, only with Decorations on ─────────────────────────────────────────────────────────────────── */

test('1 · each scene draws ONLY its own accent — the pick, else the look’s default; None draws nothing', () => {
  assert.ok(VINTAGE, 'Vintage lost its kit');
  assert.equal(INVITE_THEMES.vintage.ornament, VINTAGE.ornament, 'the kit is no longer keyed by Vintage’s ornament hook');
  assert.deepEqual([...ART_KIT_ORNAMENTS].sort(), Object.keys(ART_KITS).sort(), 'ART_KIT_ORNAMENTS drifted from ART_KITS');
  // Each scene offers only its own pieces — every option's pieces are placed in THAT scene's slot.
  for (const scene of ACCENT_SCENES) {
    const slotPieces = new Set(kitPlacements(VINTAGE, ACCENT_SLOT[scene]).map((p) => p.piece));
    for (const o of SCENE_ACCENTS[scene]) for (const piece of o.pieces) assert.ok(slotPieces.has(piece), `${scene} offers ${piece}, which is not its slot’s`);
  }
  assert.deepEqual(SCENE_ACCENTS.countdown.map((o) => o.pieces), [['countdown-frame']], 'the countdown’s accent is the narra columns');
  // Picking draws exactly that piece in its slot; None draws nothing there.
  const v = artKitView({ theme: 'vintage', accents: { hero: 'drapes', countdown: 'none' }, ownsPro: true, tryOn: false })!;
  assert.deepEqual([...new Set(viewPlacements(v, 'cover').map((p) => p.piece))], ['drape'], 'Drapes drew more than the drapes');
  assert.deepEqual(viewPlacements(v, 'countdown'), [], 'None still drew the columns');
  assert.deepEqual([...new Set(viewPlacements(v, 'gifts-card').map((p) => p.piece))], ['corner-floral', 'fan'], 'an unpicked Vintage scene lost its default');
  // A Vintage page starts every scene ON; another look starts at None — and may still pick.
  for (const scene of ACCENT_SCENES) assert.ok(viewPlacements(VIEW, ACCENT_SLOT[scene]).length > 0, `Vintage’s ${scene} does not start with its accent`);
  for (const id of INVITE_THEME_IDS.filter((t) => t !== 'vintage')) {
    assert.equal(artKitView({ theme: id, accents: {}, ownsPro: true, tryOn: false }), null, `${id} drew an accent nobody picked`);
  }
  const house = artKitView({ theme: 'house', accents: { countdown: 'narra-columns' }, ownsPro: true, tryOn: false })!;
  assert.equal(viewPlacements(house, 'countdown').length, 2, 'Classic could not pick the columns');
  assert.equal(house.look, false);
  assert.equal(viewPlacements(house, 'veil').length + viewPlacements(house, 'heading').length, 0, 'the look’s own pieces came with a scene’s pick');
  // Stored picks are kept to known scenes and their own choices.
  assert.deepEqual(sanitizeSceneAccents({ countdown: 'garland', hero: 'drapes', bogus: 'x', rsvp: ACCENT_NONE }), { hero: 'drapes', rsvp: ACCENT_NONE });
  assert.deepEqual(Object.keys(KIT_DEFAULT_ACCENTS).sort(), [...ACCENT_SCENES].sort());

  // The page asks the rule ONCE, of the RESOLVED theme and the stored picks, and hands the answer to every mount.
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(
    body,
    /const artKit = artKitView\(\{ theme: sceneTheme, accents: sceneAccentsFromPreferences\(\(event as \{ style_preferences\?: unknown \}\)\.style_preferences\), ownsPro: proWatermarkHidden, tryOn: isEditorCanvas \}\);/,
    'site-body no longer decides the kit from the resolved theme, the scenes’ picks and the event’s Pro',
  );
  assert.equal((body.match(/artKitView\(/g) ?? []).length, 1, 'the kit is decided more than once on the page');
});

test('1c · the Maker: a scene’s Style has ONE Accent ▾ listing only its own accents, written to the draft', () => {
  const row = stripComments(read('app/dashboard/[eventId]/website/editor/_components/accent-row.tsx'));
  assert.match(row, /const options = SCENE_ACCENTS\[scene\];/, 'the row lists more than its scene’s accents');
  assert.match(row, /\{ key: ACCENT_NONE, label: 'None' \}/, 'None is not offered');
  assert.match(row, /save\(\{ style_preferences: \{ \[SCENE_ACCENTS_PREF_KEY\]: next \} \}\)/, 'the pick does not go to the draft whole');
  assert.match(row, /data-look-row="accent"/, 'the row would be hidden under the Style cards');
  assert.equal((row.match(/<Dd\b/g) ?? []).length, 1, 'one dropdown is enough');
  const shell = stripComments(read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'));
  assert.match(shell, /elementEditing && isAccentScene\(type\) \?/, 'a scene without accents would get the row');
  for (const scene of ['rsvp', 'fixed'] as const) assert.ok(shell.includes(`accentRowFor(${scene === 'rsvp' ? "'rsvp'" : 'fixed'})`), `no Accent row on ${scene}`);
});

test('1b · the slot model is data: every placement names a known piece, a slot, and the slot’s scene', () => {
  for (const kit of Object.values(ART_KITS)) {
    for (const p of kit.placements) {
      assert.ok(kit.pieces[p.piece], `${p.piece}: not a piece of the kit`);
      assert.ok((ART_KIT_SLOTS as readonly string[]).includes(p.slot), `${p.piece}: unknown slot ${p.slot}`);
      assert.equal(p.scene, ART_KIT_SLOT_SCENE[p.slot], `${p.piece}: its scene is not its slot’s`);
    }
  }
  // The church on the ceremony card belongs to the venue-card build; Shimmer to the Cover Scene build — never this kit.
  assert.equal(Object.keys(VINTAGE.pieces).some((k) => /church/.test(k)), false, 'the church drawing joined the kit');
  assert.equal(/shimmer/i.test(artKitCss(VIEW)), false, 'Shimmer joined the kit');
  // A piece may hang past the page's edge; the page never scrolls sideways for it — WebKit needs the BODY to clip.
  assert.ok(artKitCss(VIEW).includes('html:has([data-art-kit]) body{overflow-x:clip}'), 'the body no longer clips the kit sideways (WebKit scrolls)');
});

/* ── 2 · off = no kit markup ────────────────────────────────────────────────────────────────────────────────────── */

test('2 · with no kit every mount renders byte for byte what it did before; with one, the slot is there', () => {
  const mastProps = { displayName: 'Maria & Jose', eventDate: '2026-12-18', venueName: 'Seda' };
  const bare = renderToStaticMarkup(h(PahinaMasthead, mastProps));
  assert.equal(renderToStaticMarkup(h(PahinaMasthead, { ...mastProps, kitSlot: null })), bare, 'a null kit changed the cover');
  const dressed = renderToStaticMarkup(h(PahinaMasthead, { ...mastProps, kitSlot: h(KitSlot, { kit: VIEW, slot: 'cover', eager: true }) }));
  assert.match(dressed, /data-kit-slot="cover"/);
  assert.equal((dressed.match(/data-kit-piece=/g) ?? []).length, viewPlacements(VIEW, 'cover').length);

  // A scene at None draws NO markup at all — not an empty slot.
  const noneView = artKitView({ theme: 'vintage', accents: { countdown: ACCENT_NONE }, ownsPro: true, tryOn: false })!;
  assert.equal(renderToStaticMarkup(h(KitSlot, { kit: noneView, slot: 'countdown' })), '', 'None drew an (empty) slot');

  const card = { kind: 'ask', line: 'Will you join us?', replyBy: null, href: '#reply', cta: 'Reply' } as never;
  assert.equal(renderToStaticMarkup(h(ReplyCardRow, { card, kit: null })), renderToStaticMarkup(h(ReplyCardRow, { card })), 'a null kit changed the reply card');
  assert.match(renderToStaticMarkup(h(ReplyCardRow, { card, kit: h(KitSlot, { kit: VIEW, slot: 'reply' }) })), /data-kit-slot="reply"/);

  const methods = [
    { kind: 'gcash', label: 'GCash', accountName: 'M', handle: '1', note: null, qrUrl: null },
    { kind: 'bank', label: 'Bank transfer', accountName: 'M', handle: '2', note: null, qrUrl: null },
  ];
  assert.equal(renderToStaticMarkup(h(PabuyaCardList, { methods, kit: null })), renderToStaticMarkup(h(PabuyaCardList, { methods })), 'a null kit changed the gift cards');
  const gifts = renderToStaticMarkup(h(PabuyaCardList, { methods, kit: h(KitSlot, { kit: VIEW, slot: 'gifts-card' }) }));
  assert.equal((gifts.match(/data-kit-slot="gifts-card"/g) ?? []).length, 1, 'the gift kit is drawn on more than one card');
  assert.ok(gifts.indexOf('data-kit-slot') > gifts.indexOf('GCash'), 'the gift kit dressed the GCash card, not the bank card');

  // Every mount on the page is gated on the one decision — nothing is drawn for a null kit.
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  for (const [what, re] of [
    ['cover', /const kitCover = artKit \? <KitSlot kit=\{artKit\} slot="cover" eager \/> : null;/],
    ['reply', /kit=\{artKit \? <KitSlot kit=\{artKit\} slot="reply" \/> : null\}/],
    ['seal', /kitSeal=\{artKit \? <KitSeal kit=\{artKit\} mark=\{hubLook\.monogram\} \/> : null\}/],
    ['style', /\{artKit \? <KitStyle kit=\{artKit\} \/> : null\}/],
    ['motion', /\{artKit \? <ArtKitMotion \/> : null\}/],
    /* 🕯 …the closing on a kit look even at None (its band, no oval — owner 2026-10-17), or wherever its oval is on. */
    ['closing', /kitClosing=\{\s*artKit && \(artKit\.look \|\| artKit\.pieces\.closing\?\.length\)\s*\?/],
  ] as const) {
    assert.match(body, re, `site-body's ${what} mount is no longer gated on the kit`);
  }
  for (const [file, re] of [
    /* 🕯 …the countdown's on its own card AND on the scene's own background (owner 17 Oct, "why narra columns are not showing?"). */
    ['app/[slug]/_components/hideable-widget-render.tsx', /kit=\{artKit \? <KitSlot kit=\{artKit\} slot="countdown" \/> : null\}/],
    ['app/[slug]/_components/public-hideable-widget.tsx', /kit=\{artKit \? <KitSlot kit=\{artKit\} slot="countdown" \/> : null\}/],
    ['app/[slug]/_components/guest-welcome.tsx', /\{artKit \? <KitSlot kit=\{artKit\} slot="gifts-divider" \/> : null\}/],
    ['app/[slug]/_components/guest-welcome.tsx', /kit=\{artKit \? <KitSlot kit=\{artKit\} slot="gifts-card" \/> : null\}/],
    ['app/[slug]/_components/invitation-shell.tsx', /\{kitClosing \? \(/],
  ] as const) {
    assert.match(stripComments(read(file)), re, `${file}: a kit mount is no longer gated`);
  }
});

/* ── 3 · Pro: one constant, both values ─────────────────────────────────────────────────────────────────────────── */

test('3 · ART_KIT_IS_PRO is the one gate — both values hold on the guest page, in the draft and at Apply', () => {
  for (const isPro of [true, false]) {
    const freeGuest = artKitView({ theme: 'vintage', accents: {}, ownsPro: false, tryOn: false, isPro });
    assert.equal(freeGuest !== null, !isPro, `isPro=${isPro}: a free event’s guest page`);
    assert.ok(artKitView({ theme: 'vintage', accents: {}, ownsPro: false, tryOn: true, isPro }), `isPro=${isPro}: the Maker canvas`);
    assert.ok(artKitView({ theme: 'vintage', accents: {}, ownsPro: true, tryOn: false, isPro }), `isPro=${isPro}: an owning event`);
    // Turning an accent on is Pro only while the constant says so; turning one off never is.
    assert.deepEqual(accentsTurnOn({}, { countdown: 'narra-columns' }, isPro), isPro ? ['countdown'] : []);
    assert.deepEqual(accentsTurnOn({ countdown: 'narra-columns' }, { countdown: ACCENT_NONE }, isPro), [], 'None must always be free');
  }
  // The draft's pricing reads the constant, live.
  assert.equal(eventItemIsPro('style_preferences', { scene_accents: { countdown: 'narra-columns' } }, 'change', {}), ART_KIT_IS_PRO);
  assert.equal(eventItemIsPro('style_preferences', { scene_accents: { countdown: ACCENT_NONE } }, 'change', {}), false, 'None was priced as Pro');

  // …and the Apply sheet names it "Decorations", with the scenes it dresses — and on the theme that brings them.
  const live: HubLiveState = { events: { style_preferences: {}, invite_theme: 'house' }, widgets: [] };
  const on = hubDraftProEffects(mergeHubDraft(emptyHubDraft(), { events: { style_preferences: { scene_accents: { countdown: 'narra-columns', hero: 'drapes' } } } }), live, false).map((e) => `${e.what} · ${e.where}`);
  assert.deepEqual(on, ART_KIT_IS_PRO ? ['Decorations · Cover, Countdown'] : [], 'the Apply sheet’s Decorations line');
  const off = hubDraftProEffects(mergeHubDraft(emptyHubDraft(), { events: { style_preferences: { scene_accents: { countdown: ACCENT_NONE } } } }), live, false);
  assert.deepEqual(off, [], 'taking an accent off was asked for Pro');
  const theme = hubDraftProEffects(mergeHubDraft(emptyHubDraft(), { events: { invite_theme: 'vintage' } }), { events: {}, widgets: [] }, false).map((e) => `${e.what} · ${e.where}`);
  assert.deepEqual(theme, [ART_KIT_IS_PRO ? 'Theme · Vintage, with its Decorations' : 'Theme · Vintage']);
  assert.deepEqual(hubDraftProEffects(mergeHubDraft(emptyHubDraft(), { events: { style_preferences: { scene_accents: { countdown: 'narra-columns' } } } }), live, true), [], 'an owning couple was asked');

  const loaders = stripComments(read('app/[slug]/_lib/loaders.ts'));
  assert.match(loaders, /const proWatermarkHiddenAhead = startAhead\(websiteProActiveFor\(event\.event_id\)\);/);
  assert.match(stripComments(read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx')), /tryPro=\{ART_KIT_IS_PRO && !ownsPro\}/, 'the Accent row is not ◆ through the one constant');
});

/* ── 4 · motion ─────────────────────────────────────────────────────────────────────────────────────────────────── */

test('4 · reduce motion = no animation; a piece moves only while on screen; the keyframes only turn and lift', () => {
  const css = artKitCss(VIEW);
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){[data-kit-motion]{animation-name:none!important}}'), 'reduce motion no longer stills the kit');
  assert.ok(css.includes('[data-kit-motion]{animation-play-state:paused;'), 'a piece is not paused until it is on screen');
  assert.ok(css.includes('[data-kit-motion][data-kit-live]{animation-play-state:running}'), 'nothing un-pauses a piece on screen');
  for (const [, body] of css.matchAll(/@keyframes [\w-]+\{(.*?\})\}/g)) {
    const props = [...body!.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    assert.ok(props.every((p) => p === 'rotate' || p === 'translate'), `a kit keyframe moves ${props.join(', ')}`);
  }
  const motion = stripComments(read('app/[slug]/_components/art-kit-motion.tsx'));
  assert.match(motion, /prefers-reduced-motion: reduce\)'\)\.matches\) return;/, 'the on-screen marker runs under reduce motion');
  assert.match(motion, /new IntersectionObserver/);
  // Sway on the drapes and the araña, Float on the florals — as approved.
  const motionOf = (piece: string) => [...new Set(VINTAGE.placements.filter((p) => p.piece === piece).map((p) => p.motion))];
  assert.deepEqual(motionOf('drape'), ['sway']);
  assert.deepEqual(motionOf('chandelier'), ['sway']);
  assert.deepEqual(motionOf('corner-floral'), ['float']);
  assert.deepEqual(motionOf('rsvp-ornament'), ['float']);
  // A still piece carries no motion attribute at all.
  const still = renderToStaticMarkup(h(KitPiece, { kit: VINTAGE, placement: kitPlacements(VINTAGE, 'countdown')[0]! }));
  assert.equal(still.includes('data-kit-motion'), false);
});

/* ── 5 · bytes ──────────────────────────────────────────────────────────────────────────────────────────────────── */

test('5 · every kit file ships, lazy, and a whole kit is ≤ 600 KB (each piece ≤ 80 KB)', () => {
  for (const kit of Object.values(ART_KITS)) {
    let total = 0;
    for (const file of kitFiles(kit)) {
      const path = join(WEB, 'public', file);
      assert.ok(existsSync(path), `${file} is not shipped`);
      const bytes = statSync(path).size;
      assert.ok(bytes <= 80 * 1024, `${file} is ${bytes} bytes — over the 80 KB a piece may weigh`);
      total += bytes;
    }
    assert.ok(total <= ART_KIT_BYTE_CEILING, `the ${kit.ornament} kit is ${total} bytes — over ${ART_KIT_BYTE_CEILING}`);
    // Nothing else rides in the kit's folder (a stand-in, the church): what ships is what the registry draws.
    const shipped = readdirSync(join(WEB, 'public', kit.dir)).map((f) => `${kit.dir}/${f}`).sort();
    assert.deepEqual(shipped, [...kitFiles(kit)].sort(), 'the kit’s folder holds a file the registry does not draw');
  }
  // Raster pieces are AVIF first, WebP behind, lazy by default with their slot's size.
  const html = renderToStaticMarkup(h(KitSlot, { kit: VIEW, slot: 'reply' }));
  assert.match(html, /<source type="image\/avif"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /sizes="/);
});

/* ── 6 · the seal ───────────────────────────────────────────────────────────────────────────────────────────────── */

test('6 · the seal’s tap unveils — deaf to the pointer, over the veil’s own hit-zone, whose tap calls unveil()', () => {
  const seal = renderToStaticMarkup(h(KitSeal, { kit: VIEW, mark: 'I & C' }));
  assert.equal(/<button|onclick|role="button"|href=/i.test(seal), false, 'the seal grew a press of its own — a second unveil handler');
  assert.match(seal, /data-kit-seal-mark=""[^>]*>IC</, 'the couple’s mark is not in the seal');
  assert.equal(sealLetters('C & I'), 'CI');
  assert.ok(artKitCss(VIEW).includes('[data-kit-slot]{pointer-events:none}'), 'the seal is no longer deaf to the pointer');

  const overlay = stripComments(read('app/[slug]/_components/reveal/reveal-overlay.tsx'));
  const veil = overlay.slice(overlay.indexOf('if (veil) {'), overlay.indexOf('data-veil-hint'));
  assert.ok(veil.includes('<VeilReveal') && veil.indexOf('{kitSeal}') > veil.indexOf('<VeilReveal'), 'the seal is not drawn over the veil');
  assert.match(veil, /data-veil-seal=""\s+className=\{`pointer-events-none absolute/);
  const reveal = stripComments(read('app/[slug]/_components/reveal/veil-reveal.tsx'));
  assert.match(reveal, /if \(dur < 300 && net < 18\) \{\s+if \(!locked && liftTarget < 1\) \{\s+unveil\(\);/, 'a tap on the veil no longer unveils');
  assert.match(reveal, /ref=\{grabRef\}\s+className="absolute inset-x-0 top-0 bottom-0"/, 'the veil’s hit-zone no longer covers the screen under the seal');
});

/* ── 7 · the closing's photo ────────────────────────────────────────────────────────────────────────────────────── */

test('7 · the closing never shows another couple’s photo — the event’s own cover photo, or their mark', () => {
  const base = { kit: VIEW, names: 'Maria & Jose', date: 'December 18, 2026', mark: 'M & J', hideWatermark: false };
  const none = renderToStaticMarkup(h(KitClosing, { ...base, photoUrl: null }));
  const pics = [...none.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(pics.every((src) => src!.startsWith(VINTAGE.dir)), `with no photo the closing drew a picture: ${pics.join(', ')}`);
  assert.match(none, /data-kit-photo="mark"/);
  const own = renderToStaticMarkup(h(KitClosing, { ...base, photoUrl: 'https://media.example/their-own.jpg' }));
  const ownPics = [...own.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((src) => !src!.startsWith(VINTAGE.dir));
  assert.deepEqual(ownPics, ['https://media.example/their-own.jpg']);
  // The page hands it THIS event's hero photo (`loadMedia`, signed for this event) — nothing else.
  assert.match(stripComments(read('app/[slug]/_components/site-body.tsx')), /photoUrl: heroPhotoUrl \?\? null,/);
  // …and the kit carries no stand-in of its own.
  assert.equal(kitFiles(VINTAGE).some((f) => /standin|stand-in|photo/i.test(f)), false);
  // The sign-off keeps its words and its Powered-by line, and drops it only as the plain sign-off does.
  assert.match(none, /data-shell-sign-off=""[^>]*>See you soon\.</);
  assert.match(none, /Powered by Setnayan · setnayan\.com/);
  assert.equal(renderToStaticMarkup(h(KitClosing, { ...base, photoUrl: null, hideWatermark: true })).includes('Powered by'), false);
});
