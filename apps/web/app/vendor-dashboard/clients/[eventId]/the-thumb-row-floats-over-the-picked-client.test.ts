/**
 * 🥞 A THUMB ROW INSIDE THE PICKED CLIENT FLOATS OVER IT — never under it (release blocker, 8 Nov 2026).
 *
 * MEASURED in the release check: Picked client › Schedule's "My times" and "+ My moment" could not be tapped.
 * `SupplierThumbRow` portalled to <body> at `--sn-z-thumb` (25) while the picked client (`picked-client-shell.tsx`)
 * sits on <body> at `--sn-z-pop` (40) — the row was drawn UNDER the screen it belongs to. Payment, Report, Forms and
 * Hub draw the same row.
 *
 * Held from the real sources (no number typed here — every layer is read from its token):
 *   1. the two layers: a row on <body> at the thumb layer WOULD be under the client — so the next rules are needed;
 *   2. the shell keeps a thumb host inside its own layer (after the page body, outside the sliding `#picked-page`) and
 *      hands it to every page body through `ThumbLayerContext`;
 *   3. the row portals into that host (never <body>) whenever it is inside such a layer, waits while the host mounts,
 *      and never moves up into the page's pinned row (behind the client);
 *   4. every file the picked client's pages reach that portals a fixed thing to <body> either floats at or above the
 *      client's layer, or is `SupplierThumbRow` (which takes the layer) — so a new row cannot slip in under it.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): drop `<ThumbLayerContext.Provider` from the shell (red: 2);
 * `layer?.host ?? document.body,` → `document.body,` in the row's band portal (red: 3); `const upTo = inSheet || layer ? …` →
 * `const upTo = inSheet ? …` (red: 3); a `createPortal(<div …/>, document.body)` at `z-sn-thumb` added to
 * `report-form.tsx` (red: 4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const CSS = read(join(WEB, 'app', 'globals.css'));
const SHELL = read(join(HERE, '..', '..', '..', '_components', 'picked', 'picked-shell.tsx') /* the ONE picked shell (Build 3 · Lane A) */);
const ROW_PATH = join(WEB, 'app', 'vendor-dashboard', '_components', 'supplier-thumb-row.tsx');
const ROW = read(ROW_PATH);
const SHEET = read(join(WEB, 'app', '_components', 'sheet.tsx'));
const ROW_CSS = read(join(WEB, 'app', 'vendor-dashboard', '_components', 'supplier-thumb-row.module.css'));

const Z: Record<string, number> = {};
for (const m of CSS.matchAll(/--sn-z-([a-z]+):\s*(-?\d+);/g)) if (!(m[1]! in Z)) Z[m[1]!] = Number(m[2]);

