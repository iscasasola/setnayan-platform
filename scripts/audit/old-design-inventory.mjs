#!/usr/bin/env node
/**
 * old-design-inventory.mjs: READ-ONLY. Scores every page under apps/web/app against the house design rules
 * by static signals, so the old-design inventory can be re-measured instead of re-guessed.
 *
 *     node scripts/audit/old-design-inventory.mjs --json <out.json>     # every page, every signal
 *     node scripts/audit/old-design-inventory.mjs --summary             # counts by area and verdict
 *
 * It writes nothing in the repo and imports no app code. The doc it feeds is
 * build-sessions/OLD-DESIGN-INVENTORY-2026-11-24.md; the method is written there in "How this was measured".
 *
 * ── WHAT A PAGE IS ───────────────────────────────────────────────────────────────────────────────────────────
 * Every `page.tsx` under apps/web/app, minus `app/dev/**` (labs, `page.lab.tsx`) and intercepting routes `(.)x`
 * (a second view of a page, not a page). Its route, area and doors come from the generated Ugat screens map
 * (apps/web/lib/ugat/screens.generated.json).
 *
 * ── WHAT A PAGE DRAWS (its scope) ────────────────────────────────────────────────────────────────────────────
 * The page file, its loading.tsx, the other source files in its folder, every private folder (`_x`) under it,
 * the private folders of its group-less twin (a page that moved into `(shell)`/`(hub)` left its sections
 * behind), and every file under app/ it imports, transitively, EXCEPT the house's shared pieces
 * (`app/_components/**`, `components/**`, `lib/**`). Those are "fix once" pieces, scored separately.
 * CSS files the scope imports are scored too (not globals.css).
 *
 * ── SIGNALS ──────────────────────────────────────────────────────────────────────────────────────────────────
 * Comments are removed first with the repo's one lexer (`apps/web/scripts/port-controls.mjs` stripComments),
 * so prose about a banned construct is not counted as the construct. Ratchet baselines the repo already keeps
 * are read as-is (design-rules, no-card, field-template, motion-raw, page-masthead, label-contrast-dark,
 * template-score); the rest are counted here with the patterns below. Every count is a CANDIDATE: a builder
 * opens the line before changing it.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = join(ROOT, 'apps', 'web');
const APP = join(WEB, 'app');
const { stripComments } = await import(join(WEB, 'scripts', 'port-controls.mjs'));

const rel = (p) => relative(WEB, p).split(sep).join('/');
const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const ls = (d) => {
  try {
    return readdirSync(d).sort();
  } catch {
    return [];
  }
};
const SOURCE = /\.(tsx|ts|css)$/;
const NOT_SOURCE = /\.(test|spec|lab)\.tsx?$|\.d\.ts$|\.golden\./;

/* ── the pages ─────────────────────────────────────────────────────────────────────────────────────────── */
function walkPages(dir, out = []) {
  for (const n of ls(dir)) {
    const p = join(dir, n);
    if (isDir(p)) {
      if (n === 'node_modules' || n === '.next') continue;
      if (p === join(APP, 'dev')) continue;
      walkPages(p, out);
    } else if (n === 'page.tsx') out.push(p);
  }
  return out;
}
function routeOf(file) {
  const parts = relative(APP, dirname(file)).split(sep).filter((x) => x && x !== '.');
  if (parts.some((x) => /^\(\.+\)/.test(x))) return null;
  // A parallel-route slot (`@rise/page.tsx`) is part of its layout, not a page of its own.
  if (parts.some((x) => x.startsWith('@'))) return null;
  const kept = parts.filter((x) => !(x.startsWith('(') && x.endsWith(')')) && !x.startsWith('@'));
  return kept.length ? `/${kept.join('/')}` : '/';
}

/* ── source cache ──────────────────────────────────────────────────────────────────────────────────────── */
const srcCache = new Map();
function src(abs) {
  let s = srcCache.get(abs);
  if (s === undefined) {
    const raw = readFileSync(abs, 'utf8');
    s = abs.endsWith('.css') ? raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')) : stripComments(raw);
    srcCache.set(abs, s);
  }
  return s;
}
const rawLines = (abs) => readFileSync(abs, 'utf8').split('\n').length;

