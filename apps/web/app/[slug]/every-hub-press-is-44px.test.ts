/**
 * 👆 EVERY PRESS THE GUEST EVENT HUB DRAWS IS AT LEAST 44 PX — IN EVERY AXIS ITS OWN CLASSES SIZE.
 *
 * Owner 2026-10-21: *"Can you also check the buttons on the event hub if all works"*. The Hub button walk
 * (a Playwright press of every control on maria-and-jose signed out, and on the `/dev` labs as a guest with a pass,
 * at 375 px touch) found every control reaching where it should — and a family of presses smaller than a thumb:
 * the venue card's Google Maps · Waze · Apple Maps chips 26 px tall, side by side, on the Invitation and on The Day;
 * the photo viewer's Close 40 px wide and its "Open" link 28 px tall; the QR sheet's ✕ 32 px; the "Live hub" and
 * "Account" corner pills 40 px; the Live hub's back arrow 36 px. The house floor is 44 px (`globals.css`: "Touch
 * targets ≥ 44pt"), and it only ever covered a <button>'s HEIGHT — a link, and a button's WIDTH, were on their own.
 *
 * THE PROPERTY, read from the source of every component under `app/[slug]` (plus the shared directions row it
 * mounts — `SHARED` below): for each `<a>` · `<Link>` · `<button>` · `<summary>` whose className SIZES
 * it —
 *   · an explicit height (`h-*` / `size-*`) or a height made of padding + one line of text (`py-*` + `text-*`, on a
 *     link) must reach 44 px, or carry a `min-h-*` floor that does (a <button> has the global floor already);
 *   · an explicit width (`w-*` / `size-*`) must reach 44 px.
 * Variant classes (`sm:` · `hover:` …) are ignored — a phone has none of them. A className built from a local
 * string constant (`className={chipBase}`) is read through that constant, every literal of it.
 *
 * It cannot see a press sized only by its words (an inline underline link); the walk does
 * (`~/Documents/Claude/Projects/shots-2026-10-21/hub-buttons/scripts/walk.mjs`). What it pins is the regression
 * that actually happened: a press drawn with classes that make it smaller than a finger.
 *
 * SABOTAGE (each seen RED, then restored): the directions chips' `min-h-[44px]` removed · the QR sheet's ✕ back to
 * `h-8 w-8` · the global `button { min-height: 44px }` rule removed from globals.css.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const HUB = join(WEB, 'app', '[slug]');
/** The shared presses the Hub mounts for a guest (directions, the photo viewer, the pass, sheets, Share · Report). */
const SHARED = [
  'app/_components/nav-links.tsx',
  'app/_components/get-directions.tsx',
  'app/_components/map-card-chrome.tsx',
  'app/_components/gallery/gallery-lightbox.tsx',
  'app/_components/save-pass-card-button.tsx',
  'app/_components/sheet.tsx',
  'app/_components/public-page-actions.tsx',
  'app/_components/save-photo-button.tsx',
  'app/_components/door/door-shell.tsx',
  'app/_components/guest-to-host-cta.tsx',
  'app/_components/pabuya/pabuya-card-list.tsx',
  'app/_components/pabuya/pabuya-qr-viewer.tsx',
  'app/_components/vendor-location-map.tsx',
  'app/_components/wayfinding-map.tsx',
];
const FLOOR = 44;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p);
  }
  return out;
}

/** Tailwind spacing token → px (`10` → 40, `[52px]` → 52, `[3.25rem]` → 52). Null for anything else. */
function px(tok: string): number | null {
  if (/^\d+(\.5)?$/.test(tok)) return Number(tok) * 4;
  const m = /^\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(tok);
  return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null;
}
/** One line of text, by Tailwind size (the line-height Tailwind pairs with it). */
const LINE: Record<string, number> = { 'text-[0.6rem]': 12, 'text-[0.65rem]': 12, 'text-[11px]': 16, 'text-xs': 16, 'text-[13px]': 18, 'text-sm': 20, 'text-base': 24, 'text-lg': 28 }; // legibility-ok: class NAMES the rule measures, not text on a page

type Press = { file: string; line: number; tag: string; cls: string };

