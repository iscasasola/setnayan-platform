#!/usr/bin/env node
/**
 * Couple-area look scan (clean warm look sweep, 16 Nov 2026).
 *
 * Counts, in apps/web/app/{dashboard,receipts,panood}/** (.tsx, tests excluded):
 *   FRAME  a class string that draws a frame by hand: a container radius
 *          (rounded-lg|xl|2xl|3xl|card|tile) + an opaque white fill
 *          (bg-white|bg-cream|bg-surface|bg-raised) + a hand edge or lift
 *          (bare `border`, `ring-1`, or a `shadow*`). Form fields, popovers
 *          (absolute/fixed) and dashed drop zones are not frames.
 *   TOKEN_FRAME  a class string reading the frame token (--sn-frame-bg).
 *   PAGE   a full-height wrapper (min-h-screen|dvh|svh) painting white by hand,
 *          or the inline `background: 'var(--m-paper)'` page paint.
 *   BUTTON a raw <button> whose className paints its own fill
 *          (bg-mulberry|bg-ink|bg-terracotta|bg-cream|bg-white…).
 *
 * Run from the repo root:  node build-sessions/shots-sweep-couple/scan.mjs [--list FRAME|PAGE|BUTTON]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../apps/web/', import.meta.url).pathname;
const AREAS = ['app/dashboard', 'app/receipts', 'app/panood'];

export function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx') && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const RADIUS = /^rounded-(?:lg|xl|2xl|3xl|card|tile)$/;
const FILL = /^(?:bg-white|bg-cream|bg-surface|bg-raised)$/;
const base = (t) => t.split(':').pop().replace(/^!/, '');
const plain = (t) => !t.includes(':');

/** Classify one class string. Returns 'FRAME' | 'TOKEN_FRAME' | null. */
export function classify(str) {
  if (str.includes('--sn-frame-bg')) return 'TOKEN_FRAME';
  const toks = str.split(/\s+/).filter(Boolean);
  const pl = toks.filter(plain);
  const radius = pl.some((t) => RADIUS.test(t));
  const fill = pl.some((t) => FILL.test(t));
  const edge = pl.some((t) => t === 'border' || t === 'ring-1' || /^shadow(?:-(?:sm|md|lg|xl|2xl))?$/.test(t));
  if (!radius || !fill || !edge) return null;
  if (toks.some((t) => /^(?:focus|focus-within):(?:border|ring)/.test(t))) return null; // a field
  if (pl.some((t) => t === 'absolute' || t === 'fixed' || t === 'border-dashed')) return null;
  // fields (lint-field-template's), dialogs and sheets (the Sheet's own lift), images, QR quiet zones
  if (toks.some((t) => /^(?:placeholder|backdrop|file):/.test(t))) return null;
  if (pl.some((t) => t === 'outline-none' || t === 'object-cover' || t === 'qr-slot' || /^shadow-(?:xl|2xl)$/.test(t))) return null;
  // a fixed square icon tile (h-10 w-10, h-[34px] w-[34px]) is a mark, not a frame
  const h = pl.find((t) => /^h-(?:\d+|\[\d+px\])$/.test(t));
  if (h && pl.includes('w-' + h.slice(2))) return null;
  return 'FRAME';
}

/** Every quoted / backtick class-ish string literal in a source. */
export function strings(src) {
  const out = [];
  const re = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;
  let m;
  while ((m = re.exec(src))) {
    const s = m[1] ?? m[2] ?? m[3];
    if (/\brounded-|\bbg-|min-h-/.test(s)) out.push({ s, index: m.index });
  }
  return out;
}

function lineOf(src, i) {
  return src.slice(0, i).split('\n').length;
}

export function scan() {
  const hits = { FRAME: [], TOKEN_FRAME: [], PAGE: [], BUTTON: [] };
  for (const area of AREAS) {
    for (const file of walk(join(ROOT, area))) {
      const src = readFileSync(file, 'utf8');
      const rel = relative(ROOT, file);
      for (const { s, index } of strings(src)) {
        const tag = /<([A-Za-z][\w.]*)\b[^<]*$/.exec(src.slice(Math.max(0, index - 600), index))?.[1] ?? '';
        let c = classify(s);
        if (c === 'FRAME' && /^(?:input|textarea|select|img|dialog|Image)$/.test(tag)) c = null;
        if (c) hits[c].push(`${rel}:${lineOf(src, index)}`);
        const pl = s.split(/\s+/).filter(plain);
        if (pl.some((t) => /^min-h-(?:screen|dvh|svh)$/.test(t)) &&
            pl.some((t) => /^bg-(?:white|cream|surface|\[var\(--m-paper(?:-2)?\)\])$/.test(t))) {
          hits.PAGE.push(`${rel}:${lineOf(src, index)}`);
        }
      }
      for (const m of src.matchAll(/background:\s*'var\(--m-paper\)'/g)) {
        // only a full-height wrapper's paint — a chip with the same inline fill is not a page
        if (/min-h-(?:screen|dvh|svh)\b[^<]*$/.test(src.slice(Math.max(0, m.index - 160), m.index))) {
          hits.PAGE.push(`${rel}:${lineOf(src, m.index)}`);
        }
      }
      for (const m of src.matchAll(/<button\b[^>]*?className=(?:"([^"]*)"|\{`([^`]*)`)/gs)) {
        const cls = m[1] ?? m[2] ?? '';
        if (cls.split(/\s+/).some((t) => /^bg-(?:mulberry|ink|terracotta|cream|white|surface)(?:$|\/|-)/.test(t))) {
          hits.BUTTON.push(`${rel}:${lineOf(src, m.index)}`);
        }
      }
    }
  }
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hits = scan();
  const list = process.argv.indexOf('--list');
  if (list > -1) {
    for (const h of hits[process.argv[list + 1]] ?? []) console.log(h);
  } else {
    for (const [k, v] of Object.entries(hits)) console.log(`${k.padEnd(12)} ${v.length}`);
  }
}