/* ── import resolution (app/ only; the shared house pieces are not followed) ───────────────────────────────── */
const SHARED = (abs) => {
  const r = rel(abs);
  // components/ and lib/ are the house primitives. app/_components/ is followed like any app/ file: a piece only
  // one or two pages draw (the front door's sections) counts for those pages; a piece many pages draw is shared.
  return r.startsWith('components/') || r.startsWith('lib/') || r === 'app/globals.css';
};
function resolveImport(fromAbs, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromAbs), spec);
  else return null;
  const tries = [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')];
  for (const t of tries) if (existsSync(t) && !isDir(t)) return t;
  return null;
}
const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
function importsOf(abs) {
  if (abs.endsWith('.css')) return [];
  const out = [];
  for (const m of src(abs).matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    if (!spec) continue;
    if (/^import\s+type\b/.test(m[0])) continue;
    const r = resolveImport(abs, spec);
    if (r && SOURCE.test(r) && !NOT_SOURCE.test(r)) out.push(r);
  }
  return out;
}

/* ── a page's scope ────────────────────────────────────────────────────────────────────────────────────── */
function ownFiles(pageAbs) {
  const dir = dirname(pageAbs);
  const out = new Set([pageAbs]);
  const take = (d, deep) => {
    for (const n of ls(d)) {
      const p = join(d, n);
      if (isDir(p)) {
        if (n.startsWith('_') || deep) take(p, true);
      } else if (SOURCE.test(n) && !NOT_SOURCE.test(n) && n !== 'layout.tsx' && n !== 'route.ts' && n !== 'page.tsx') out.add(p);
    }
  };
  take(dir, false);
  // A page that moved into a route group left its sections behind in the group-less twin folder.
  const twin = dir
    .split(sep)
    .filter((seg) => !/^\(.+\)$/.test(seg))
    .join(sep);
  // Never at the app root, where the same folder names mean "shared by the whole product" (port-controls.mjs).
  if (twin !== dir && twin !== APP && isDir(twin) && !existsSync(join(twin, 'page.tsx'))) take(twin, false);
  // Home moved into (hub) and its components stayed in dashboard/(launcher)/_components (template-score.ts).
  if (rel(dir) === 'app/(hub)/dashboard') take(join(APP, 'dashboard', '(launcher)', '_components'), true);
  return out;
}
function scopeOf(pageAbs) {
  const own = ownFiles(pageAbs);
  const deps = new Set();
  const shared = new Set();
  // Follow only what DRAWS: imports out of a .tsx file into a .tsx or .css file under app/, at most 4 hops.
  let frontier = [...own].filter((f) => f.endsWith('.tsx'));
  for (let hop = 0; hop < 4 && frontier.length; hop++) {
    const next = [];
    for (const f of frontier) {
      for (const imp of importsOf(f)) {
        if (SHARED(imp)) {
          shared.add(imp);
          continue;
        }
        const r = rel(imp);
        if (!r.startsWith('app/') || r.startsWith('app/dev/')) continue;
        if (!/\.(tsx|css)$/.test(imp)) continue;
        if (own.has(imp) || deps.has(imp)) continue;
        deps.add(imp);
        if (imp.endsWith('.tsx')) next.push(imp);
      }
    }
    frontier = next;
  }
  return { own, deps, shared };
}

/* ── the repo's own ratchet baselines ─────────────────────────────────────────────────────────────────── */
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const designRules = readJson(join(WEB, 'lib', 'design-rules.baseline.json'));
const motionRaw = readJson(join(ROOT, 'scripts', 'motion-raw.baseline.json'));
const masthead = new Set(readJson(join(WEB, 'scripts', 'page-masthead-baseline.json')));
const labelDark = readJson(join(WEB, 'scripts', 'label-contrast-dark.baseline.json')).pairs ?? {};
const templateScore = readJson(join(WEB, 'lib', 'template-score.baseline.json'));
const countLines = (p) => {
  const m = new Map();
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const x = /^(\d+)\s+apps\/web\/(\S+)$/.exec(line.trim());
    if (x) m.set(x[2], Number(x[1]));
  }
  return m;
};
const noCard = countLines(join(WEB, 'scripts', 'no-card.baseline.txt'));
const fieldTpl = countLines(join(WEB, 'scripts', 'field-template.baseline.txt'));
const labelDarkByFile = new Map();
for (const [k, n] of Object.entries(labelDark)) {
  const f = k.split(' · ')[0];
  labelDarkByFile.set(f, (labelDarkByFile.get(f) ?? 0) + n);
}
const sumOf = (o) => (o ? Object.values(o).reduce((a, n) => a + (typeof n === 'number' ? n : 0), 0) : 0);
const drFor = (r, k) => {
  const v = designRules[k]?.[r];
  return typeof v === 'number' ? v : 0;
};