/** Every sizing problem of one className, for one tag. Empty when it is a full-size press. */
export function undersized(tag: string, cls: string): string[] {
  const base = cls.split(/\s+/).filter((t) => t && !t.includes(':'));
  if (base.includes('sr-only') || base.includes('hidden')) return [];
  const one = (re: RegExp) => base.map((t) => re.exec(t)?.[1]).filter((v): v is string => v != null).map(px).filter((v): v is number => v != null);
  let floor = tag === 'button' ? FLOOR : 0; // globals.css: `button { min-height: 44px }` (asserted below)
  floor = Math.max(floor, ...one(/^min-h-(.+)$/), ...base.filter((t) => /^min-h-(11|12|14|16)$/.test(t)).map(() => FLOOR));
  const heights = [...one(/^h-(.+)$/), ...one(/^size-(.+)$/)];
  const widths = [...one(/^w-(.+)$/), ...one(/^size-(.+)$/)];
  let height: number | null = heights.length ? Math.max(...heights) : null;
  // A stacked press (icon over words, `flex-col`) is taller than one line of text — only its own `h-*` says how tall.
  if (height == null && (tag === 'a' || tag === 'Link') && !base.includes('flex-col')) {
    const pads = one(/^(?:py|p)-(\d+(?:\.5)?)$/);
    if (pads.length) {
      const lineH = Object.entries(LINE).find(([k]) => base.includes(k))?.[1] ?? 20;
      height = 2 * Math.max(...pads) + lineH + (base.includes('border') ? 2 : 0);
    }
  }
  const out: string[] = [];
  const drawn = height == null ? (floor || null) : Math.max(height, floor);
  if (drawn != null && drawn < FLOOR) out.push(`${drawn} px tall`);
  if (widths.length && Math.max(...widths) < FLOOR) out.push(`${Math.max(...widths)} px wide`);
  return out;
}

