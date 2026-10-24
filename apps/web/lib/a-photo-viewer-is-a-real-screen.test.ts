/**
 * 🖼 A PICTURE OPENED ON THE EVENT HUB GETS A REAL SCREEN, AND A WAY BACK — owner 2026-10-24, two reports:
 *
 *   · *"https://www.setnayan.com/api/pabuya/qr/S89Y-… — when i opened the QR Code, there is no way to go back."* The
 *     gift QR's thumbnail was `<a href={m.qrUrl} target="_blank">` to the raw image route: in the app shell and the
 *     PWA a bare PNG with nothing to press. Two more tiles did the same with photos ("Open full size to save").
 *   · a Love Story photo opened SEE-THROUGH — the story's words, a blurred photo and the rail's side cards showing over
 *     it. The viewer was `fixed inset-0`, mounted inside a moment's size container (layout containment) that also wears
 *     a transform/opacity entrance — so "the screen" was the moment's box, and it inherited the fade.
 *
 * Held here, as properties:
 *   1 · the shared viewer is PORTALLED to the body (no ancestor can shrink it), closes on Back (`useBackCloses`), and its
 *       ground (`.sn-gal-scrim`, defined once) is OPAQUE — no alpha, no backdrop filter;
 *   2 · nothing the Hub draws is an `<a target="_blank">` to `/api/pabuya/qr/` — nor, in the Hub's photo surfaces, an
 *       `<a target="_blank">` at all;
 *   3 · rendered: a gift method with a QR draws a button that opens the viewer, and no link to the QR route that is not
 *       a download.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('1 · the shared viewer is portalled, closes on Back, and stands on an OPAQUE ground', () => {
  const lb = stripComments(read('app/_components/gallery/gallery-lightbox.tsx'));
  assert.match(lb, /createPortal\(/, 'the viewer is mounted where it was opened — a contained ancestor shrinks it again');
  assert.match(lb, /document\.body/, 'the viewer is not portalled to the body');
  assert.match(lb, /useBackCloses\(/, "the phone's Back no longer closes the viewer");
  assert.match(lb, /className="sn-gal-scrim fixed inset-0/, 'the viewer no longer stands on the gallery scrim');

  const css = read('app/globals.css');
  const rules = [...css.matchAll(/(^|\n)([^{}\n]*\.sn-gal-scrim\b[^{}]*)\{([^}]*)\}/g)];
  assert.equal(rules.length, 1, `.sn-gal-scrim is defined ${rules.length} times — a second rule can make it see-through`);
  const body = rules[0]![3]!;
  assert.doesNotMatch(body, /backdrop-filter|opacity\s*:/, 'the viewer ground blurs or fades the page instead of hiding it');
  const bg = /background(?:-color)?\s*:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? '';
  let colour = bg;
  const v = /^var\((--[\w-]+)\)$/.exec(bg);
  if (v) colour = new RegExp(`${v[1]}\\s*:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? '';
  assert.match(colour, /^#[0-9a-fA-F]{6}$|^rgb\(\s*\d+\s+\d+\s+\d+\s*\)$/, `the viewer ground is "${bg}" → "${colour}" — not an opaque colour`);
});

/** Every `<a …>` opening tag in a source, read to its own `>` (braces skipped, so `=>` inside a handler does not end it). */
function anchors(src: string): string[] {
  const out: string[] = [];
  const re = /<a[\s>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + 2;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p);
  }
  return out;
}

/** What the Hub draws: its own tree, and the shared parts it mounts for a guest. */
const HUB_FILES = [
  ...walk(join(WEB, 'app', '[slug]')),
  ...walk(join(WEB, 'app', '_components', 'pabuya')),
  ...walk(join(WEB, 'app', '_components', 'gallery')),
];

test('2 · the Hub renders no new-tab link to the raw gift QR route', () => {
  assert.ok(HUB_FILES.length > 50, `only ${HUB_FILES.length} Hub files found — the walk is pointed at the wrong tree`);
  const bad: string[] = [];
  for (const f of HUB_FILES) {
    for (const a of anchors(stripComments(readFileSync(f, 'utf8')))) {
      if (!/target=["{]/.test(a) || !/_blank/.test(a)) continue;
      if (/\/api\/pabuya\/qr\/|qrUrl|qr_url/i.test(a)) bad.push(`${relative(WEB, f)}: ${a.replace(/\s+/g, ' ').slice(0, 140)}`);
    }
  }
  assert.deepEqual(bad, [], `a gift QR opens as a bare image in a new tab again:\n${bad.join('\n')}`);
});

/** The Hub's picture surfaces — a tap here opens the viewer, never a bare picture in a tab. */
const PHOTO_SURFACES = [
  'app/_components/pabuya/pabuya-card-list.tsx',
  'app/_components/pabuya/pabuya-qr-viewer.tsx',
  'app/_components/gallery/gallery-lightbox.tsx',
  'app/[slug]/_components/photos-of-you-gallery.tsx',
  'app/[slug]/_components/live-wall-block.tsx',
  'app/[slug]/_components/your-shots-gallery.tsx',
  'app/[slug]/_components/your-shot-tile.tsx',
  'app/[slug]/_components/glimpse-rail.tsx',
];

test('2b · no Hub picture surface opens a picture in a new tab', () => {
  const bad: string[] = [];
  for (const rel of PHOTO_SURFACES) {
    for (const a of anchors(stripComments(read(rel)))) {
      if (/target=["{][^ ]*_blank/.test(a)) bad.push(`${rel}: ${a.replace(/\s+/g, ' ').slice(0, 140)}`);
    }
  }
  assert.deepEqual(bad, [], `a picture opens in a new tab, with no way back:\n${bad.join('\n')}`);
});

test('3 · rendered: a gift QR is a button that opens the viewer, and the only link to its route is the download', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PabuyaCardList } = await import('../app/_components/pabuya/pabuya-card-list');
  const QR = '/api/pabuya/qr/S89Y-YVVMHATFG6';
  for (const kind of ['gcash', 'bank']) {
    const html = renderToStaticMarkup(
      React.createElement(PabuyaCardList, {
        methods: [{ kind, label: '', accountName: 'Ana Reyes', handle: '0917 123 4567', note: null, qrUrl: QR }],
      }),
    );
    assert.match(html, /<button[^>]*data-egift-qr=[^>]*aria-haspopup="dialog"/, `${kind}: the QR does not open the viewer`);
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]!);
    const toRoute = links.filter((h) => h.startsWith('/api/pabuya/qr/'));
    assert.ok(toRoute.length > 0, `${kind}: "Save QR" is gone`);
    for (const h of toRoute) assert.match(h, /[?&]download=1/, `${kind}: a link opens the bare QR image (${h})`);
    assert.doesNotMatch(html, /target="_blank"/, `${kind}: something on the gift card opens a new tab`);
  }
});