/* ── the Part I audit (23 Nov): icon tiles, equal KPI rows, filler copy, by file ───────────────────────────── */
const partI = { tiles: new Map(), kpi: new Map(), filler: new Map() };
{
  const p = join(ROOT, 'audits', 'part-i-2026-11-23.md');
  if (existsSync(p)) {
    let rule = null;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (/^#{2,4} .*Rule 2/i.test(line)) rule = 'tiles';
      else if (/^#{2,4} .*Rule 3/i.test(line)) rule = 'kpi';
      else if (/^#{2,4} .*Rule 5/i.test(line)) rule = 'filler';
      else if (/^#{1,4} /.test(line)) rule = null;
      if (!rule || !line.startsWith('|')) continue;
      const m = /`(app\/[^`:]+?\.(?:tsx|ts|css))(?::\d+)?/.exec(line);
      if (m) partI[rule].set(m[1], (partI[rule].get(m[1]) ?? 0) + 1);
    }
  }
}

/* ── the patterns ─────────────────────────────────────────────────────────────────────────────────────── */
const P = {
  // Law 4 / B3: colour by job, never a value
  hex: /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/g,
  hex3css: /(?<![\w&])#[0-9a-fA-F]{3}\b/g,
  rgbLit: /\b(?:rgba?|hsla?)\(\s*\d/g,
  palette:
    /\b(?:text|bg|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent|decoration|placeholder)-(?:red|amber|emerald|green|yellow|blue|gray|grey|slate|zinc|neutral|stone|orange|rose|pink|purple|violet|indigo|sky|teal|lime|cyan|fuchsia)-\d{2,3}\b/g,
  // B4 / K2: white or black surfaces never flip in dark
  whiteBlack: /\b(?:bg|text|border|from|to|via|fill|stroke|ring|divide)-(?:white|black)\b/g,
  darkPrefix: /\bdark:/g,
  // B5: the type scale
  textPx: /\btext-\[\d+(?:\.\d+)?(?:px|rem)\]/g,
  halfPx: /\btext-\[\d+\.\d+px\]/g,
  styleFont: /fontSize:\s*['"`]?\d/g,
  // B6: the radius scale
  roundedRaw: /\brounded(?:-[a-z]{1,2})?-\[[^\]]+\]/g,
  legacyRadius: /\brounded-(?:card|tile)\b|--sn-r-(?:sm|md|lg)\b/g,
  // Part I rule 1: no decorative gradients
  gradient: /\bbg-gradient-to-[a-z]+\b|\b(?:linear|radial|conic)-gradient\(/g,
  // H3: never a coloured side stripe
  stripe: /\bborder-(?:l|s)-(?:[2-8]|\[\d)|\bborderLeft(?:Width|Color)?\s*:|\bborderInlineStart(?:Width|Color)?\s*:/g,
  stripeCss: /\bborder-(?:left|inline-start)(?:-width)?\s*:\s*(?:[2-9]|\d{2})px/g,
  // D2 / K1: one button primitive, one main button per scope
  legacyBtn: /\b(?:button-primary|button-secondary|btn-primary|btn-secondary|btn-ghost)\b|className=["'`]btn\b|["'`\s]btn["'`\s]/g,
  handBtn:
    /<button\b[^>]*className=["'`][^"'`]*(?:\bbg-mulberry\b|\bbg-terracotta\b|\bbg-ink\b|rounded-full[^"'`]*\bbg-(?:mulberry|terracotta|ink|ok|danger|info))/g,
  // D2 / D3: one input primitive, buttons inside the box
  legacyInput: /\bsn-input\b|\bshopInputClass\b/g,
  select: /<select\b/g,
  // F1: Ghost skeletons, no spinners, no pulse
  spinner: /\banimate-spin\b|\bLoader2\b|<Spinner\b/g,
  pulse: /\banimate-pulse\b/g,
  // D3: no confirm dialogs
  confirm: /(?<![\w.])(?:window\.)?confirm\(/g,
  // K3: one shared backdrop, nothing hand-made on top
  ariaModal: /aria-modal/g,
  // E2: transform and opacity only
  transitionAll: /\btransition-all\b|transition:\s*all\b/g,
  // Inline styles (counted, not a rule on their own)
  inline: /style=\{\{/g,
  // Shadows typed by hand (Part I rule 4; floating surfaces keep theirs, so this is a candidate count)
  shadow: /\bshadow-(?:sm|md|lg|xl|2xl|inner|\[)/g,
  // Cards at 22 / 36 (Part I rule 4: cards are 12)
  bigRadius: /\brounded-(?:2xl|3xl)\b/g,
  // D2: search is an icon until tapped
  searchInput: /<input\b[^>]*(?:type=["']search["']|placeholder=["'`{][^>]*\bSearch)/g,
  searchShared: /\bSearchAdd\b|\bSearchBox\b|search-add|search-box|\bThumbRow\b/g,
  // House pieces present
  masthead: /\bPageMasthead\b/g,
  actionButton: /\bActionButton\b|\bactionButtonClass\(/g,
  sheet: /<Sheet\b|<RiseScreen\b|\bOverlayBackdrop\b/g,
  ghost: /<(?:Sk|Ghost|SkSection)\b/g,
  glow: /band-glow|hc-ecard-plain|\bsn-band\b|data-papic-top-glow/g,
};
const SORT_WRONG = new Set([
  'ArrowUpDown',
  'ArrowDownUp',
  'ListFilter',
  'Filter',
  'SortAsc',
  'SortDesc',
  'ArrowDownNarrowWide',
  'ArrowDownWideNarrow',
  'ArrowUpNarrowWide',
  'ArrowUpWideNarrow',
  'ArrowDownAZ',
  'ArrowUpAZ',
]);
const count = (s, re) => (s.match(re) ?? []).length;

/** K1: brand ActionButtons that are not the main verb are accent-outlined; two `main` in one file is a candidate. */
function k1Of(s) {
  let brandSecond = 0;
  let mains = 0;
  for (const m of s.matchAll(/<ActionButton\b((?:(?!\/>)[\s\S]){0,700}?)\/?>/g)) {
    const a = m[1];
    const isMain = /(?:^|\s)main(?:\s|=\{true\}|$)/.test(a);
    if (isMain) mains++;
    else if (/tone=["'{`]+brand/.test(a) && !/\bquiet\b/.test(a)) brandSecond++;
  }
  for (const m of s.matchAll(/actionButtonClass\(\s*['"]brand['"]\s*(?:,\s*\{([^}]*)\})?/g)) {
    if (/\bmain\s*:\s*true\b|\bmain\b(?!\s*:\s*false)/.test(m[1] ?? '')) mains++;
    else brandSecond++;
  }
  return { brandSecond, mains };
}

/** The enclosing function/component name of the first hit of `re` in `s` (for file:symbol anchors). */
function symbolAt(s, idx) {
  const head = s.slice(0, idx);
  let best = null;
  for (const m of head.matchAll(/(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Z][\w$]*)\s*[:=]/g)) {
    best = m[1] ?? m[2];
  }
  return best;
}

/**
 * Product art and couple-picked themes are product data, not the app's look (Part I audit, "Not counted"):
 * invite themes, award and badge art, the gift box, monogram and wax-stamp stages, cover scenes a couple picks,
 * print designs, colour wheels, device mock-ups. Their gradients and colours are not counted.
 */
const PRODUCT_ART =
  /\/invite\/_components\/themes\/|\/_components\/award\/|monogram|wax-?stamp|gift-box|cover-scene|stage-panel|supplier-prints|colou?r-wheel|device-(?:frame|mock)|phone-mock|\/themes?\//;

const fileCache = new Map();
function fileSignals(abs) {
  let out = fileCache.get(abs);
  if (out) return out;
  const r = rel(abs);
  const s = src(abs);
  const css = abs.endsWith('.css');
  const c = {};
  const firstHit = {};
  const hit = (k, re, n) => {
    c[k] = (c[k] ?? 0) + n;
    if (n && !firstHit[k]) {
      re.lastIndex = 0;
      const m = re.exec(s);
      re.lastIndex = 0;
      if (m) firstHit[k] = css ? (/([.#][\w-]+)[^{}]*\{[^}]*$/.exec(s.slice(0, m.index))?.[1] ?? null) : symbolAt(s, m.index);
    }
  };
  if (css) {
    for (const k of ['hex', 'rgbLit', 'gradient', 'transitionAll']) hit(k, P[k], count(s, P[k]));
    hit('hex', P.hex3css, count(s, P.hex3css));
    hit('stripe', P.stripeCss, count(s, P.stripeCss));
    const radiusPx = /border-radius\s*:\s*\d+(?:\.\d+)?px/g;
    hit('roundedRaw', radiusPx, count(s, radiusPx));
    const fontPx = /font-size\s*:\s*\d+(?:\.\d+)?px/g;
    hit('textPx', fontPx, count(s, fontPx));
    const sh = /box-shadow\s*:\s*(?!none|var\(|inherit|0 0 0 1px)/g;
    hit('shadow', sh, count(s, sh));
  } else {
    for (const k of Object.keys(P)) {
      if (k === 'hex3css' || k === 'stripeCss') continue;
      hit(k, P[k], count(s, P[k]));
    }
    // Lucide sort / filter icons that are not SlidersHorizontal (B5)
    let sortWrong = 0;
    for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
      for (const name of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0])) if (SORT_WRONG.has(name)) sortWrong++;
    }
    c.sortWrong = sortWrong;
    const k1 = k1Of(s);
    c.k1BrandSecond = k1.brandSecond;
    c.k1Mains = k1.mains;
    c.k1TwoMains = k1.mains >= 2 ? 1 : 0;
    // A hand-made backdrop (the one-backdrop guard's own shape: fixed + inset-0 + a dim class in one string)
    let backdrop = 0;
    for (const m of s.matchAll(/(["'`])((?:(?!\1)[\s\S]){0,600}?)\1/g)) {
      const cls = m[2];
      if (/\bfixed\b/.test(cls) && /\binset-0\b/.test(cls) && /bg-(?:black|ink)\/|bg-\[rgba?\(|backdrop-blur|\bsn-scrim\b/.test(cls)) backdrop++;
    }
    c.handBackdrop = backdrop;
    // aria-modal outside the shared floating pieces is a hand-rolled layer
    c.handModal = c.ariaModal && !/\b(?:Sheet|RiseScreen|OverlayBackdrop|useModalA11y)\b/.test(s) ? c.ariaModal : 0;
  }
  // Baselines kept by the repo's own guards
  c.drHex = drFor(r, 'hex');
  c.drPalette = drFor(r, 'palette');
  c.drSelect = drFor(r, 'select');
  c.noCard = noCard.get(r) ?? 0;
  c.fieldTpl = fieldTpl.get(r) ?? 0;
  c.motionRaw = motionRaw[`apps/web/${r}`] ?? 0;
  c.mastheadDrift = masthead.has(r) ? 1 : 0;
  c.labelDark = labelDarkByFile.get(r) ?? 0;
  c.iconTiles = partI.tiles.get(r) ?? 0;
  c.kpiRow = partI.kpi.get(r) ?? 0;
  c.filler = partI.filler.get(r) ?? 0;
  if (PRODUCT_ART.test(r)) {
    c.art = 1;
    c.gradient = 0;
    c.hex = 0;
    c.rgbLit = 0;
  }
  // A gradient that is a scroll-edge fade or mask (allowed) is not decorative.
  if (c.gradient) c.gradient = Math.max(0, c.gradient - count(s, /mask(?:-image)?\s*[:=][^;\n]*gradient|\[mask-image:|band-glow/g));
  c.lines = rawLines(abs);
  out = { file: r, c, firstHit };
  fileCache.set(abs, out);
  return out;
}

/* ── rule families (the doc's "what is old" column) ───────────────────────────────────────────────────────── */
export const FAMILIES = [
  // [key, label, rule cite, visible?, (sum) => n]
  ['gradient', 'decorative gradient', 'Part I·1', true, (t) => t.gradient],
  ['stripe', 'coloured side stripe', 'H3 🚫', true, (t) => t.stripe],
  ['iconTile', 'icon tile', 'Part I·2', true, (t) => t.iconTiles],
  ['kpi', 'equal KPI row', 'Part I·3', true, (t) => t.kpiRow],
  ['frame', 'hand-made frame / static shadow', 'Part I·4 · lint:no-card', true, (t) => t.noCard + (t.shadow >= 3 ? t.shadow : 0)],
  ['button', 'legacy / hand-made button', 'D2 · T19', true, (t) => t.legacyBtn + t.handBtn],
  ['rank', 'second button in accent', 'K1', true, (t) => t.k1BrandSecond + t.k1TwoMains],
  ['input', 'legacy input / raw select / raw box', 'D2 · D3 · T15', true, (t) => t.legacyInput + t.select + t.fieldTpl],
  ['layer', 'hand-made layer (no shared backdrop)', 'K3', true, (t) => t.handBackdrop + t.handModal],
  ['loading', 'spinner / pulse, not Ghost', 'F1', true, (t) => t.spinner + t.pulse],
  ['sort', 'sort icon is not SlidersHorizontal', 'B5 · D2', true, (t) => t.sortWrong],
  ['search', 'search box always open', 'D2 search', true, (t) => (t.searchInput && !t.searchShared ? t.searchInput : 0)],
  ['confirm', 'confirm() dialog', 'D3', true, (t) => t.confirm],
  ['dark', 'surface that never flips in dark', 'B4 · K2', true, (t) => t.whiteBlack + t.labelDark],
  ['colour', 'raw colour (hex / rgb / palette)', 'Law 4 · B3', false, (t) => Math.max(t.hex + t.rgbLit, t.drHex) + Math.max(t.palette, t.drPalette)],
  ['type', 'typed px font size', 'B5', false, (t) => t.textPx + t.styleFont],
  ['radius', 'raw / legacy radius', 'B6', false, (t) => t.roundedRaw + t.legacyRadius],
  ['motion', 'raw ms / easing / transition-all', 'E1 · E2', false, (t) => t.motionRaw + t.transitionAll],
  ['filler', 'filler copy / vague period', 'Part I·5', false, (t) => t.filler],
];

/* ── areas, roles, templates ──────────────────────────────────────────────────────────────────────────── */
function roleOf(route, mapArea) {
  if (route.startsWith('/admin')) return 'admin';
  if (route.startsWith('/vendor-dashboard') || route.startsWith('/vendor-invite') || route.startsWith('/open-shop') || route.startsWith('/vendor/'))
    return 'supplier';
  if (route === '/for-coordinators' || route.startsWith('/host/accept')) return 'coordinator';
  if (route.startsWith('/dashboard/[eventId]')) return 'couple';
  if (route.startsWith('/dashboard') || route.startsWith('/onboarding') || route.startsWith('/site-editor') || route.startsWith('/host'))
    return 'couple';
  if (mapArea === 'guest') return 'guest';
  if (mapArea === 'host') return 'couple';
  if (mapArea === 'supplier') return 'supplier';
  if (mapArea === 'internal') return route.startsWith('/admin') ? 'admin' : 'public';
  return 'public';
}
const WEBSITE_FRONT = new Set(['/', '/for-suppliers', '/for-coordinators', '/pricing', '/features']);
function templateOf(route, role, isStub) {
  if (isStub) return '— (redirect: nothing to draw)';
  if (WEBSITE_FRONT.has(route)) return 'W · Website (Part H, H3 blocks + H4 order)';
  if (/^\/(?:login|signup|forgot-password|reset-password|auth|claim|join|vendor-invite|host\/accept|papic\/claim|papic\/join)/.test(route))
    return 'D · Door / sign-in card (light only, K2.4)';
  if (route.startsWith('/onboarding') || route.startsWith('/open-shop') || route === '/dashboard/create-event')
    return 'O · Onboarding step frame (T32)';
  if (/\/print$|\/poster$|\/printables?(?:\/|$)/.test(route)) return 'P · Print sheet (paper, exempt from app look)';
  if (route === '/[slug]' || route.startsWith('/[slug]/') || route.startsWith('/sample') || route.startsWith('/u/') || route === '/wall' || route.startsWith('/wall/'))
    return "H · Guest Event Hub (couple's own theme; K3 still applies)";
  if (/\/(?:studio|maker|editor|site-editor|card-maker|cake-maker|plan-maker|blueprint|seating\/3d|live-studio)/.test(route) || route.startsWith('/site-editor'))
    return role === 'supplier' ? 'M · Full-screen tool (T10/T12, supplier navy)' : 'M · Full-screen tool (T10/T12, RiseScreen)';
  if (role === 'admin') return 'A-adm · App page, admin monochrome';
  if (role === 'supplier') return 'A-sup · App page, supplier navy (shell + T2 pinned row + ThumbRow)';
  if (role === 'couple' || role === 'coordinator') return 'A-cpl · App page, couple terracotta (shell + T2 pinned row + ThumbRow)';
  if (role === 'guest') return 'G · Guest page (Event Hub link; light, no login)';
  return 'W · Website (Part H)';
}

/* Which raw signals feed each family (for the symbol anchor) */
const FAMILY_SIGNALS = {
  gradient: ['gradient'],
  stripe: ['stripe'],
  frame: ['shadow'],
  button: ['legacyBtn', 'handBtn'],
  rank: ['actionButton'],
  input: ['legacyInput', 'select'],
  layer: ['ariaModal', 'inline'],
  loading: ['spinner', 'pulse'],
  sort: [],
  search: ['searchInput'],
  confirm: ['confirm'],
  dark: ['whiteBlack'],
  colour: ['hex', 'rgbLit', 'palette'],
  type: ['textPx', 'styleFont'],
  radius: ['roundedRaw', 'legacyRadius'],
  motion: ['transitionAll'],
};

/* ── the run ──────────────────────────────────────────────────────────────────────────────────────────── */
const screens = readJson(join(WEB, 'lib', 'ugat', 'screens.generated.json')).screens;
const byFile = new Map(screens.map((s) => [s.file, s]));
// Admin is mapped separately (lib/admin-map/admin-routes.generated.ts): path · kind · redirectsTo · inMenuSource.
const adminRoutes = new Map();
{
  const t = readFileSync(join(WEB, 'lib', 'admin-map', 'admin-routes.generated.ts'), 'utf8');
  for (const m of t.matchAll(/"path":\s*"([^"]+)",\s*"kind":\s*"(\w+)",\s*"redirectsTo":\s*(null|"[^"]*"),\s*"inMenuSource":\s*(true|false)/g)) {
    adminRoutes.set(m[1], { kind: m[2], redirectsTo: m[3] === 'null' ? null : m[3].slice(1, -1), inMenu: m[4] === 'true' });
  }
}

function isRedirectStub(abs) {
  const body = src(abs);
  return body.length < 1800 && /^\s*(?:return\s+)?(?:permanentRedirect|redirect|notFound)\(/m.test(body) && !/<[A-Za-z]/.test(body);
}

/* Pass 1: every page's scope, and how many pages import each app/ file it draws. */
const raw = [];
const importers = new Map(); // app/ file (not a house piece) → Set(route)
let intercepting = 0;
for (const abs of walkPages(APP)) {
  const route = routeOf(abs);
  if (!route) {
    intercepting++;
    continue;
  }
  const sc = scopeOf(abs);
  for (const d of sc.deps) {
    const set = importers.get(rel(d)) ?? new Set();
    set.add(route);
    importers.set(rel(d), set);
  }
  raw.push({ abs, route, ...sc });
}

/** A file drawn by more than this many pages is an AREA-SHARED piece: fixed once, listed in its own section. */
const PAGE_ONLY_MAX = 3;
const famOf = (c) => {
  const px = new Proxy(c, { get: (o, key) => o[key] ?? 0 });
  const out = {};
  for (const [k, , , , fn] of FAMILIES) out[k] = fn(px);
  return out;
};
const AREA_WEIGHT = { guest: 3, public: 3, coordinator: 2, couple: 3, supplier: 3, admin: 1 };
const ENTRY = new Set(['/', '/[slug]', '/login', '/signup', '/dashboard', '/dashboard/[eventId]', '/vendor-dashboard', '/v/[slug]', '/explore']);

/* Pass 2: count each page over its own files + the files only it (or ≤ 3 pages) draws. */
const pages = [];
for (const { abs, route, own, deps, shared } of raw) {
  const file = rel(abs);
  const map = byFile.get(file);
  const adm = route.startsWith('/admin') ? adminRoutes.get(route) : null;
  const mapArea = map?.area ?? (adm ? 'admin' : 'unmapped');
  const isStub = map?.status === 'stub' || adm?.kind === 'redirect' || isRedirectStub(abs);
  const role = roleOf(route, mapArea);
  const counted = new Set(own);
  const viaShared = [];
  for (const d of deps) {
    if ((importers.get(rel(d))?.size ?? 0) <= PAGE_ONLY_MAX) counted.add(d);
    else viaShared.push(rel(d));
  }
  const loading = join(dirname(abs), 'loading.tsx');
  if (existsSync(loading)) counted.add(loading);
  const t = {};
  const perFile = [];
  let lines = 0;
  for (const f of counted) {
    const fsig = fileSignals(f);
    perFile.push(fsig);
    for (const [k, v] of Object.entries(fsig.c)) t[k] = (t[k] ?? 0) + v;
    lines += fsig.c.lines;
  }
  t.lines = lines;
  const sharedRel = [...shared].map(rel);
  const usesMasthead = t.masthead > 0 || sharedRel.some((f) => /page-masthead/.test(f)) || viaShared.some((f) => fileSignals(join(WEB, f)).c.masthead > 0);
  const fam = famOf(t);
  const hub = route === '/[slug]' || route.startsWith('/[slug]/') || route.startsWith('/sample') || route.startsWith('/u/');
  if (hub) for (const k of ['colour', 'type', 'radius', 'gradient', 'dark']) fam[k] = 0; // the couple's own theme (CLAUDE.md §3)
  const signedIn = /^\/(?:dashboard|vendor-dashboard|admin)(?:\/|$)/.test(route);
  fam.shell = signedIn && !isStub ? t.mastheadDrift : 0; // a hand-rolled masthead is visible
  fam.noMasthead = signedIn && !isStub && !usesMasthead ? 1 : 0; // no sr-only h1: hygiene, not a look
  // Worst file per family, for the file:symbol anchor
  const worst = {};
  for (const [k] of FAMILIES) {
    let best = null;
    for (const pf of perFile) {
      const n = famOf(pf.c)[k];
      if (n > 0 && (!best || n > best.n)) {
        const sym = (FAMILY_SIGNALS[k] ?? []).map((hk) => pf.firstHit[hk]).find(Boolean) ?? null;
        best = { file: pf.file, n, sym };
      }
    }
    if (best) worst[k] = best;
  }
  if (fam.shell) worst.shell = { file: perFile.find((pf) => pf.c.mastheadDrift)?.file ?? file, n: fam.shell, sym: 'hand-rolled masthead' };
  if (fam.noMasthead) worst.noMasthead = { file, n: 1, sym: 'no PageMasthead' };
  // Old-design pieces this page draws through area-shared files (fixed in the shared file, not here)
  const sharedFam = {};
  for (const f of viaShared) for (const [k, n] of Object.entries(famOf(fileSignals(join(WEB, f)).c))) if (n) sharedFam[k] = (sharedFam[k] ?? 0) + n;

  // ── verdict ──
  const visible = FAMILIES.filter(([k, , , v]) => v && fam[k] > 0).map(([k]) => k);
  if (fam.shell) visible.push('shell');
  const hygiene = FAMILIES.filter(([k, , , v]) => !v && fam[k] > 0).map(([k]) => k);
  if (fam.noMasthead) hygiene.push('noMasthead');
  const hygieneHits = hygiene.reduce((a, k) => a + fam[k], 0);
  const visibleHits = visible.reduce((a, k) => a + fam[k], 0);
  const weight = visible.reduce((a, k) => a + 2 * Math.min(fam[k], 10), 0) + hygiene.reduce((a, k) => a + Math.min(fam[k], 10), 0);
  let verdict;
  if (isStub) verdict = 'redirect';
  else if (visible.length === 0 && hygieneHits <= 5) verdict = 'current';
  else if (visible.length >= 4 || weight >= 40) verdict = 'old';
  else verdict = 'partly old';
  const hits = visibleHits + hygieneHits;
  const size = isStub ? '—' : lines > 2500 || hits > 120 || visible.length >= 7 ? 'L' : lines < 500 && hits < 20 ? 'S' : 'M';

  // ── how often it is seen (no traffic data in the repo: a door-count proxy from the Ugat map) ──
  const doors = map?.doors ?? [];
  const kinds = {};
  for (const d of doors) kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
  const inMenu = (kinds['nav-registry'] ?? 0) + (kinds.menu ?? 0) > 0 || adm?.inMenu === true;
  const links = (kinds.link ?? 0) + (kinds.navigate ?? 0) + (kinds.builder ?? 0) + (kinds.internal ?? 0);
  const seen =
    Math.round(
      ((AREA_WEIGHT[role] ?? 1) * (1 + (inMenu ? 2 : 0)) + Math.log2(1 + links) * 2 + (kinds.email ? 1.5 : 0) + (ENTRY.has(route) ? 12 : 0)) * 10,
    ) / 10;

  pages.push({
    route,
    file,
    role,
    mapArea,
    status: map?.status ?? (adm ? (adm.kind === 'redirect' ? 'stub' : 'admin-map') : 'unmapped'),
    redirectsTo: map?.redirectsTo ?? adm?.redirectsTo ?? null,
    isStub,
    template: templateOf(route, role, isStub),
    files: counted.size,
    lines,
    totals: t,
    fam,
    visible,
    hygiene,
    weight,
    verdict,
    size,
    worst,
    viaShared,
    sharedFam,
    usesMasthead,
    glow: t.glow > 0,
    templateScore: templateScore[relative(APP, dirname(abs)).split(sep).join('/')] ?? 0,
    doors: doors.length,
    doorKinds: kinds,
    inMenu,
    seen,
  });
}

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const result = {
  generatedFrom: { screensMap: 'apps/web/lib/ugat/screens.generated.json', adminMap: 'apps/web/lib/admin-map/admin-routes.generated.ts', pages: pages.length, intercepting },
  families: FAMILIES.map(([k, label, cite, visible]) => ({ k, label, cite, visible })),
  pages,
  sharedInApp: [...importers.entries()]
    .map(([file, set]) => ({ file, routes: [...set].sort(), fam: famOf(fileSignals(join(WEB, file)).c), lines: fileSignals(join(WEB, file)).c.lines }))
    .filter((x) => x.routes.length >= 2),

};
if (jsonAt >= 0) writeFileSync(args[jsonAt + 1], JSON.stringify(result, null, 1));
if (args.includes('--summary') || jsonAt < 0) {
  const by = {};
  for (const p of pages) {
    by[p.role] = by[p.role] ?? { pages: 0, redirect: 0, current: 0, 'partly old': 0, old: 0 };
    by[p.role].pages++;
    by[p.role][p.verdict]++;
  }
  console.log(`pages ${pages.length} (intercepting views and parallel slots skipped: ${intercepting})`);
  for (const [r, v] of Object.entries(by)) console.log(`  ${r.padEnd(12)} ${JSON.stringify(v)}`);
}