/** Every pressable opening tag in a file, with each className it can take. */
function presses(file: string): Press[] {
  const src = stripComments(readFileSync(file, 'utf8'));
  const consts = new Map<string, string[]>();
  for (const m of src.matchAll(/const\s+([A-Za-z_]\w*)\s*=\s*((?:[^;]|;(?!\s*\n))*?);\s*\n/g)) {
    const lits = [...m[2]!.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)].map((x) => x[1] ?? x[2] ?? '');
    if (lits.length && lits.every((l) => /^[\w\s\-[\].:/%#()!&>~*,'"=]*$/.test(l))) consts.set(m[1]!, lits);
  }
  const out: Press[] = [];
  const TAG = /<(button|a|Link|summary)(?![\w.])((?:[^>{]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*)>/g;
  for (const m of src.matchAll(TAG)) {
    const attrs = m[2]!;
    const line = src.slice(0, m.index).split('\n').length;
    const lit = /className=(?:"([^"]*)"|'([^']*)')/.exec(attrs);
    const tpl = /className=\{`([^`]*)`\}/.exec(attrs);
    const ref = /className=\{([A-Za-z_]\w*)\}/.exec(attrs);
    let variants: string[] = [];
    if (lit) variants = [lit[1] ?? lit[2] ?? ''];
    else if (tpl) {
      const raw = tpl[1]!;
      const names = [...raw.matchAll(/\$\{([A-Za-z_]\w*)\}/g)].map((x) => x[1]!);
      const fixed = raw.replace(/\$\{[^}]*\}/g, ' ');
      variants = [fixed];
      for (const n of names) for (const v of consts.get(n) ?? []) variants.push(`${fixed} ${v}`);
    } else if (ref && consts.has(ref[1]!)) variants = consts.get(ref[1]!)!;
    for (const cls of variants) out.push({ file, line, tag: m[1]!, cls });
  }
  return out;
}

const FILES = [...walk(HUB), ...SHARED.map((f) => join(WEB, f))];

test('the global floor the rule leans on is still there: every <button> is at least 44 px tall', () => {
  const css = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8'));
  assert.match(css, /button,\s*\[role='button'\],\s*a\.button,\s*input\[type='submit'\]\s*\{\s*min-height:\s*44px;/, 'globals.css must keep `button { min-height: 44px }` — this guard counts every <button> as 44 px tall because of it');
});

test('the rule can see a small press (it is not reading nothing)', () => {
  assert.deepEqual(undersized('a', 'inline-flex items-center rounded-md border px-2.5 py-1 text-xs'), ['26 px tall']);
  assert.deepEqual(undersized('button', 'inline-flex h-8 w-8 items-center'), ['32 px wide']);
  assert.deepEqual(undersized('Link', 'inline-flex h-10 items-center'), ['40 px tall']);
  assert.deepEqual(undersized('a', 'inline-flex min-h-[44px] items-center px-2.5 py-1 text-xs'), []);
  assert.deepEqual(undersized('button', 'inline-flex h-11 w-11'), []);
  assert.ok(FILES.length > 100, `read ${FILES.length} files — expected the whole Hub tree`);
  const all = FILES.flatMap(presses);
  assert.ok(all.length > 300, `found ${all.length} presses — the tag reader is not reading`);
  const directions = all.filter((p) => p.file.endsWith('get-directions.tsx'));
  assert.ok(directions.length >= 4, 'the shared Get directions button, its sheet rows, ✕ and Close are read');
});

test('every press the guest Event Hub draws is at least 44 px in every axis its classes size', () => {
  const bad = FILES.flatMap(presses)
    .map((p) => ({ p, why: undersized(p.tag, p.cls) }))
    .filter((x) => x.why.length)
    .map(({ p, why }) => `${relative(WEB, p.file)}:${p.line} <${p.tag}> ${why.join(' · ')} — ${p.cls.trim().slice(0, 90)}`);
  assert.deepEqual([...new Set(bad)], [], 'a guest presses these with a thumb; give each a 44 px floor (min-h-[44px] / h-11 w-11)');
});

/* 🧭 THE MAP APPS ARE ONE "GET DIRECTIONS" BUTTON ON EVERY VENUE CARD. History: three side-by-side chips
   (`NavLinksRow`, 26 px tall when the walk measured them) → ONE "Directions ▾" dropdown (controller ruling 2026-10-21,
   from the owner's "any set of choices is a dropdown") → since 2026-11-14 ONE "Get directions" button whose sheet,
   named after the place, lists the map apps (map card + Get directions, owner "Yes, approved",
   `prototypes/map_card_open_in_maps_2026-11-14_fable.html`). The choices still live in ONE place, never side by side.
   `DirectionsMenu` (`app/_components/nav-links.tsx`) builds the links and mounts the one button (`GetDirections`,
   `app/_components/get-directions.tsx`); every venue card, The Day, the Live hub and the supplier page mount
   `DirectionsMenu` — see the next test. SABOTAGE: `<NavLinksRow …>` put back on the plain card → RED; the sheet's app
   rows at `min-h-9` → RED; the couple button's `min-h-12` removed → RED. */
const SHARED_DIRECTIONS = 'app/_components/nav-links.tsx';
const SHEET_DIRECTIONS = 'app/_components/get-directions.tsx';
const directionsMenuSource = (): string => {
  const src = stripComments(readFileSync(join(WEB, SHARED_DIRECTIONS), 'utf8'));
  const at = src.indexOf('export function DirectionsMenu(');
  assert.ok(at >= 0, `DirectionsMenu is the exported, shared component in ${SHARED_DIRECTIONS}`);
  return src.slice(at, src.indexOf('\n}\n', at));
};
const getDirectionsSource = (): string => stripComments(readFileSync(join(WEB, SHEET_DIRECTIONS), 'utf8'));

test('every venue card offers the map apps as ONE "Get directions" button whose sheet rows are 44 px presses — never a row of chips', () => {
  const cards = ['venue-widget.tsx', 'venue-styles.tsx'].map((f) => [f, stripComments(readFileSync(join(HUB, '_components', f), 'utf8'))] as const);
  for (const [f, src] of cards) {
    assert.doesNotMatch(src, /<NavLinksRow(?![\w.])/, `${f}: a venue card draws the map apps as a row of chips again`);
  }
  const mounts = cards.reduce((n, [, src]) => n + (src.match(/<DirectionsMenu(?![\w.])/g) ?? []).length, 0);
  assert.ok(mounts >= 3, `the plain, full-photo and journey cards each mount DirectionsMenu (found ${mounts})`);
  const menu = directionsMenuSource();
  assert.equal((menu.match(/<GetDirections(?![\w.])/g) ?? []).length, 1, 'DirectionsMenu mounts ONE Get directions button');
  const sheet = getDirectionsSource();
  const coupleButton = /look === 'template' \?[\s\S]*?<button[\s\S]*?className=\{`([^`]*)`\}/.exec(sheet)?.[1] ?? '';
  const row = /<a\b[^>]*?href=\{a\.href\}[\s\S]*?className="([^"]*)"/.exec(sheet)?.[1] ?? '';
  assert.ok(coupleButton && row, 'the button and the app rows are found');
  assert.deepEqual(undersized('button', coupleButton.replace(/\$\{[^}]*\}/g, ' ')), [], 'the "Get directions" button is a 44 px press');
  assert.match(coupleButton, /min-h-(11|12|\[4[4-9]px\])/, 'the button carries its own floor');
  assert.deepEqual(undersized('a', row), [], 'each map app row is a 44 px press');
  assert.match(row, /min-h-(11|12|\[\d+px\])/, 'each row carries its own floor');
});

