/**
 * 🎵 THE GUEST'S MUSIC BUTTON HAS THREE DESIGNS — AND IT MOVES ONLY WHILE THE SONG PLAYS.
 *
 * Owner, 2026-10-08, round 5 (DECISION_LOG "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E), verbatim: *"music icon can be that animated moving bars.
 * can we make them choose 2 more designs?"* — Moving bars (the shipped one, the default) · Record · Note.
 *
 * WHAT IS TESTED, each against the thing itself, never a spelling of it:
 *   (1) what is stored — only Record and Note; "bars", nothing, and junk all read as the shipped bars;
 *   (2) the drawn face — rendered for every design, playing and at rest: a still is drawn for every design, it
 *       carries NO moving class at rest and its own moving class while playing; the bars are the shipped markup;
 *   (3) the motion's CSS — transform and opacity only, and none of it under "reduce motion";
 *   (4) the guest page — the mounted button is handed the hero row's design, and draws the face with `playing`;
 *   (5) the draft — a pick is kept, laid over the hero row beside the main background, counted as ONE free change
 *       only when it differs from what guests see, and Apply writes it under the key the page reads;
 *   (6) the Maker's row — three real controls with the picked one pressed, "Pick a song first" with no song, and
 *       one held draft write per pick.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import {
  HUB_MUSIC_BUTTONS,
  HUB_MUSIC_BUTTON_DEFAULT,
  HUB_MUSIC_BUTTON_LABEL,
  HUB_MUSIC_KEY,
  hubMusicButton,
  hubMusicButtonWrite,
  sanitizeHubMusic,
} from './hub-music-button';
import { HUB_MAIN_GROUND_KEY, hubMainGround } from './hub-canvas';
import {
  classifyHubDraft,
  emptyHubDraft,
  hubDraftItemLabel,
  mergeHubDraft,
  overlayHubDraftWidgets,
  planHubDraftApply,
  sanitizeHubDraft,
  type HubLiveState,
} from './hub-draft';
import type { InvitationWidgetRow } from './invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;

/* The Maker's row reaches the draft action, which is server-only — stood in for, as the other render guards do. */
{
  const Mod = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const G = 'app/[slug]/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';

/** The classes that make a face move. A face at rest carries none of them. */
const MOVING = /sn-eq-bar|sn-music-spin|sn-music-ring/;
const MOVES_WITH: Record<(typeof HUB_MUSIC_BUTTONS)[number], RegExp> = {
  bars: /sn-eq-bar/,
  record: /sn-music-spin/,
  note: /sn-music-ring/,
};

function row(p: Partial<InvitationWidgetRow> & Pick<InvitationWidgetRow, 'widget_type'>): InvitationWidgetRow {
  return {
    widget_id: `w-${p.widget_type}`,
    event_id: 'e1',
    display_order: 5,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: {},
    created_at: '',
    updated_at: '',
    mode: 'auto',
    ...p,
  };
}

test('(1) three designs; only Record and Note are stored — bars, nothing and junk all read as the shipped bars', () => {
  assert.deepEqual([...HUB_MUSIC_BUTTONS], ['bars', 'record', 'note']);
  assert.equal(HUB_MUSIC_BUTTON_DEFAULT, 'bars');
  assert.deepEqual(HUB_MUSIC_BUTTON_LABEL, { bars: 'Moving bars', record: 'Record', note: 'Note' });
  assert.equal(HUB_MUSIC_KEY, 'music');
  assert.deepEqual(sanitizeHubMusic({ button: 'record' }), { button: 'record' });
  assert.deepEqual(sanitizeHubMusic({ button: 'note', colour: '#ff0000', src: 'https://x.test/a.svg' }), { button: 'note' }, 'only the design is kept');
  for (const junk of [null, undefined, 'record', ['record'], {}, { button: 'bars' }, { button: 'disc' }, { button: 3 }, { button: null }]) {
    assert.equal(sanitizeHubMusic(junk), null, `${JSON.stringify(junk)} was kept`);
  }
  // Read off the hero row's config, beside the main background.
  assert.equal(hubMusicButton({ main: { ground: 'theme' }, music: { button: 'note' } }), 'note');
  assert.equal(hubMusicButton({ music: { button: 'record' } }), 'record');
  for (const none of [null, undefined, {}, { music: null }, { music: { button: 'bars' } }, { music: { button: 'x' } }, { main: { button: 'note' } }]) {
    assert.equal(hubMusicButton(none), 'bars', `${JSON.stringify(none)} did not read as the shipped bars`);
  }
  // What a pick writes: the default takes the key off, so an event that goes back reads as one that never chose.
  assert.equal(hubMusicButtonWrite('bars'), null);
  assert.deepEqual(hubMusicButtonWrite('record'), { button: 'record' });
  assert.deepEqual(hubMusicButtonWrite('note'), { button: 'note' });
  for (const d of HUB_MUSIC_BUTTONS) assert.equal(hubMusicButton({ music: hubMusicButtonWrite(d) }), d, `${d} does not survive its own write`);
});

test('(2) every design is drawn at rest AND playing — it moves only while the song plays; the bars are the shipped ones', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MusicButtonFace, MUSIC_BUTTON_CLASS } = await import(`../${G}/music-button-face`);
  const face = (design: string, playing: boolean) => renderToStaticMarkup(React.createElement(MusicButtonFace, { design, playing }));
  const seen = new Set<string>();
  for (const design of HUB_MUSIC_BUTTONS) {
    const rest = face(design, false);
    const play = face(design, true);
    // A still is DRAWN for every design — a picture, not an empty box.
    assert.match(rest, /<svg[\s\S]*<(?:path|circle)/, `${design}: nothing is drawn at rest`);
    assert.doesNotMatch(rest, MOVING, `${design} moves before the song plays`);
    assert.match(play, MOVES_WITH[design], `${design} does not move while the song plays`);
    // It moves in its OWN way only.
    for (const other of HUB_MUSIC_BUTTONS) if (other !== design) assert.doesNotMatch(play, MOVES_WITH[other], `${design} wears ${other}'s motion`);
    // One colour, the button's own — nothing painted in a colour of its own, nothing fetched.
    for (const html of [rest, play]) {
      assert.doesNotMatch(html, /#[0-9a-f]{3,8}\b|rgb\(|url\(|<img|href=|src=/i, `${design} paints or fetches something of its own`);
      assert.match(html, /currentColor|bg-current|border-current|lucide/, `${design} does not take the button's colour`);
    }
    seen.add(rest);
    seen.add(play);
  }
  assert.equal(seen.size, 6, 'two of the six faces (3 designs × at rest / playing) are the same picture');
  // The shipped bars, exactly: three bars while playing, the muted speaker at rest. An unknown design is the bars.
  assert.equal(
    face('bars', true),
    '<span aria-hidden="true" class="inline-flex h-4 items-end gap-[2px]"><span class="sn-eq-bar h-4 w-[3px] rounded-sm bg-current"></span><span class="sn-eq-bar h-4 w-[3px] rounded-sm bg-current [animation-delay:0.2s]"></span><span class="sn-eq-bar h-4 w-[3px] rounded-sm bg-current [animation-delay:0.4s]"></span></span>',
  );
  assert.match(face('bars', false), /^<svg[^>]*class="lucide lucide-volume-x h-5 w-5"/);
  assert.equal(face('nothing-known', true), face('bars', true));
  assert.equal(face('nothing-known', false), face('bars', false));
  // The round itself is the shipped one: a 44-px target on the page's ground, in the page's accent-as-text.
  assert.equal(MUSIC_BUTTON_CLASS, 'inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-cream/90 text-terracotta-700 shadow-sm backdrop-blur');
});

