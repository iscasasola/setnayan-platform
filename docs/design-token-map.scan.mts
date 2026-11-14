// Design-value inventory scanner (Phase 1, read-only). Usage: tsx scan.ts <apps/web root> <out.json>
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.argv[2];
const OUT = process.argv[3];
const { stripComments } = await import(join(ROOT, 'lib/strip-comments.ts'));

const SCAN = ['app', 'components', 'lib'];
const SKIP_DIR = /(^|\/)(node_modules|\.next)(\/|$)/;
const TEST = /\.(test|spec|harness|db\.test)\.tsx?$|\/tests?\//;

type Hit = { file: string; line: number; text: string };
const files: string[] = [];
function walk(d: string) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    const r = relative(ROOT, p);
    if (SKIP_DIR.test(r)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx|ts|css)$/.test(n) && !n.endsWith('.d.ts')) files.push(p);
  }
}
for (const s of SCAN) walk(join(ROOT, s));

function area(r: string): string {
  if (/^app\/dev\//.test(r)) return 'dev-lab';
  if (TEST.test(r)) return 'test';
  if (/^app\/\[slug\]\//.test(r)) return 'event-hub';
  if (/^app\/(v|u)\/\[/.test(r)) return 'public';
  if (/^app\/dashboard\//.test(r)) return 'couple';
  if (/^app\/vendor-dashboard\//.test(r)) return 'supplier';
  if (/^app\/admin\//.test(r)) return 'admin';
  if (/^app\/globals\.css$/.test(r)) return 'globals.css';
  if (/^app\/(api|opengraph|.*\/opengraph-image|.*\/icon)/.test(r) || /opengraph-image|twitter-image|\/icon\.tsx|apple-icon/.test(r)) return 'image-render';
  if (/\/(emails?|email-templates?)\//.test(r) || /email/.test(r.split('/').pop()!)) return 'email';
  if (/print|pdf/i.test(r)) return 'print-pdf';
  if (/^components\//.test(r) || /^app\/_components\//.test(r)) return 'shared';
  if (/^lib\//.test(r)) return 'lib';
  return 'public';
}

const PAL = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PFX = 'bg|text|border|border-[trblxy]|ring|ring-offset|from|to|via|fill|stroke|outline|divide|placeholder|decoration|accent|caret|shadow';
const re = {
  hex: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
  fn: /\b(?:rgba?|hsla?)\(\s*\d[^)]*\)/g,
  twArbColor: new RegExp(`\\b(?:${PFX})-\\[(?:#|rgb|rgba|hsl|color-mix|var\\(--)[^\\]]*\\]`, 'g'),
  twPalette: new RegExp(`\\b(?:${PFX})-(?:${PAL})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`, 'g'),
  twWhiteBlack: new RegExp(`\\b(?:${PFX})-(?:white|black)\\b`, 'g'),
  twRadiusArb: /\brounded(?:-[trblse]{1,2})?-\[[^\]]+\]/g,
  twRadius: /\brounded(?:-[trblse]{1,2})?(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|tile|card))?\b/g,
  twShadowArb: /\bshadow-\[[^\]]+\]/g,
  twShadow: /\bshadow(?:-(?:sm|md|lg|xl|2xl|inner|none|sn-[a-z]+|m-[a-z]+))?\b(?!-)/g,
  twSpaceArb: /\b-?(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y|w|h|min-w|min-h|max-w|max-h|top|bottom|left|right|inset|inset-x|inset-y|size)-\[[^\]]+\]/g,
  twTextArb: /\btext-\[\d[^\]]*\]/g,
  twLeadingArb: /\bleading-\[[^\]]+\]/g,
  twBorderWArb: /\bborder(?:-[trblxy])?-\[\d[^\]]*px\]/g,
  cssRadius: /border-radius\s*:\s*([^;}\n]+)/g,
  cssShadow: /box-shadow\s*:\s*([^;}\n]+)/g,
  cssFont: /font-size\s*:\s*([^;}\n]+)/g,
  cssSpace: /\b(padding|margin|gap|row-gap|column-gap)(?:-(?:top|bottom|left|right|inline|block))?\s*:\s*([^;}\n]+)/g,
  cssBorderW: /\bborder(?:-(?:top|bottom|left|right))?(?:-width)?\s*:\s*(\d+(?:\.\d+)?px)/g,
  inlineRadius: /borderRadius\s*:\s*['"`]?([^,'"`}\n]+)/g,
  inlineShadow: /boxShadow\s*:\s*['"`]([^'"`]+)/g,
  inlineFont: /fontSize\s*:\s*['"`]?([^,'"`}\n]+)/g,
  inlineSpace: /\b(padding|margin|gap)(?:Top|Bottom|Left|Right|Inline|Block)?\s*:\s*['"`]?([^,'"`}\n]+)/g,
};

const out: Record<string, Record<string, { n: number; areas: Record<string, number>; ex: string[] }>> = {};
function add(kind: string, key: string, file: string, line: number, a: string) {
  const k = (out[kind] ??= {});
  const e = (k[key] ??= { n: 0, areas: {}, ex: [] });
  e.n++;
  e.areas[a] = (e.areas[a] ?? 0) + 1;
  if (e.ex.length < 3 && !e.ex.some((x) => x.startsWith(file + ':'))) e.ex.push(`${file}:${line}`);
}

// buttons + frames: className strings
const classAttr = /className=\{?\s*(?:cn\(|clsx\()?\s*["'`]([^"'`]+)["'`]/g;
const BTN_TAG = /<(button|Link|a)\b[^>]*$/;
const shapeKeys = (cls: string) =>
  cls
    .split(/\s+/)
    .filter((c) => /^(bg-|text-(?!xs|sm|base|lg|xl|\d|left|right|center|\[)|border|rounded|h-|min-h-|px-|py-|shadow|font-(semibold|bold|medium))/.test(c) && !/^(hover|focus|active|disabled|dark|group|md|lg|sm):/.test(c))
    .sort()
    .join(' ');

let cssDefs = 0;
for (const f of files) {
  const r = relative(ROOT, f);
  const a = area(r);
  let src = readFileSync(f, 'utf8');
  try { src = stripComments(src); } catch { /* css or odd file: keep */ }
  if (f.endsWith('.css')) src = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = src.split('\n');
  lines.forEach((L, i) => {
    const ln = i + 1;
    const isDef = /^\s*--[\w-]+\s*:/.test(L); // custom-property definition line
    for (const [kind, rx] of Object.entries(re)) {
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(L))) {
        if (kind === 'hex' && /&#|url\(|href|%23/.test(L.slice(Math.max(0, m.index - 6), m.index))) continue;
        if (kind === 'hex' && !/^#[0-9a-fA-F]+$/.test(m[0])) continue;
        const key = kind === 'hex' ? normHex(m[0]) : (m[2] ?? m[1] ?? m[0]).trim();
        add(isDef ? `${kind}@def` : kind, key, r, ln, a);
        if (isDef) cssDefs++;
      }
    }
  });
  if (f.endsWith('.tsx')) {
    classAttr.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = classAttr.exec(src))) {
      const before = src.slice(Math.max(0, m.index - 400), m.index);
      const ln = src.slice(0, m.index).split('\n').length;
      const cls = m[1];
      const lastTag = before.lastIndexOf('<');
      const tagChunk = before.slice(lastTag);
      if (BTN_TAG.test(tagChunk) && /\b(rounded|bg-|border|px-)/.test(cls)) add('button-look', shapeKeys(cls) || '(none)', r, ln, a);
      else if (/\brounded/.test(cls) && /(\bborder\b|\bbg-|\bshadow)/.test(cls)) add('frame-look', shapeKeys(cls) + ' | ' + (cls.match(/\b(?:p|px|py)-\S+/g) ?? []).join(' '), r, ln, a);
    }
    for (const comp of ['ActionButton', 'IconButton', 'PillButton', 'Sheet', 'SidePanel', 'Section', 'Readout']) {
      const n = (src.match(new RegExp(`<${comp}\\b`, 'g')) ?? []).length;
      if (n) for (let k = 0; k < n; k++) add('component', comp, r, 0, a);
    }
    const tones = src.match(/<ActionButton\b[^>]*?tone=["'](\w+)["'][^>]*?(main)?/g) ?? [];
    for (const t of tones) add('action-tone', (t.match(/tone=["'](\w+)/)![1]) + (/\bmain\b/.test(t) ? ' main' : ''), r, 0, a);
    for (const c of ['button-primary', 'button-secondary', 'btn', 'btn-secondary', 'btn-ghost', 'ab', 'sn-pill', 'sn-chip', 'sn-tile', 'sn-tile-glass', 'sn-row', 'sn-card', 'sn-glass', 'sn-glass-bare', 'home-card', 'home-tile', 'app-sheet', 'sn-press'])
      for (const _ of src.matchAll(new RegExp(`[\\s"'\`]${c.replace(/-/g, '\\-')}(?=[\\s"'\`])`, 'g'))) add('css-class-use', c, r, 0, a);
  }
}
function normHex(h: string) {
  let x = h.slice(1).toLowerCase();
  if (x.length === 3 || x.length === 4) x = x.split('').map((c) => c + c).join('');
  return '#' + x;
}
writeFileSync(OUT, JSON.stringify(out));
const sum = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { distinct: Object.keys(v).length, uses: Object.values(v).reduce((s, e) => s + e.n, 0) }]));
console.log(files.length, 'files'); console.table(sum);