/* ▾ NO SURFACE DRAWS THE MAP APPS AS SEPARATE BUTTONS — ANYWHERE IN THE APP (owner, standing: "any set of choices is a
   dropdown"; 2026-10-22, the follow-up #6751 named: The Day's directions card and the Live hub still drew three chips,
   and so did a supplier's public profile, all through `NavLinksRow`). Since 2026-11-14 the one place is the "Get
   directions" sheet (see above): the links are built in `DirectionsMenu`, the sheet only lists them.

   THE PROPERTY: a Waze or Apple Maps link — a call to `wazeNavUrl` / `appleMapsUrl`, or the host written out
   (`waze.com`, `maps.apple.com`, `waze://`, `maps://`) — is built in exactly ONE component, the shared
   `DirectionsMenu`, which hands them to the ONE sheet (`GetDirections`), whose rows are one `<a>` in a `.map`. Any other
   file that builds one is a second way to draw the map apps, and a second way is how three chips come back. The URL
   builders' own definitions (`lib/geo.ts`) are the only other place the hosts may appear.
   Every surface that offers directions is then a mount of the one component, counted per file.

   SABOTAGE (each seen RED, then restored): a three-chip row (Google Maps · Waze · Apple Maps `<a>`s with
   `wazeNavUrl`/`appleMapsUrl`) put back in `day-directions.tsx` → RED · the dropdown's `.map` replaced by three
   written-out `<a>`s → RED · `hub/page.tsx` back on `NavLinksRow` → RED. */
const MAP_APP_LINK = /\b(?:wazeNavUrl|appleMapsUrl)\s*\(|waze\.com|maps\.apple\.com|\bwaze:\/\/|\bmaps:\/\//g;
const DIRECTION_SURFACES = [
  'app/[slug]/_components/venue-widget.tsx',
  'app/[slug]/_components/venue-styles.tsx',
  'app/[slug]/_components/day-directions.tsx',
  'app/[slug]/hub/page.tsx',
  'app/v/[slug]/page.tsx',
];

function walkSource(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkSource(p));
    else if (/\.(tsx?|mjs|jsx?)$/.test(p) && !/\.test\.|\.golden\./.test(p)) out.push(p);
  }
  return out;
}

test('no surface draws Google Maps · Waze · Apple Maps as separate buttons — every one mounts the ONE Directions dropdown', () => {
  const files = ['app', 'components', 'lib'].flatMap((d) => walkSource(join(WEB, d)));
  assert.ok(files.length > 1000, `read ${files.length} source files — expected the whole app`);
  const elsewhere: string[] = [];
  let builtInMenu = 0;
  for (const f of files) {
    const rel = relative(WEB, f);
    if (rel === 'lib/geo.ts') continue; // the URL builders' own definitions
    const src = stripComments(readFileSync(f, 'utf8'));
    if (/\bNavLinksRow\b/.test(src)) elsewhere.push(`${rel}: NavLinksRow — the three-chip row is retired; mount DirectionsMenu`);
    const hits = [...src.matchAll(MAP_APP_LINK)];
    if (!hits.length) continue;
    if (rel !== SHARED_DIRECTIONS) {
      elsewhere.push(`${rel}: builds a ${hits.map((m) => m[0].replace(/\s*\($/, '')).join(' · ')} link outside the shared DirectionsMenu`);
      continue;
    }
    const menu = directionsMenuSource();
    const inMenu = [...menu.matchAll(MAP_APP_LINK)].length;
    builtInMenu += inMenu;
    if (inMenu !== hits.length) elsewhere.push(`${rel}: a map-app link is built outside DirectionsMenu`);
  }
  assert.deepEqual(elsewhere, [], 'the map apps are ONE "Get directions" sheet — mount DirectionsMenu, never a row of chips');
  assert.ok(builtInMenu >= 2, `anti-vacuity: the shared menu builds the Waze and Apple Maps links (found ${builtInMenu})`);

  // Inside the one component: it draws no link itself and mounts ONE sheet button; the sheet's app rows come from ONE
  // <a> in a .map over the device's list — never three written out.
  const menu = directionsMenuSource();
  assert.equal((menu.match(/<a\b/g) ?? []).length, 0, 'DirectionsMenu draws no link of its own — the sheet lists them');
  assert.equal((menu.match(/<GetDirections(?![\w.])/g) ?? []).length, 1, 'DirectionsMenu mounts ONE Get directions button');
  const sheet = getDirectionsSource();
  assert.equal((sheet.match(/<a\b/g) ?? []).length, 1, 'the sheet draws its app rows from ONE <a> — three written-out <a>s are three buttons');
  assert.match(sheet, /apps\.map\(\(a\) => \{[\s\S]*<a\b[^>]*?href=\{a\.href\}/, 'the rows are the device\'s apps list, mapped');
  assert.match(sheet, /<Sheet\b[\s\S]*apps\.map\(/, 'the rows sit inside the sheet, not beside the button');

  // Every surface that offers directions mounts it (a surface that drops it would pass the check above by drawing nothing).
  for (const rel of DIRECTION_SURFACES) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.match(src, /<DirectionsMenu(?![\w.])/, `${rel}: offers directions — mount the shared DirectionsMenu`);
    assert.match(src, /import \{[^}]*\bDirectionsMenu\b[^}]*\} from '@\/app\/_components\/nav-links'/, `${rel}: the ONE DirectionsMenu, from nav-links`);
  }
});
