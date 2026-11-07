/**
 * the-layers-are-ruled.test.ts — 🥞 PAGE < THUMB ROW < BOTTOM NAV < POP-UPS (THE ONE BUILD spec §10 #23, 8 Nov 2026).
 *
 * Owner, verbatim: *"bottom nav should be above thumb row. and pop ups should be above thumb row in layers."* — then, on
 * a mock that moved the thumb row below the bar: *"this is wrong"*. So the POSITIONS stay (the thumb row stands just
 * above the bottom bar) and only the LAYER ORDER is ruled: whenever the thumb row and the bar touch (while the chrome
 * slides away) the bar paints on top, and every pop-up, menu, popover and sheet paints over the thumb row.
 *
 * Held from the real sources:
 *   1. the scale tokens: `--sn-z-thumb` (25) < `--sn-z-nav` (30) < `--sn-z-pop` (40) ≤ `--sn-z-modal` (50, the Sheet);
 *   2. no thumb-row file (one that draws a ThumbRow/ThumbDock/AccountThumbRow/SupplierThumbRow, or is one) sets a z
 *      above the thumb layer — so never at or over the bar;
 *   3. the bottom dock stands on the nav layer;
 *   4. every pop-up a thumb-row file opens (an imported …Menu / …Sheet / …Popover / …Dialog / …Popup, or `Sheet` /
 *      `PickMenu`) floats at or above the pop layer — over the bar, so over the thumb row.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): `z-sn-thumb` → `z-[35]` in account-thumb-row.tsx (red: test 2);
 * PickMenu's list `z-[95]` → `z-20` (red: test 4); `--sn-z-thumb: 25` → `35` (red: test 1).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(p, 'utf8');
const CSS = read(join(WEB, 'app', 'globals.css'));

const Z: Record<string, number> = {};
for (const m of CSS.matchAll(/--sn-z-([a-z]+):\s*(-?\d+);/g)) if (!(m[1]! in Z)) Z[m[1]!] = Number(m[2]);

/** Every z a source sets, as numbers: Tailwind `z-30` / `z-[30]` / `z-sn-nav` / `z-[var(--sn-z-nav)]`, CSS `z-index`. */
function zOf(src: string): number[] {
  const out: number[] = [];
  const token = (name: string) => {
    assert.ok(name in Z, `unknown z token --sn-z-${name}`);
    return Z[name]!;
  };
  for (const m of src.matchAll(/(?<![\w-])-?z-(\d+)(?![\w-])/g)) out.push(Number(m[1]) * (m[0].startsWith('-') ? -1 : 1));
  for (const m of src.matchAll(/(?<![\w-])z-\[(-?\d+)\]/g)) out.push(Number(m[1]));
  for (const m of src.matchAll(/(?<![\w-])z-sn-([a-z]+)/g)) out.push(token(m[1]!));
  for (const m of src.matchAll(/z-\[var\(--sn-z-([a-z]+)\)\]/g)) out.push(token(m[1]!));
  for (const m of src.matchAll(/z-index:\s*(-?\d+)/g)) out.push(Number(m[1]));
  for (const m of src.matchAll(/z-index:\s*var\(--sn-z-([a-z]+)\)/g)) out.push(token(m[1]!));
  for (const m of src.matchAll(/zIndex:\s*(-?\d+)/g)) out.push(Number(m[1]));
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|module\.css)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const ROW_PART = /\b(ThumbRow|ThumbDock|AccountThumbRow|SupplierThumbRow)\b/;
const FILES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'components'))];
const THUMB_FILES = FILES.filter((f) => /thumb-(row|dock)/.test(f) || (f.endsWith('.tsx') && ROW_PART.test(stripComments(read(f)))));

/** `@/x` and `./x` → a file on disk. */
function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ['.tsx', '.ts', '/index.tsx']) if (existsSync(base + ext)) return base + ext;
  return null;
}

test('the scale: thumb row < bottom nav < pop-ups ≤ sheets', () => {
  assert.equal(Z.thumb, 25, 'the thumb layer is not the shipped 25');
  assert.equal(Z.nav, 30);
  assert.ok(Z.thumb! < Z.nav!, 'the thumb row is not under the bottom nav');
  assert.ok(Z.nav! < Z.pop!, 'pop-ups are not over the bottom nav');
  assert.ok(Z.pop! <= Z.modal!, 'a sheet sits under a pop-up layer');
  assert.match(read(join(WEB, 'tailwind.config.ts')), /'sn-thumb': 'var\(--sn-z-thumb\)'/);
});

test('no thumb-row file sets a z at or above the bottom nav', () => {
  assert.ok(THUMB_FILES.length >= 8, `the scan found only ${THUMB_FILES.length} thumb-row files — it has gone blind`);
  const over: string[] = [];
  for (const f of THUMB_FILES) {
    for (const z of zOf(stripComments(read(f)))) if (z > Z.thumb!) over.push(`${relative(WEB, f)}: z ${z}`);
  }
  assert.deepEqual(over, [], `a thumb row paints at or over the bar — use z-sn-thumb / var(--sn-z-thumb):\n${over.join('\n')}`);
});

test('the bottom dock stands on the nav layer', () => {
  const nav = stripComments(read(join(WEB, 'app', '_components', 'nav', 'bottom-nav.tsx')));
  const dock = nav.slice(nav.indexOf('data-bottom-dock'), nav.indexOf('</BottomDockContext.Provider>'));
  assert.equal((dock.match(/z-sn-nav/g) ?? []).length, 2, 'the dock (both boundaries) is not on the nav layer');
});

test('every pop-up a thumb row opens floats at or above the pop layer — over the bar and the row', () => {
  const POPUP = /^(\w*(Menu|Sheet|Popover|Dialog|Popup))$/;
  const checked = new Map<string, number>();
  const under: string[] = [];
  const topZ = (file: string, depth = 0): number => {
    const src = stripComments(read(file));
    const own = zOf(src);
    let max = own.length ? Math.max(...own) : Number.NEGATIVE_INFINITY;
    // A pop-up built ON the shared Sheet / PickMenu floats where they do.
    if (depth < 2) {
      for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
        if (/^import\s+type/.test(m[0])) continue;
        const names = m[1]!.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]!);
        if (!names.some((n) => /^(Sheet|PickMenu)$/.test(n))) continue;
        const dep = resolve(file, m[2]!);
        if (dep) max = Math.max(max, topZ(dep, depth + 1));
      }
    }
    return max;
  };
  for (const f of THUMB_FILES.filter((x) => x.endsWith('.tsx'))) {
    const src = stripComments(read(f));
    for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
      if (/^import\s+type/.test(m[0])) continue;
      const names = m[1]!.split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!).filter((n) => POPUP.test(n));
      if (!names.length) continue;
      const dep = resolve(f, m[2]!);
      if (!dep) continue;
      if (!checked.has(dep)) checked.set(dep, topZ(dep));
      const z = checked.get(dep)!;
      if (!(z >= Z.pop!)) under.push(`${relative(WEB, f)} opens ${names.join(', ')} (${relative(WEB, dep)}) at z ${z}`);
    }
  }
  assert.ok(checked.size >= 2, `only ${checked.size} pop-up sources found from the thumb rows — the scan has gone blind`);
  // eslint-disable-next-line no-console
  console.log(`pop-ups opened from thumb rows: ${[...checked].map(([f, z]) => `${relative(WEB, f)}@${z}`).join(' · ')}`);
  assert.deepEqual(under, [], `a pop-up opened from a thumb row paints under the bar/row:\n${under.join('\n')}`);
});
