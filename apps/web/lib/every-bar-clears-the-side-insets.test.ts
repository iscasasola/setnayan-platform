/**
 * every-bar-clears-the-side-insets.test.ts — EVERY BAR FIXED TO THE SCREEN KEEPS ITS CONTENT INSIDE THE LEFT AND
 * THE RIGHT SAFE AREA, EACH ON ITS OWN (iPhone Duo readiness, corpus `IPHONE_DUO_READINESS_2026-10-08.md` points
 * 5 · 21 · 22 · 23; Duo/iPad audit 2026-10-19 row W2).
 *
 * Measured before this guard: `env(safe-area-inset-left/right)` appeared in 2 places in the whole web app while
 * every page runs under the sensor (`viewportFit: 'cover'`, app/layout.tsx). Insets are often ASYMMETRIC — a Duo's
 * vertical system bar, a phone turned sideways, an app in Split View — and a custom web bar is never moved by the
 * system, so the bars' end buttons sat under the sensor housing and in the rounded corners.
 *
 * The property, read from the source (comments stripped), not from a list of files:
 *
 *   🧱 THE ONE RULE — app/globals.css defines `--sn-safe-l` / `--sn-safe-r` as exactly `env(safe-area-inset-*, 0px)`
 *      and pads every element carrying one of its attributes by them. Those elements carry NO side padding class of
 *      their own (the rule would silently replace it — which is the "never a bare env()" trap the audit named).
 *   📏 EVERY EDGE-HUGGING FIXED ELEMENT in app/ + lib/ — a full-width bar (`inset-x-0`, `left-0 right-0`), a card held
 *      off both edges (`inset-x-4`), a drawer or a corner button held to one side (`left-3`, `right-[14px]`) — either
 *      carries one of the rule's attributes or names the inset of every side it touches in place
 *      (`pl-[max(1rem,var(--sn-safe-l))]`, `right-[max(0.75rem,var(--sn-safe-r))]` …). A full-screen scrim
 *      (`inset-0`) is not a bar: what it holds is centred, or is the shared Sheet panel the rule covers.
 *   🎨 THE SAME FOR CSS — every `position: fixed` block in a stylesheet that is held to a side edge names that side's
 *      inset, or is selected by one of the rule's attributes.
 *
 * ⛔ Never weaken this to go green. A new bar fixes ITSELF: add `data-safe-x=""` (no side padding of its own) or name
 * both insets in its classes. The two exemptions below each say why the device cannot have a side inset.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Files that may hold an edge-hugging fixed element with no inset — each with the reason it cannot meet one. */
const EXEMPT: Record<string, string> = {
  'app/wall/[eventId]/_components/wall-projection.tsx':
    'the projector wall — drawn on a venue screen or a laptop fed to a projector, never a phone; no side inset exists there',
};
/** Dev labs mimic shipped screens for walks; they are never a guest's or a couple's page. */
const SKIP_DIR = /^app\/dev\//;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(rel, out);
    } else out.push(rel);
  }
  return out;
}
const SOURCES = [...walk('app'), ...walk('lib')].filter(
  (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.test-helper\.tsx?$/.test(f) && !SKIP_DIR.test(f),
);
const STYLES = [...walk('app'), ...walk('lib')].filter((f) => /\.css$/.test(f) && !SKIP_DIR.test(f));

// ── 🧱 the rule ────────────────────────────────────────────────────────────────────────────────────────────────
const CSS = stripComments(read('app/globals.css'));
function ruleAttrs(css: string): string[] {
  const m = css.match(
    /:is\(([^)]*)\)\s*\{\s*padding-left:\s*var\(--sn-safe-l\);\s*padding-right:\s*var\(--sn-safe-r\);\s*\}/,
  );
  if (!m) return [];
  return [...m[1]!.matchAll(/\[(data-[a-z-]+)\]/g)].map((x) => x[1]!);
}
const RULE_ATTRS = ruleAttrs(CSS);

