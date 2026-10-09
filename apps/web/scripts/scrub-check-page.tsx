/**
 * 🎚 scrub-check-page.tsx — writes ONE static page that is the guest page's own Scrub, for a real browser to play:
 * the REAL renderer (`HubScenes`), the REAL scene classes and values (`hubCanvasClass` · `hubCanvasVars`), the REAL
 * stylesheet (`app/globals.css`) and the REAL engine (`hub-scrub-engine.ts`, bundled by the caller). Only the words
 * inside the scenes are stand-ins. Used by `scripts/scrub-browser-check.mjs`.
 *
 *   tsx scripts/scrub-check-page.tsx <out.html> <engine.js> [noscript]
 *   tsx scripts/scrub-check-page.tsx <out.html> <engine.js> empty     — the second scene (Countdown) drew NOTHING
 *   tsx scripts/scrub-check-page.tsx <out.html> <engine.js> page      — THE PAGE'S OWN HOLD: the whole page (what is
 *       before the scenes, the scenes, what is after) inside `HubPageHold`, the engine armed on its outermost pair
 *   tsx scripts/scrub-check-page.tsx <out.html> <island.js> page-island — the same, armed by the page's own island
 *   tsx scripts/scrub-check-page.tsx <out.html> <island.js> island    — a guest's page armed by the page's own ISLAND
 *   tsx scripts/scrub-check-page.tsx <out.html> <island.js> maker     — the Maker's canvas: a section marker on the
 *       page, and the page's own ISLAND (`scripts/scrub-check-island.tsx`) deciding when the engine is armed
 *   tsx scripts/scrub-check-page.tsx <out.html> <engine.js> bar       — A LONG ARRIVAL UNDER THE PINNED TOP BAR: the
 *       page's own hold, the invitation's pinned bar above it, and a list that hands over to a second long list
 *   tsx scripts/scrub-check-page.tsx <out.html> <engine.js> cover     — 🎬 THE COVER AS HAND-OVER ZERO: the page's own
 *       hold, a strip, the cover through the REAL `HubCoverHold`, then the lab's five scenes right after it. And:
 *       cover-tall (a cover taller than the screen) · cover-block (two plain blocks between the cover and the
 *       scenes: whatever comes next arrives) · cover-only (no scene scrubs — the cover is the page's only Scrub) ·
 *       cover-noscript (the same page, no script) · cover-today (the cover does NOT hand over: today's page) ·
 *       cover-reveal <island.js> (armed by the island, under the Reveal's mark) · cover-margin (the cover's last
 *       line has a bottom margin that runs out through the cover's box — on a cover tall enough that what arrives
 *       is drawn OVER it: only then is the margin ADDED to the distance; under a short cover the larger one wins)
 *   tsx scripts/scrub-check-page.tsx <out.html> - cards              — THE HUB IS CARDS, FRAMED OR NOT: no Scrub at
 *       all — five scenes in the hub's own card wrapper, each through the REAL frame (`HubCanvasFrame`)
 *
 * THE CHAIN — the owner's prototype, as scenes: two short ones that hand over, a Schedule whose rows build one by
 * one, a scene with NO Build out (it stays), one that builds in below it and leaves by Scrub, and the last arrival,
 * which has no effect of its own.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HubCanvasFrame } from '../app/[slug]/_components/hub-canvas-frame';
import { HubCoverHold, HubPageHold, HubScenes, hubCoverLeaves, hubScrubHolds } from '../app/[slug]/_components/hub-scenes';
import { hubCanvasClass, hubCanvasVars, sanitizeHubCanvas } from '../lib/hub-canvas';
import { LAB_SCRUB_CHAIN, LAB_SCRUB_COVER, LAB_SCRUB_SAMPLE } from '../app/dev/maker-lab/lab-scrub';

(globalThis as unknown as { React: unknown }).React = React;

/* 🔑 Five of the six canvases are THE LAB'S CHAIN (`app/dev/maker-lab/lab-scrub.ts`), in its order — what this page
   proves in a browser is what `?scrub=1` on the Maker lab starts on. The FIRST scene is this page's own: it stands in
   for the cover ("Maria & Jose" → the countdown, the owner's own example), which is not a scene the real page can
   hand over yet — so the lab does not show it, and this check keeps proving the hand-over it will need. */