/** Every z a source sets, as numbers (Tailwind `z-30` / `z-[30]` / `z-sn-x` / `z-[var(--sn-z-x)]`, CSS, inline style). */
function zOf(src: string): number[] {
  const out: number[] = [];
  const token = (n: string) => {
    assert.ok(n in Z, `unknown z token --sn-z-${n}`);
    return Z[n]!;
  };
  for (const m of src.matchAll(/(?<![\w-])z-(\d+)(?![\w-])/g)) out.push(Number(m[1]));
  for (const m of src.matchAll(/(?<![\w-])z-\[(\d+)\]/g)) out.push(Number(m[1]));
  for (const m of src.matchAll(/(?<![\w-])z-sn-([a-z]+)/g)) out.push(token(m[1]!));
  for (const m of src.matchAll(/z-\[var\(--sn-z-([a-z]+)\)\]/g)) out.push(token(m[1]!));
  for (const m of src.matchAll(/z-?index:\s*(\d+)/gi)) out.push(Number(m[1]));
  for (const m of src.matchAll(/z-?index:\s*['"]?var\(--sn-z-([a-z]+)\)/gi)) out.push(token(m[1]!));
  return out;
}

test('1 · a row on <body> at the thumb layer would be UNDER the picked client', () => {
  assert.match(SHELL, /style=\{\{ zIndex: 'var\(--sn-z-pop\)' \}\}/, 'the picked client no longer sits on the pop layer — re-read the layers');
  assert.match(SHELL, /createPortal\(screen, host\)/, 'the picked client is no longer drawn on <body>');
  assert.match(ROW_CSS, /\.lower \{[^}]*z-index: var\(--sn-z-thumb\);/, 'the floating row is no longer on the thumb layer');
  assert.ok(Z.thumb! < Z.pop!, 'thumb is no longer under pop — this guard’s premise changed; re-read it');
});

test('2 · the shell keeps a thumb host inside its own layer and hands it to every page body', () => {
  const screen = SHELL.slice(SHELL.indexOf('const screen = ('), SHELL.indexOf('return host ? createPortal(screen, host)'));
  assert.ok(screen.length > 500, 'the shell’s `screen` tree moved — re-anchor this guard');
  assert.match(
    screen,
    /<ThumbLayerContext\.Provider value=\{thumbLayer\}>\{bodies\[page\]\}<\/ThumbLayerContext\.Provider>/,
    'the page bodies are not told which layer their thumb row floats in — it lands on <body>, under the client',
  );
  assert.match(SHELL, /useMemo<ThumbLayer>\(\(\) => \(\{ host: thumbHost, column: thumbColumn \}\)/);
  const host = screen.indexOf('<div ref={setThumbHost}');
  assert.ok(host > 0, 'the thumb host is not inside the picked client’s screen');
  // After the page body (so it paints over it) and outside the sliding `#picked-page` (a transform would carry a
  // `position: fixed` row along with the page).
  const page = screen.indexOf('id="picked-page"');
  const pageEnd = screen.indexOf('</div>', screen.indexOf('</ThumbLayerContext.Provider>'));
  assert.ok(page > 0 && pageEnd > page && host > pageEnd, 'the thumb host is inside the sliding page, or before the body');
  assert.match(SHELL, /ref=\{setThumbColumn\}[^>]*data-picked-pin=""/, 'the row’s column is not the (unmoving) pinned row');
});

test('3 · inside a layer the row portals into the layer’s host — never <body> under it, never up into the pinned row', () => {
  assert.match(ROW, /const layer = useContext\(ThumbLayerContext\);/);
  assert.match(ROW, /const upTo = inSheet \|\| layer \? null : pinTools;/, 'inside the client the row would move up into the page’s pinned row, behind it');
  assert.match(ROW, /if \(!inSheet && layer && !layer\.host\) return null;/, 'while the host mounts the row lands on <body> under the client');
  const outer = ROW.slice(ROW.indexOf('export function SupplierThumbRow('), ROW.indexOf('function ThumbFit('));
  assert.deepEqual([...outer.matchAll(/createPortal\(\s*\w+,\s*document\.body/g)].map((m) => m[0]), [], 'a row is portalled straight to <body>');
  assert.equal(
    [...outer.matchAll(/createPortal\(\s*(\w+),\s*layer\?\.host \?\? document\.body,?\s*\)/g)].length,
    2,
    'expected the row’s two floating portals (band · glass), each onto the layer’s host when inside one',
  );
});

/** `@/x` and `./x` → a file on disk. */
function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext;
  return null;
}

/** The file that defines component `name` as `file` imports it — statically or through `import('…')` — one re-export deep. */
function sourceOf(file: string, src: string, name: string, depth = 0): string | null {
  const spec =
    new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from '([^']+)'`).exec(src)?.[1] ??
    new RegExp(`const ${name}\\s*=\\s*\\w+\\(\\s*\\(\\)\\s*=>\\s*import\\(\\s*(?:\\/\\*[^*]*\\*\\/\\s*)?'([^']+)'\\)`).exec(src)?.[1] ??
    (depth ? new RegExp(`export \\{[^}]*\\b${name}\\b[^}]*\\} from '([^']+)'`).exec(src)?.[1] : undefined);
  const dep = spec ? resolve(file, spec) : null;
  if (!dep) return null;
  const depSrc = read(dep);
  if (depth < 2 && !new RegExp(`export (?:function|const) ${name}\\b`).test(depSrc)) return sourceOf(dep, depSrc, name, depth + 1) ?? dep;
  return dep;
}

test('4 · every <body> portal the picked client’s pages reach floats over the client, or is the row that takes the layer', () => {
  const starts = readdirSync(join(HERE, '_pages'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(HERE, '_pages', f));
  starts.push(join(HERE, '_components', 'supplier-schedule.tsx'));
  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = read(f);
    // Static imports AND `import('…')` — a part loaded on demand (`_pages/lazy.tsx`, the thread's and Hub's `on-demand.tsx`)
    // still draws inside the picked client.
    for (const m of src.matchAll(/(?:(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?from\s+)?|\bimport\(\s*(?:\/\*[^*]*\*\/\s*)?)'([^']+)'/g)) {
      const dep = resolve(f, m[1]!);
      if (dep) stack.push(dep);
    }
  }
  const under: string[] = [];
  let rows = 0;
  for (const f of seen) {
    if (f === ROW_PATH) continue;
    const src = read(f);
    if (/<SupplierThumbRow\b/.test(src)) rows++;
    if (!/createPortal\([\s\S]*?document\.body/.test(src)) continue;
    // What it portals floats where its own layer says — or where the shared Sheet does (it portals a `<Sheet>`), or in
    // the browser's top layer (a native `<dialog>` opened with `showModal()`, over every z-index).
    const zs = zOf(src);
    if (/\bshowModal\(\)/.test(src)) zs.push(Number.POSITIVE_INFINITY);
    // …or where the component it portals floats (`createPortal(<FrameStep …/>, document.body)` → FrameStep's own file).
    for (const m of src.matchAll(/createPortal\(\s*<(\w+)/g)) zs.push(...zOf(read(sourceOf(f, src, m[1]!) ?? f)));
    if (/import \{[^}]*\bSheet\b[^}]*\} from '@\/app\/_components\/sheet'/.test(src) && /<Sheet\b/.test(src)) zs.push(...zOf(SHEET));
    if (!zs.length || Math.max(...zs) < Z.pop!) under.push(`${relative(WEB, f)} (z ${zs.length ? Math.max(...zs) : 'none'})`);
  }
  assert.ok(seen.size > 60, `the walk reached only ${seen.size} files — it has gone blind`);
  assert.ok(seen.has(ROW_PATH), 'the picked client’s pages no longer reach SupplierThumbRow — re-anchor this guard');
  assert.ok(rows >= 4, `only ${rows} page files draw a SupplierThumbRow — the walk has gone blind`);
  assert.deepEqual(under, [], `these portal to <body> UNDER the picked client (use SupplierThumbRow, or a layer ≥ --sn-z-pop):\n${under.join('\n')}`);
});
