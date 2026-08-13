#!/usr/bin/env node
/**
 * fetch-brand-fonts.mjs — download the brand faces ONCE, into the repo.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * `next/font/google` fetches every family from `fonts.gstatic.com` AT BUILD
 * TIME. When that fetch fails the whole build fails — and on 2026-08-13 it
 * failed **twice in one day** on two unrelated PRs (Manrope, then Hanken
 * Grotesk), each time presenting as a failure of the change under test rather
 * than as an outage. One of them also took the e2e suite down with it, because
 * the tests never got a build to run against.
 *
 * 🔑 A BUILD THAT DEPENDS ON SOMEBODY ELSE'S UPTIME IS NOT REPRODUCIBLE. The
 * files do not change; only our ability to reach them does. So they are
 * downloaded once, committed, and served by `next/font/local` — same faces,
 * same weights, same rendering, no network.
 *
 * ─── WHAT IT DOWNLOADS, EXACTLY ──────────────────────────────────────────
 * The `latin` subset only, which is precisely what every declaration asked for
 * (`subsets: ['latin']`). One `.woff2` per weight × style, taken from the same
 * CSS the browser would receive — so the bytes are byte-identical to what
 * `next/font/google` was fetching.
 *
 * ⚠ THE USER-AGENT IS LOAD-BEARING. Google serves `.ttf` to unknown agents and
 * `.woff2` only to agents it recognises as modern. Without it you silently get
 * files ~4× larger in a format with no compression benefit.
 *
 * Re-run only when a face is added or a weight changes:
 *   node apps/web/scripts/fetch-brand-fonts.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'app', '_fonts');

/** Chrome — anything less and gstatic serves .ttf instead of .woff2. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * Mirrors the declarations in `app/layout.tsx` exactly. `weights` defaults to
 * ['400'] where the original passed none; `italic: true` where it passed
 * `style: ['normal','italic']`.
 */
const FAMILIES = [
  { css: 'Cormorant Garamond', dir: 'cormorant-garamond', weights: ['400', '500', '600', '700'] },
  { css: 'Fraunces', dir: 'fraunces', weights: ['300', '400', '500', '600'], italic: true },
  { css: 'Manrope', dir: 'manrope', weights: ['400', '500', '600', '700'] },
  { css: 'DM Mono', dir: 'dm-mono', weights: ['400', '500'] },
  { css: 'Hanken Grotesk', dir: 'hanken-grotesk', weights: ['400', '500', '600', '700', '800'] },
  { css: 'Space Mono', dir: 'space-mono', weights: ['400', '700'] },
  { css: 'Cinzel', dir: 'cinzel', weights: ['400', '600'] },
  { css: 'Playfair Display', dir: 'playfair-display', weights: ['400', '600'], italic: true },
  { css: 'Great Vibes', dir: 'great-vibes', weights: ['400'] },
  { css: 'Libre Caslon Display', dir: 'libre-caslon-display', weights: ['400'] },
  { css: 'Tangerine', dir: 'tangerine', weights: ['400', '700'] },
  { css: 'Luxurious Script', dir: 'luxurious-script', weights: ['400'] },
  { css: 'Vidaloka', dir: 'vidaloka', weights: ['400'] },
];

/** The `latin` block is the LAST @font-face Google emits per axis value. */
function parseLatinFaces(css) {
  const out = [];
  const blocks = css.split('@font-face').slice(1);
  for (const b of blocks) {
    // Only the plain `latin` range — not latin-ext, not vietnamese.
    const range = /unicode-range:\s*([^;]+);/.exec(b)?.[1] ?? '';
    const isLatin =
      range.includes('U+0000-00FF') && !range.includes('U+0100') && !range.includes('U+0102');
    if (!isLatin) continue;
    const url = /src:\s*url\(([^)]+)\)/.exec(b)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(b)?.[1] ?? '400';
    const style = /font-style:\s*(\w+)/.exec(b)?.[1] ?? 'normal';
    if (url) out.push({ url, weight, style });
  }
  return out;
}

async function fetchCss(family, weights, italic) {
  const axis = italic
    ? `ital,wght@${weights.map((w) => `0,${w}`).join(';')};${weights.map((w) => `1,${w}`).join(';')}`
    : `wght@${weights.join(';')}`;
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  ).replace(/%20/g, '+')}:${axis}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${family}: CSS ${res.status}`);
  const css = await res.text();
  if (!css.includes('.woff2')) {
    throw new Error(`${family}: got no woff2 — the User-Agent was not honoured`);
  }
  return css;
}

let total = 0;
let skipped = 0;
const manifest = [];

for (const fam of FAMILIES) {
  const css = await fetchCss(fam.css, fam.weights, fam.italic);
  const faces = parseLatinFaces(css);
  const expected = fam.weights.length * (fam.italic ? 2 : 1);
  if (faces.length !== expected) {
    throw new Error(
      `${fam.css}: expected ${expected} latin faces, parsed ${faces.length}. ` +
        `Refusing to write a partial family — a missing weight renders as a ` +
        `browser-synthesised fake, which looks almost right and is not.`,
    );
  }
  const dir = join(OUT, fam.dir);
  mkdirSync(dir, { recursive: true });
  for (const f of faces) {
    const name = `${fam.dir}-${f.weight}${f.style === 'italic' ? '-italic' : ''}.woff2`;
    const path = join(dir, name);
    if (existsSync(path)) {
      skipped++;
    } else {
      const res = await fetch(f.url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`${name}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`${name}: suspiciously small (${buf.length}B)`);
      writeFileSync(path, buf);
      total++;
    }
    manifest.push({ family: fam.css, dir: fam.dir, file: name, weight: f.weight, style: f.style });
  }
  console.log(`${fam.css.padEnd(24)} ${faces.length} face(s)`);
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\ndownloaded ${total} · already present ${skipped} · total ${manifest.length}`);