test('(3) the motion is transform and opacity only — and there is none under "reduce motion"', () => {
  const css = raw('app/globals.css');
  for (const name of ['sn-music-spin', 'sn-music-ring']) {
    const at = css.indexOf(`@keyframes ${name} {`);
    assert.ok(at > 0, `@keyframes ${name} is gone`);
    const body = css.slice(at, css.indexOf('\n}', at));
    const props = [...body.matchAll(/^\s+([a-z-]+)\s*:/gm)].map((m) => m[1]);
    assert.ok(props.length > 0, `${name} animates nothing`);
    for (const p of props) assert.ok(p === 'transform' || p === 'opacity', `${name} animates ${p} — transform and opacity only`);
    // The class that wears it runs it without end (a song has no last beat)…
    assert.match(css, new RegExp(`\\.${name} \\{[^}]*animation: ${name} [^;}]*infinite`), `.${name} no longer runs ${name}`);
  }
  // …and under reduce motion both are named off, AFTER the rules that turn them on (same weight — the later one wins).
  const reduce = css.lastIndexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.sn-music-ring {', css.indexOf('.sn-music-ring {') + 1));
  const block = css.slice(reduce, css.indexOf('\n}\n', reduce));
  assert.ok(reduce > css.indexOf('animation: sn-music-ring '), 'the reduce-motion rule comes before the rule it must beat');
  for (const name of ['sn-music-spin', 'sn-music-ring']) {
    assert.match(block, new RegExp(`\\.${name} \\{[^}]*animation: none`), `${name} still runs under reduce motion`);
  }
  // At rest and under reduce motion a ring is not drawn at all — "no rings when paused".
  assert.match(css, /\.sn-music-ring \{[^}]*opacity: 0;[^}]*animation: sn-music-ring/);
});

test('(4) the guest page hands the button the hero row’s design, and the button draws that face with `playing`', () => {
  const body = read(`${G}/site-body.tsx`);
  assert.match(body, /<BackgroundMusic src=\{bgMusicUrl\} design=\{hubMusicButton\(heroRow\?\.config_json\)\} \/>/);
  const music = read(`${G}/background-music.tsx`);
  // ONE face, fed the design it was handed and the song's own state — never a constant.
  assert.equal((music.match(/<MusicButtonFace\b/g) ?? []).length, 1);
  assert.match(music, /<MusicButtonFace design=\{design\} playing=\{playing\} \/>/);
  assert.match(music, /export function BackgroundMusic\(\{ src, design = HUB_MUSIC_BUTTON_DEFAULT \}/);
  // `playing` is true only after the guest's own tap started the song.
  assert.match(music, /const \[playing, setPlaying\] = useState\(false\);/);
  assert.match(music, /await el\.play\(\);\s*setPlaying\(true\);/);
  assert.equal((music.match(/setPlaying\(true\)/g) ?? []).length, 1, 'something other than the tap sets it playing');
  // The accessible name still says play / mute, and the round is the one the Maker draws.
  assert.match(music, /aria-label=\{playing \? 'Mute background music' : 'Play background music'\}/);
  assert.match(music, /className=\{`\$\{MUSIC_BUTTON_CLASS\} transition hover:bg-cream`\}/);
  // No new request: the face file imports only an icon and a type.
  const faceImports = [...read(`${G}/music-button-face.tsx`).matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(faceImports.sort(), ['@/lib/hub-music-button', 'lucide-react']);
});

test('(5) a pick is drafted on the hero row, laid beside the main background, counted once and free, and applied under the page’s key', () => {
  const MAIN = { ground: 'theme' as const };
  const rows: InvitationWidgetRow[] = [
    row({ widget_type: 'hero', is_always_on: true, display_order: 1, config_json: { [HUB_MAIN_GROUND_KEY]: MAIN, keep: 'me' } }),
    row({ widget_type: 'schedule', display_order: 6 }),
  ];
  const live: HubLiveState = { events: {}, widgets: rows };
  // Kept on the hero row only; junk is dropped, never read as "take it off".
  const d = sanitizeHubDraft({ v: 1, events: {}, widgets: { hero: { music: { button: 'record', x: 1 } }, schedule: { music: { button: 'note' } } } });
  assert.deepEqual(d.widgets.hero?.music, { button: 'record' });
  assert.equal('music' in (d.widgets.schedule ?? {}), false, 'a section other than the hero row carries a music button');
  assert.equal('music' in (sanitizeHubDraft({ v: 1, events: {}, widgets: { hero: { music: { button: 'junk' } } } }).widgets.hero ?? {}), false);
  assert.equal(sanitizeHubDraft({ v: 1, events: {}, widgets: { hero: { music: null } } }).widgets.hero?.music, null);

  // Laid over the row the page reads — and the main background and every sibling key are still there.
  const over = overlayHubDraftWidgets(rows, d).find((r) => r.widget_type === 'hero')!;
  assert.equal(hubMusicButton(over.config_json), 'record');
  assert.deepEqual(hubMainGround(over.config_json), MAIN);
  assert.equal((over.config_json as Record<string, unknown>).keep, 'me');
  assert.equal(hubMusicButton(rows[0]!.config_json), 'bars', 'the overlay wrote into the live row');

  // ONE change, free — applied whether or not the couple holds Pro.
  const { items } = classifyHubDraft(d, live);
  assert.equal(items.length, 1);
  const item = items[0]!;
  assert.ok(item.kind === 'widget' && item.field === 'music' && item.widgetType === 'hero');
  assert.deepEqual(item.value, { button: 'record' });
  assert.equal(item.pro, false);
  assert.equal(hubDraftItemLabel(item, (t) => t), 'Your music button');
  for (const ownsPro of [false, true]) {
    const plan = planHubDraftApply(d, live, ownsPro);
    assert.deepEqual(plan.apply.map((i) => (i.kind === 'widget' ? i.field : i.kind)), ['music']);
    assert.deepEqual(plan.refused, []);
  }

  // The same design as guests see is NOT a change — and going back to the bars from Record is one.
  const rowsRecord: InvitationWidgetRow[] = [row({ widget_type: 'hero', config_json: { music: { button: 'record' } } })];
  const liveRecord: HubLiveState = { events: {}, widgets: rowsRecord };
  assert.deepEqual(classifyHubDraft(d, liveRecord).items, []);
  const back = mergeHubDraft(emptyHubDraft(), { widgets: { hero: { music: hubMusicButtonWrite('bars') } } });
  assert.deepEqual(classifyHubDraft(back, live).items, [], 'the bars over the bars counted as a change');
  const backItems = classifyHubDraft(back, liveRecord).items;
  assert.equal(backItems.length, 1);
  assert.equal(backItems[0]!.kind === 'widget' && backItems[0]!.value, null);
  assert.equal(hubMusicButton(overlayHubDraftWidgets(rowsRecord, back)[0]!.config_json), 'bars');
  assert.equal(HUB_MUSIC_KEY in (overlayHubDraftWidgets(rowsRecord, back)[0]!.config_json as object), false, 'the default is stored instead of taken off');

  // Apply writes it under the key the page reads (`hubMusicButton`) — not under the canvas.
  const apply = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /item\.field === 'music'\s*\?\s*HUB_MUSIC_KEY/);
  assert.match(apply, /import \{ HUB_MUSIC_KEY \} from '@\/lib\/hub-music-button';/);
});

test('(6) the Maker draws the three real controls with the picked one pressed; no song → "Pick a song first"; a pick is one held write', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MusicButtonRow, MUSIC_BUTTON_NO_SONG } = await import(`../${E}/music-button-row`);
  const { MusicButtonFace, MUSIC_BUTTON_CLASS } = await import(`../${G}/music-button-face`);
  const paint = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(MusicButtonRow, { eventId: 'e1', ...props }));
  for (const picked of HUB_MUSIC_BUTTONS) {
    const html = paint({ design: picked, hasSong: true });
    const cards = [...html.matchAll(/<button type="button" aria-pressed="(true|false)" data-music-button-pick="([a-z]+)"[\s\S]*?<\/button>/g)];
    assert.deepEqual(cards.map((c) => c[2]), [...HUB_MUSIC_BUTTONS]);
    assert.deepEqual(cards.filter((c) => c[1] === 'true').map((c) => c[2]), [picked], 'the pressed card is not the stored design');
    for (const c of cards) {
      const design = c[2] as (typeof HUB_MUSIC_BUTTONS)[number];
      // The thing itself: the guest's own round, holding the guest's own face as it looks while the song plays.
      assert.ok(c[0].includes(MUSIC_BUTTON_CLASS), `${design}: the card is not the guest's own round`);
      assert.ok(c[0].includes(renderToStaticMarkup(React.createElement(MusicButtonFace, { design, playing: true }))), `${design}: the card does not draw the guest's own face`);
      assert.ok(c[0].includes(`>${HUB_MUSIC_BUTTON_LABEL[design]}</span>`), `${design}: the card is not named`);
    }
    assert.doesNotMatch(html, new RegExp(MUSIC_BUTTON_NO_SONG));
  }
  // No song: the row is quiet — one line, no cards.
  const quiet = paint({ design: 'record', hasSong: false });
  assert.match(quiet, />Pick a song first</);
  assert.doesNotMatch(quiet, /data-music-button-pick/);

  // ONE pick = ONE draft write, held: no whole-Maker render, nothing fetched, the sample told at the tap.
  const src = read(`${E}/music-button-row.tsx`);
  assert.equal((src.match(/draftAction\(eventId, fd\)/g) ?? []).length, 1);
  assert.match(src, /makerSave\(\(\) => draftAction\(eventId, fd\), requestMakerRefresh, \{ held: true \}\)/);
  assert.match(src, /fd\.set\('patch', JSON\.stringify\(\{ widgets: \{ hero: \{ music: hubMusicButtonWrite\(next\) \} \} \}\)\);/);
  assert.match(src, /if \(next === picked\) return;/, 'a tap on the picked card writes');
  assert.doesNotMatch(src, /router\.refresh|useRouter|fetch\(|setInterval|setTimeout/);
  assert.equal((src.match(/tellLookSample\(eventId, \{ musicButton: /g) ?? []).length, 2, 'the sample is told at the tap, and told back when a save is refused');
  // The Music form mounts it lazily (never in the Maker's first load), with the drafted design and "is there a song".
  const lazy = raw(`${E}/scene-styles-lazy.tsx`);
  assert.match(lazy, /export const MusicButtonRow = dynamic\(\s*\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/music-button-row'\)/);
  const panel = read(`${E}/media-panels.tsx`);
  assert.match(panel, /import \{ MusicButtonRow, OurMusicSong \} from '\.\/scene-styles-lazy';/);
  assert.match(panel, /<MusicButtonRow eventId=\{eventId\} design=\{musicButton\} hasSong=\{Boolean\(musicRef\) \|\| pickedTrack !== null \|\| uploaded\} draftAction=\{draftAction\} \/>/);
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /const musicButtonNow = hubMusicButton\(allWidgets\.find\(\(r\) => r\.widget_type === 'hero'\)\?\.config_json\);/);
  assert.match(page, /musicButton=\{musicButtonNow\}/);
  assert.match(page, /musicButton: musicButtonNow,/);
});