const COVER = { in: 'fade', out: 'move_fade', outTo: 'above', transition: 'scrub' } as const;
export const SCRUB_CHECK_CHAIN = [
  { name: 'Names', rows: 0, canvas: COVER },
  ...(
    [
      { name: 'Countdown', rows: 0 },
      { name: 'Schedule', rows: 8 },
      { name: 'Note', rows: 0 },
      { name: 'Wear', rows: 0 },
      { name: 'Gifts', rows: 0 },
    ] as const
  ).map((s, i) => ({ ...s, canvas: LAB_SCRUB_SAMPLE[LAB_SCRUB_CHAIN[i]!] })),
];

/* 📌 `bar` — A LONG ARRIVAL UNDER THE INVITATION'S PINNED TOP BAR (2026-10-09). A list is scrolled through and held
   with its bottom on the centre line; an arrival taller than what is left of it is drawn FROM THE TOP OF THE ROOM
   down (`hub-scrub-math.ts` `scrubPair`: tops together). That top is the page's line under its own bar — ONE number,
   the stylesheet's (`--hub-pin`), which the engine reads back. The engine once kept its own (76 px, or 9 %) while the
   stylesheet's is 100 px under the bar, and a long arrival began 24 px high, under the progress mark. So: a page
   with the real page's bar (`invitation-shell.tsx` `data-sticky-top`: 4rem and a hairline, pinned), and two lists
   one after the other, both in the lab Schedule's canvas. */
const BAR_CHAIN = [
  { name: 'Schedule', rows: 8, canvas: LAB_SCRUB_SAMPLE.schedule },
  { name: 'March', rows: 8, canvas: LAB_SCRUB_SAMPLE.schedule },
  { name: 'Gifts', rows: 0, canvas: {} },
];

/* 🃏 `cards` — THE HUB IS CARDS, FRAMED OR NOT (2026-10-09). A scene the couple arranged in any way is drawn inside
   a frame (`HubCanvasFrame`), and the hub's card rule only reached a section that was its wrapper's own child — so a
   scene given nothing but a Build in lost its card and stood as bare words on the page. Five scenes as the guest
   page draws them (the card wrapper › the renderer › the REAL frame › the widget's section):
     Plain          nothing arranged — no frame: the card it always had
     Motion         a Build in and nothing else — a frame that paints nothing: the card, the same one
     NoBackground   "No background" — no box at all, on purpose
     Colour         a colour of its own — the frame IS the box; no card inside it
     Template       one of the 25 templates — its own layout, never a card */
const CARD_SCENES = [
  { name: 'Plain', canvas: {} },
  { name: 'Motion', canvas: { in: 'fade' } },
  { name: 'NoBackground', canvas: { kind: 'none', in: 'fade' } },
  { name: 'Colour', canvas: { kind: 'color', color: '#5B1A22' } },
  { name: 'Template', canvas: { template: 1 } },
];