test('🧱 the two inset names are exactly the device insets, and ONE rule pads the attributed bars by them', () => {
  assert.match(CSS, /:root\s*\{[^}]*--sn-safe-l:\s*env\(safe-area-inset-left,\s*0px\);/, '--sn-safe-l is not env(safe-area-inset-left, 0px)');
  assert.match(CSS, /:root\s*\{[^}]*--sn-safe-r:\s*env\(safe-area-inset-right,\s*0px\);/, '--sn-safe-r is not env(safe-area-inset-right, 0px)');
  for (const a of ['data-bottom-dock', 'data-maker-shell', 'data-sheet-panel', 'data-sticky-top', 'data-safe-x']) {
    assert.ok(RULE_ATTRS.includes(a), `the safe-area rule no longer covers [${a}] (covers: ${RULE_ATTRS.join(', ') || 'nothing'})`);
  }
  // Nothing anywhere may set the names to something else — a walk's shim lives in the walk, never in the app.
  for (const f of [...STYLES, ...SOURCES]) {
    const src = stripComments(read(f));
    const sets = [...src.matchAll(/--sn-safe-[lr]\s*:\s*([^;}\n]+)/g)].map((m) => m[1]!.trim());
    for (const v of sets) assert.match(v, /^env\(safe-area-inset-(left|right),\s*0px\)$/, `${f} redefines a side inset as "${v}"`);
  }
});

