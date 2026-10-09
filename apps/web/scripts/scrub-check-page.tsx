/**
 * 🎚 scrub-check-page.tsx — writes ONE static page that is the guest page's own Scrub, for a real browser to play:
 * the REAL renderer (`HubScenes`), the REAL scene classes and values (`hubCanvasClass` · `hubCanvasVars`), the REAL
 * stylesheet (`app/globals.css`) and the REAL engine (`hub-scrub-engine.ts`, bundled by the caller). Only the words
 * inside the scenes are stand-ins. Used by `scripts/scrub-browser-check.mjs`.
 *
 *   tsx scripts/scrub-check-page.tsx <out.html> <engine.js> [noscript]
 *   tsx scripts/scrub-check-page.tsx <out.html> <engine.js> empty     — the second scene (Countdown) drew NOTHING
 *   tsx scripts/scrub-check-page.tsx <out.html> <island.js> maker     — the Maker's canvas: a section marker on the
 *       page, and the page's own ISLAND (`scripts/scrub-check-island.tsx`) deciding when the engine is armed
 *
 * THE CHAIN — the owner's prototype, as scenes: two short ones that hand over, a Schedule whose rows build one by
 * one, a scene with NO Build out (it stays), one that builds in below it and leaves by Scrub, and the last arrival,
 * which has no effect of its own.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HubScenes } from '../app/[slug]/_components/hub-scenes';
import { hubCanvasClass, hubCanvasVars, sanitizeHubCanvas } from '../lib/hub-canvas';
import { LAB_SCRUB_CHAIN, LAB_SCRUB_SAMPLE } from '../app/dev/maker-lab/lab-scrub';

(globalThis as unknown as { React: unknown }).React = React;

/* 🔑 The six canvases are THE LAB'S CHAIN (`app/dev/maker-lab/lab-scrub.ts`), in its order — what this page proves
   in a browser is what `?scrub=1` on the Maker lab starts on. Only the names here are this page's own. */
export const SCRUB_CHECK_CHAIN = (
  [
    { name: 'Names', rows: 0 },
    { name: 'Countdown', rows: 0 },
    { name: 'Schedule', rows: 8 },
    { name: 'Note', rows: 0 },
    { name: 'Wear', rows: 0 },
    { name: 'Gifts', rows: 0 },
  ] as const
).map((s, i) => ({ ...s, canvas: LAB_SCRUB_SAMPLE[LAB_SCRUB_CHAIN[i]!] }));

const [, , out, engine, mode] = process.argv;
const widgets = SCRUB_CHECK_CHAIN.map((s, i) => ({ widget_id: `w${i}`, widget_type: s.name.toLowerCase(), config_json: { canvas: s.canvas } }));
const nodes = SCRUB_CHECK_CHAIN.map((s, i) => {
  const canvas = sanitizeHubCanvas(widgets[i]!.config_json);
  /* `empty`: a widget that rendered nothing — the frame is there, its body is empty (a Countdown with no date). */
  const body = mode === 'empty' && i === 1 ? null : (
    <section data-name={s.name}>
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
  <HubScenes widgets={widgets as never} scrubAllowed>
    {nodes}
  </HubScenes>,
);
const css = join(__dirname, '..', 'app', 'globals.css');
writeFileSync(
  out!,
  `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="file://${css}">
<style>html,body{margin:0;background:#F3F0EA;font:16px/1.4 sans-serif;--color-ink:44 42 41;--color-cream:255 255 255;--m-r-md:14px}
.lead{height:90vh;padding:24px;box-sizing:border-box}.foot{padding:40px 24px;height:60px;box-sizing:border-box}.col{max-width:430px;margin:0 auto;padding:0 16px}
#line{position:fixed;left:0;right:0;top:50%;border-top:1.5px dashed rgba(194,78,36,.6);pointer-events:none;z-index:9}</style></head>
<body><div id="line"></div><div class="lead col" data-lead>The page before the scenes.</div><div class="col">${mode === 'maker' ? '<span hidden data-maker-section="w:countdown"></span>' : ''}${scenes}</div><div class="foot col" data-foot>The page after the scenes.</div>
${mode === 'noscript' ? '' : mode === 'maker' ? `<script src="file://${engine}"></script>` : `<script src="file://${engine}"></script><script>window.__stop = HubScrubEngine.armHubScrub(document.querySelector('.hub-scenes'));</script>`}
</body></html>`,
);
console.log('wrote', out, '·', (scenes.match(/class="hub-cell"/g) ?? []).length, 'hand-overs ·', (scenes.match(/data-hub-fx=""/g) ?? []).length, 'scenes under the thumb');