const [, , out, engine, mode] = process.argv;
if (mode === 'cards') {
  const rows = CARD_SCENES.map((s, i) => ({ widget_id: `c${i}`, widget_type: `custom_${i + 1}`, config_json: { canvas: s.canvas } }));
  const html = renderToStaticMarkup(
    <div className="sn-hub-cards">
      <HubScenes widgets={rows as never} scrubAllowed>
        {CARD_SCENES.map((s, i) => (
          <HubCanvasFrame key={s.name} widget={rows[i] as never} hubTheme="house">
            <section data-name={s.name} {...(s.name === 'Template' ? { 'data-scene-template': '1' } : {})}>
              <p style={{ margin: 0, font: '700 11px/1.3 sans-serif', letterSpacing: '.08em', color: '#A9834B' }}>{s.name.toUpperCase()}</p>
              <h2 style={{ margin: '6px 0', font: '600 22px/1.2 Georgia, serif' }}>{s.name}</h2>
              <p style={{ margin: 0 }}>The words of {s.name}.</p>
            </section>
          </HubCanvasFrame>
        ))}
      </HubScenes>
    </div>,
  );
  writeFileSync(
    out!,
    `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="file://${join(__dirname, '..', 'app', 'globals.css')}">
<style>html,body{margin:0;background:#F3F0EA;font:16px/1.4 sans-serif;--color-ink:44 42 41;--color-cream:255 255 255;--m-r-md:14px;--m-r-lg:20px}
.col{max-width:430px;margin:0 auto;padding:24px 16px}.sn-hub-cards>*+*{margin-top:1rem}</style></head>
<body><div class="col">${html}</div></body></html>`,
  );
  console.log('wrote', out, '·', CARD_SCENES.length, 'scenes in the hub’s card wrapper ·', (html.match(/class="hub-canvas /g) ?? []).length, 'framed');
  process.exit(0);
}
/* 🎬 `cover…` — the page's cover hands over (hand-over zero), so the chain is the lab's five scenes: the stand-in
   "Names" scene is not needed. `cover-only`: the same scenes with nothing arranged — only the cover scrubs. */
const coverMode = mode?.startsWith('cover') ? mode : null;
const chain = mode === 'bar' ? BAR_CHAIN : coverMode ? SCRUB_CHECK_CHAIN.slice(1).map((s) => (coverMode === 'cover-only' ? { ...s, canvas: {} } : s)) : SCRUB_CHECK_CHAIN;
const widgets = chain.map((s, i) => ({ widget_id: `w${i}`, widget_type: s.name.toLowerCase(), config_json: { canvas: s.canvas } }));
const nodes = chain.map((s, i) => {
  const canvas = sanitizeHubCanvas(widgets[i]!.config_json);
  /* `empty`: a widget that rendered nothing — the frame is there, its body is empty (a Countdown with no date). */
  const body = mode === 'empty' && i === 1 ? null : (
    <section data-name={s.name} data-lab-name={s.name}>
      <p style={{ margin: 0, font: '700 11px/1.3 sans-serif', letterSpacing: '.08em', color: '#A9834B' }}>{s.name.toUpperCase()}</p>
      <h2 style={{ margin: '6px 0', font: '600 22px/1.2 Georgia, serif' }}>{s.name}</h2>
      {s.rows ? (
        <ol data-hub-rows="" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {Array.from({ length: s.rows }, (_, r) => (
            <li key={r} data-row={r + 1} style={{ padding: '26px 0', borderTop: '1px solid #ddd' }}>
              Row {r + 1}
            </li>
          ))}
        </ol>
      ) : (
        <p style={{ margin: 0, minHeight: s.name === 'Wear' ? 150 : 70 }}>The words of {s.name}.</p>
      )}
    </section>
  );
  /* A scene nobody arranged has no frame at all (`hasHubCanvas`) — the last arrival is one. */
  return Object.keys(canvas).length === 0 ? (
    <React.Fragment key={i}>{body}</React.Fragment>
  ) : (
    <div key={i} className={hubCanvasClass(canvas)} style={hubCanvasVars(canvas) as React.CSSProperties}>
      <div className="hub-canvas-body">{body}</div>
    </div>
  );
});
const scenes = renderToStaticMarkup(
  <HubScenes widgets={widgets as never} scrubAllowed scrubOut>
    {nodes}
  </HubScenes>,
);
if (coverMode) {
  /* The cover is the hero row: it Leaves by Scrub, as "Scene leaves ◆" on one of its parts stores it. Asked through
     the REAL question (`hubCoverLeaves`) — `cover-today` is the same row with Scrub out not offered: today's page. */
  const hero = { widget_type: 'hero', config_json: { canvas: LAB_SCRUB_COVER } };
  const leaves = hubCoverLeaves([hero] as never, true, coverMode !== 'cover-today');
  const page = renderToStaticMarkup(
    <HubPageHold holds={hubScrubHolds(widgets as never, true, true) + (leaves ? 1 : 0)}>
      <div className="strip col">SETNAYAN · INVITATION</div>
      <HubCoverHold
        leaves={leaves}
        cover={
          <header data-cover="" className={`cover col${coverMode === 'cover-tall' ? ' tall' : coverMode === 'cover-margin' ? ' margin' : ''}`}>
            <p style={{ margin: 0, font: '700 11px/1.3 sans-serif', letterSpacing: '.3em', color: '#A9834B' }}>TOGETHER WITH THEIR FAMILIES</p>
            <h1 style={{ margin: '28px 0 12px', font: '400 44px/1.1 Georgia, serif' }}>Maria &amp; Jose</h1>
            <p style={{ margin: coverMode === 'cover-margin' ? '0 0 40px' : 0, font: '400 20px/1.3 Georgia, serif', color: '#A9834B' }}>December 12, 2026</p>
          </header>
        }
      >
        {/* A marker with no size, as the real page puts before a block: it is never what arrives. */}
        <span hidden data-marker="" />
        {coverMode === 'cover-block' ? (
          <>
            <section data-block="Greeting" className="block col">
              <b>Personal greeting</b>
              <br />
              Dear Teresita, we would love you there.
            </section>
            <section data-block="Ticket" className="block col">
              <b>Guest’s ticket</b>
            </section>
          </>
        ) : null}
        <div className="col" data-hub-wrap="" dangerouslySetInnerHTML={{ __html: scenes }} />
        <div className="foot col" data-foot="">
          The page after the scenes.
        </div>
      </HubCoverHold>
    </HubPageHold>,
  );
  /* `cover-reveal`: armed by the page's own ISLAND (the caller hands the island's bundle), with the Reveal's mark on
     the page before it mounts — as the overlay writes it while a guest is looking at the opening. */
  const arm =
    coverMode === 'cover-today' || coverMode === 'cover-noscript'
      ? ''
      : coverMode === 'cover-reveal'
        ? `<script>document.documentElement.setAttribute('data-reveal-up', '');</script><script src="file://${engine}"></script>`
        : `<script src="file://${engine}"></script><script>window.__stop = HubScrubEngine.armHubScrub(document.querySelector('.hub-page-cell'));</script>`;
  writeFileSync(
    out!,
    `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="file://${join(__dirname, '..', 'app', 'globals.css')}">
<style>html,body{margin:0;background:#F3F0EA;font:16px/1.4 sans-serif;--color-ink:44 42 41;--color-cream:255 255 255;--m-r-md:14px}
.col{max-width:430px;margin:0 auto;padding:0 16px}.strip{padding:10px 16px;font:600 10px/1.6 sans-serif;letter-spacing:.3em;color:#A9834B;border-bottom:1px solid #ddd}
.cover{box-sizing:border-box;min-height:62vh;padding:9vh 24px 40px;text-align:center}.cover.tall{min-height:130vh}.cover.margin{min-height:0;padding-top:34vh;padding-bottom:0}
.block{padding:28px 16px;border-top:1px solid #ddd;text-align:center}.foot{padding:40px 24px;height:60px;box-sizing:border-box}
#line{position:fixed;left:0;right:0;top:50%;border-top:1.5px dashed rgba(194,78,36,.6);pointer-events:none;z-index:9}</style></head>
<body><div id="line"></div>${page}
${arm}
</body></html>`,
  );
  console.log('wrote', out, '· the cover', leaves ? 'hands over' : 'does not hand over', '·', (page.match(/class="hub-page-cell"/g) ?? []).length, 'page pairs ·', (scenes.match(/class="hub-cell"/g) ?? []).length, 'hand-overs among the scenes');
  process.exit(0);
}
/* The page's own hold — the REAL component, around everything the page draws, one pair a hand-over. */
const paged = mode === 'page' || mode === 'page-island' || mode === 'bar';
const hold = paged
  ? (renderToStaticMarkup(<HubPageHold holds={hubScrubHolds(widgets as never, true, true)}><i id="slot" /></HubPageHold>).split('<i id="slot"></i>') as [string, string])
  : (['', ''] as [string, string]);
const css = join(__dirname, '..', 'app', 'globals.css');
writeFileSync(
  out!,
  `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="file://${css}">
<style>html,body{margin:0;background:#F3F0EA;font:16px/1.4 sans-serif;--color-ink:44 42 41;--color-cream:255 255 255;--m-r-md:14px}
.lead{height:90vh;padding:24px;box-sizing:border-box}.foot{padding:40px 24px;height:60px;box-sizing:border-box}.col{max-width:430px;margin:0 auto;padding:0 16px}
#line{position:fixed;left:0;right:0;top:50%;border-top:1.5px dashed rgba(194,78,36,.6);pointer-events:none;z-index:9}
.bar{position:sticky;top:0;z-index:20;box-sizing:content-box;min-height:4rem;border-bottom:1px solid rgba(44,42,41,.1);background:rgba(255,255,255,.95)}</style></head>
<body><div id="line"></div>${mode === 'bar' ? '<header data-sticky-top class="bar"></header>' : ''}${hold[0]}<div class="lead col" data-lead>The page before the scenes.</div><div class="col">${mode === 'maker' ? '<span hidden data-maker-section="w:countdown"></span>' : ''}${scenes}</div><div class="foot col" data-foot>The page after the scenes.</div>${hold[1]}
${mode === 'noscript' ? '' : mode === 'maker' || mode === 'island' || mode === 'page-island' ? `<script src="file://${engine}"></script>` : mode === 'page' || mode === 'bar' ? `<script src="file://${engine}"></script><script>window.__stop = HubScrubEngine.armHubScrub(document.querySelector('.hub-page-cell'));</script>` : `<script src="file://${engine}"></script><script>window.__stop = HubScrubEngine.armHubScrub(document.querySelector('.hub-scenes'));</script>`}
</body></html>`,
);
console.log('wrote', out, '·', (scenes.match(/class="hub-cell"/g) ?? []).length, 'hand-overs ·', (scenes.match(/data-hub-fx=""/g) ?? []).length, 'scenes under the thumb');