// ── a tiny JSX opening-tag scanner (strings and `{…}` aware) ──────────────────────────────────────────────────
function openingTags(src: string): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  const re = /<([A-Za-z][\w.]*)(?=[\s>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let q: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i]!;
      if (q) {
        if (c === '\\') i++;
        else if (c === q) q = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ at: m.index, text: src.slice(m.index, i + 1) });
  }
  return out;
}
/** Every string-constant VALUE by name (for `${SP_KEY_BAR_FIXED}` inside a className). */
const CONSTS = new Map<string, string[]>();
for (const f of SOURCES) {
  for (const m of stripComments(read(f)).matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*(?::\s*string\s*)?=\s*(['"`])((?:\\.|(?!\2).)*)\2/g)) {
    CONSTS.set(m[1]!, [...(CONSTS.get(m[1]!) ?? []), m[3]!]);
  }
}
const resolve = (text: string) =>
  // A bare `'fixed'` literal is a CSS value being compared (`position !== 'fixed'`), not a class.
  text.replace(/(['"])fixed\1/g, '') + ' ' + [...text.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)].flatMap((m) => CONSTS.get(m[1]!) ?? []).join(' ');

type Need = { l: boolean; r: boolean; why: string };
/** What sides an element touches, from its own class tokens — or null when it is not an edge-hugging fixed element. */
function needs(tokens: Set<string>): Need | null {
  const t = [...tokens];
  const fixed = t.some((x) => x === 'fixed' || /^max-[a-z0-9]+:fixed$/.test(x));
  if (!fixed || tokens.has('inset-0')) return null;
  const plain = (side: 'left' | 'right') =>
    t.some((x) => new RegExp(`^${side}-(\\d|px|\\[(?!.*var\\(--sn-safe-))`).test(x) && !new RegExp(`^${side}-1/2$`).test(x));
  if (tokens.has('inset-x-0') || (tokens.has('left-0') && tokens.has('right-0'))) return { l: true, r: true, why: 'full-width bar' };
  if (t.some((x) => /^inset-x-(?!0$|auto$)/.test(x))) return { l: true, r: true, why: 'card held off both edges' };
  const l = plain('left');
  const r = plain('right');
  if (l || r) return { l, r, why: l && r ? 'held to both edges' : l ? 'held to the left edge' : 'held to the right edge' };
  return null;
}
const tokensOf = (s: string) => new Set(s.split(/[\s"'`{}]+/).map((x) => x.replace(/^\$/, '')).filter(Boolean));

function uncoveredJsx(): string[] {
  const misses: string[] = [];
  for (const f of SOURCES) {
    if (EXEMPT[f]) continue;
    const src = stripComments(read(f));
    if (!/\bfixed\b/.test(src)) continue;
    const inTags: [number, number][] = [];
    for (const tag of openingTags(src)) {
      inTags.push([tag.at, tag.at + tag.text.length]);
      const full = resolve(tag.text);
      const need = needs(tokensOf(full));
      if (!need) continue;
      const ruled = RULE_ATTRS.some((a) => new RegExp(`\\s${a}(?=[\\s=>/])`).test(tag.text));
      const hasL = ruled || full.includes('--sn-safe-l');
      const hasR = ruled || full.includes('--sn-safe-r');
      if ((need.l && !hasL) || (need.r && !hasR)) {
        const line = src.slice(0, tag.at).split('\n').length;
        misses.push(`${f}:${line} (${need.why}) misses ${[need.l && !hasL ? '--sn-safe-l' : '', need.r && !hasR ? '--sn-safe-r' : ''].filter(Boolean).join(' + ')}`);
      }
    }
    // A class string kept in a constant (`const CORNER_ALONE = 'fixed right-3 …'`) answers for itself.
    for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      if (inTags.some(([a, b]) => m.index! >= a && m.index! < b)) continue;
      const need = needs(tokensOf(m[2]!));
      if (!need) continue;
      if ((need.l && !m[2]!.includes('--sn-safe-l')) || (need.r && !m[2]!.includes('--sn-safe-r'))) {
        misses.push(`${f}:${src.slice(0, m.index).split('\n').length} (${need.why}, a class string) misses a side inset`);
      }
    }
  }
  return misses;
}

test('📏 every edge-hugging fixed element carries the rule\'s attribute or names the inset of each side it touches', () => {
  const misses = uncoveredJsx();
  assert.deepEqual(misses, [], `a fixed bar sits under the sensor / in a rounded corner on an asymmetric inset:\n  ${misses.join('\n  ')}`);
});

test('🧱 an element the rule pads carries no side padding of its own (the rule would silently replace it)', () => {
  const bad: string[] = [];
  for (const f of SOURCES) {
    const src = stripComments(read(f));
    for (const tag of openingTags(src)) {
      if (!RULE_ATTRS.some((a) => new RegExp(`\\s${a}(?=[\\s=>/])`).test(tag.text))) continue;
      const own = [...tokensOf(resolve(tag.text))].filter((x) => /^(p|px|pl|pr|ps|pe)-/.test(x));
      if (own.length) bad.push(`${f}:${src.slice(0, tag.at).split('\n').length} has ${own.join(' ')}`);
    }
  }
  assert.deepEqual(bad, [], `move these gutters to an inner row, or drop the attribute and name the insets in place:\n  ${bad.join('\n  ')}`);
});

test('🎨 every stylesheet bar fixed to a side edge names that side\'s inset', () => {
  const misses: string[] = [];
  for (const f of STYLES) {
    const css = stripComments(read(f));
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [sel, body] = [m[1]!.trim(), m[2]!];
      if (!/position\s*:\s*fixed/.test(body) || /\binset\s*:\s*0\s*[;}]?/.test(body + ';')) continue;
      if (RULE_ATTRS.some((a) => sel.includes(`[${a}]`))) continue;
      const side = (s: 'left' | 'right') => {
        const v = body.match(new RegExp(`(?:^|[;\\s])${s}\\s*:\\s*([^;]+)`))?.[1]?.trim();
        return !!v && /^(0|[\d.]+(px|rem|em))$/.test(v);
      };
      const [l, r] = [side('left'), side('right')];
      if ((l && !body.includes('--sn-safe-l')) || (r && !body.includes('--sn-safe-r'))) {
        misses.push(`${relative(WEB, join(WEB, f))} "${sel.split('\n').pop()!.trim().slice(-80)}" misses ${[l && !body.includes('--sn-safe-l') ? '--sn-safe-l' : '', r && !body.includes('--sn-safe-r') ? '--sn-safe-r' : ''].filter(Boolean).join(' + ')}`);
      }
    }
  }
  assert.deepEqual(misses, [], `a stylesheet bar sits under a side safe area:\n  ${misses.join('\n  ')}`);
});

test('the scan can hit: it sees the shipped bars it is meant to hold', () => {
  // A guard that walks no files passes forever — prove it sees real bars on both paths.
  const seen = SOURCES.filter((f) => /\bfixed inset-x-0\b/.test(stripComments(read(f)))).length;
  assert.ok(seen >= 15, `only ${seen} files with a full-width fixed bar were read — the walk is broken`);
  assert.ok(needs(tokensOf('fixed inset-x-0 bottom-0 px-4')), 'a bare full-width bar must need both insets');
  assert.ok(needs(tokensOf('fixed right-3 top-3'))?.r, 'a corner button must need the right inset');
  assert.equal(needs(tokensOf('fixed inset-0 z-50')), null, 'a scrim is not a bar');
  assert.equal(needs(tokensOf('fixed left-1/2 top-3 -translate-x-1/2')), null, 'a centred chip touches no side');
});
