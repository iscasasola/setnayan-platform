/**
 * GUARD — the couple dashboard has ONE phone/tablet line, and it is 701.
 *
 * Owner 2026-10-19, DECISION_LOG "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET
 * (AREA 2)" · prototype `couple_dashboard_desktop_tablet_2026-10-19.html` §0:
 * the tablet starts at 701 — the rail's 72-px strip replaces the phone's bottom
 * bar from there — and the iPad audit's W10 named the defect this replaces:
 * the event tree's bars switched at three different widths.
 *
 * Held five ways, each a PROPERTY (read out of the files, never a pinned word):
 *
 *   1 · ONLY THE DESIGNED TREES OPT IN. The couple's event layout (area 2,
 *       2026-10-19) and the supplier dashboard (area 3, prototype
 *       `desktop_layouts_2026-10-22.html` family 2, 2026-10-23) hand the shell
 *       and the dock `boundary="tab"`. A third production tree opting in would
 *       move a surface nobody designed (HQ would draw the strip AND its own
 *       bottom bar).
 *   2 · THE BAND UNDOES THE DRAWER. Every rail/scrim/menu-button/bar rule the
 *       sub-1024 blocks apply to every tree has a `[data-boundary='tab']`
 *       counterpart in the tablet band — so a new drawer rule cannot leak into
 *       the opted-in tree's strip unnoticed.
 *   3 · THE BAND STARTS ON THE LINE. Its floor is `BREAKPOINTS.tab`, the same
 *       number Tailwind's `tab:` screen and `useIsDesktop('tab')` read.
 *   4 · THE TOP BAR SWITCHES THERE TOO. The slim phone bar and the mark-for-word
 *       swap both end at 700.98 — no 768 left in the bar.
 *   5 · THE PAGES' DOCKS MOVE WITH THE BAR. Each of the five pages' thumb docks
 *       that sat on the phone bar takes its desktop place from the same line —
 *       never left at `lg` (where it would sit on a bar that is gone, over the
 *       rail).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CSS = read('app/_components/frontdoor/front-door.css');
const TAB_PX = Number(/\btab\s*:\s*(\d+)/.exec(read('lib/use-responsive.ts'))?.[1]);
const TW = read('tailwind.config.ts');

type Rule = { media: string; sel: string; body: string };

/** Flat list of rules with their enclosing @media prelude ('' when none). */
function rules(src: string): Rule[] {
  const out: Rule[] = [];
  const stack: string[] = [];
  let head = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      const h = head.trim();
      if (h.startsWith('@')) {
        stack.push(h);
      } else {
        const close = src.indexOf('}', i);
        out.push({ media: stack.filter((s) => s.startsWith('@media')).join(' '), sel: h, body: src.slice(i + 1, close) });
        i = close;
      }
      head = '';
    } else if (c === '}') {
      stack.pop();
      head = '';
    } else {
      head += c;
    }
  }
  return out;
}

const ALL = rules(CSS);
const isDrawerBand = (m: string) => /^@media \(max-width: 1023\.98px\)$/.test(m.trim());
const isTabletBand = (m: string) => new RegExp(`^@media \\(min-width: ${TAB_PX}px\\) and \\(max-width: 1023\\.98px\\)$`).test(m.trim());

/** The selector with its tree prefix removed — what element it lands on. */
const target = (s: string) =>
  s
    .trim()
    .replace(/^\.fd\[data-(?:chrome='app'|boundary='tab')\]\s*/, '')
    .replace(/\s+/g, ' ');

test('0 · the line exists once, in all three places that read it', () => {
  assert.ok(TAB_PX > 430 && TAB_PX < 744, `BREAKPOINTS.tab is ${TAB_PX} — it must sit above every phone portrait (430) and below every iPad portrait (744)`);
  assert.match(TW, new RegExp(`\\btab:\\s*'${TAB_PX}px'`), 'tailwind.config.ts `tab` screen disagrees with BREAKPOINTS.tab');
});

test('1 · only the couple event layout and the supplier dashboard opt into the 701 line', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
        walk(p);
      } else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) {
        const src = stripComments(readFileSync(p, 'utf8'));
        if (/\bboundary="tab"/.test(src)) hits.push(relative(WEB, p));
      }
    }
  };
  walk(join(WEB, 'app'));
  assert.deepEqual(
    hits.sort(),
    ['app/dashboard/[eventId]/layout.tsx', 'app/vendor-dashboard/layout.tsx'],
    `boundary="tab" is passed by: ${hits.join(', ')}`,
  );
  for (const rel of ['app/dashboard/[eventId]/layout.tsx', 'app/vendor-dashboard/layout.tsx']) {
    const layout = read(rel);
    assert.equal((layout.match(/\bboundary="tab"/g) ?? []).length, 2, `${rel} must hand the line to BOTH the shell and the dock`);
    assert.match(layout, /<AppRailShell[\s\S]*?boundary="tab"/, `${rel}: the shell is not told the 701 line`);
    assert.match(layout, /<BottomDock boundary="tab">/, `${rel}: the dock is not told the 701 line — the phone bar would sit under the strip`);
  }
});

test('2 · every drawer rule the sub-1024 blocks apply to the rail, the scrim, the menu button or the bar is undone in the tablet band', () => {
  const CHROME = /\.fd-(?:rail|body|scrim|only-narrow|row|rlabel|msub|topwrap|btn-gold|signin-prompt|notice|smallprint)\b/;
  const drawer = ALL.filter((r) => isDrawerBand(r.media) || /max-width: 1023\.98px/.test(r.media) && !r.media.includes('min-width'))
    .flatMap((r) => r.sel.split(','))
    .map(target)
    .filter((s) => CHROME.test(s) && !/data-open='(?:true|closing)'|\[data-closing='true'\]/.test(s))
    .filter((s) => !/^\.fd-(?:grid|storyrow|main|topbar)\b/.test(s));
  const band = new Set(
    ALL.filter((r) => isTabletBand(r.media))
      .flatMap((r) => r.sel.split(','))
      .filter((s) => s.trim().startsWith(".fd[data-boundary='tab']"))
      .map(target),
  );
  assert.ok(band.size > 0, `no tablet band (@media (min-width: ${TAB_PX}px) and (max-width: 1023.98px)) naming .fd[data-boundary='tab']`);
  const missing = [...new Set(drawer)].filter((s) => !band.has(s) && !band.has(s.replace(/^\.fd-rail /, '')) && !band.has(`.fd-rail ${s}`));
  assert.deepEqual(
    missing,
    [],
    `the drawer changes ${missing.join(' · ')} below 1024 for every tree, and the tablet band does not undo it — ` +
      'the couple dashboard would draw a piece of the phone drawer inside its 72-px strip',
  );
  /* The strip's own row and the rail's inline geometry are the band's, not a guess. */
  const railRule = ALL.find((r) => isTabletBand(r.media) && r.sel.includes(".fd[data-boundary='tab'] .fd-rail[data-open='false']"));
  assert.ok(railRule, 'the band does not pin a shut rail inline');
  assert.match(railRule.body, /display:\s*block/);
  assert.match(railRule.body, /position:\s*sticky/);
  assert.match(railRule.body, /top:\s*var\(--fd-bar\)/);
  const varRule = ALL.find((r) => isTabletBand(r.media) && r.sel.trim() === ".fd[data-boundary='tab']");
  assert.match(varRule?.body ?? '', /--fd-rail:\s*72px/, 'the band does not hand down the 72-px strip');
});

test('3 · the drawer\'s inline line and the hook that closes it agree for the opted-in tree', () => {
  const shell = read('app/_components/frontdoor/front-door-shell.tsx');
  assert.match(shell, /useIsDesktop\(boundary === 'tab' \? 'tab' : 'lg'\)/, 'the shell closes the opted-in drawer at a different line');
  assert.match(shell, /data-boundary=\{boundary === 'tab' \? 'tab' : undefined\}/, 'the shell no longer writes data-boundary');
});

test('4 · the top bar switches on the same line — no 768 left in it', () => {
  const slim = ALL.filter((r) => /--fd-bar:\s*calc\(51px/.test(r.body));
  assert.equal(slim.length, 1, 'the slim phone bar rule is gone or doubled');
  assert.equal(slim[0]!.media.trim(), `@media (max-width: ${TAB_PX - 0.02}px)`, `the slim phone bar ends at "${slim[0]!.media}", not under ${TAB_PX}`);
  const mark = ALL.filter((r) => r.sel.trim() === ".fd[data-chrome='app'] .fd-mark" && /display:\s*block/.test(r.body));
  assert.equal(mark.length, 1);
  assert.equal(mark[0]!.media.trim(), `@media (max-width: ${TAB_PX - 0.02}px)`, 'the mark-for-word swap and the slim bar switch at different widths');
  assert.doesNotMatch(CSS, /@media \(max-width: 767\.98px\)/, 'a 768 phone/tablet switch is back in the shell stylesheet');
});

test('5 · the five pages\' thumb docks take their desktop place from the same line', () => {
  const mod = (rel: string) => rules(read(rel)).filter((r) => r.sel.trim() === '.lower' && /min-width/.test(r.media));
  for (const rel of [
    'app/dashboard/[eventId]/guests/_components/guests-screen.module.css',
    'app/dashboard/[eventId]/budget/_components/budget-page.module.css',
    // The supplier dashboard took the same line (2026-10-23): every supplier page's thumb row is this one module.
    'app/vendor-dashboard/_components/supplier-thumb-row.module.css',
  ]) {
    const desk = mod(rel);
    assert.equal(desk.length, 1, `${rel}: expected one desktop .lower rule`);
    assert.equal(desk[0]!.media.trim(), `@media (min-width: ${TAB_PX}px)`, `${rel}: the dock leaves the phone bar at "${desk[0]!.media}"`);
  }
  for (const rel of [
    'app/dashboard/[eventId]/vendors/_components/find-thumb-row.tsx',
    'app/dashboard/[eventId]/vendors/_components/build-body.tsx',
    'app/dashboard/[eventId]/vendors/_components/build-cart.tsx',
  ]) {
    const src = read(rel);
    assert.match(src, /\btab:bottom-/, `${rel}: the dock has no tab: desktop place`);
    assert.doesNotMatch(src, /\blg:(?:bottom|left|right|inset-x|w)-/, `${rel}: a dock still takes its desktop place at lg`);
    assert.doesNotMatch(src, /\bmax-lg:/, `${rel}: a phone-only clearance still ends at lg`);
  }
  assert.match(
    read('app/dashboard/[eventId]/studio/panood/broadcast/control-room.tsx'),
    /bottomNavVisible: !window\.matchMedia\(`\(min-width: \$\{BREAKPOINTS\.tab\}px\)`\)\.matches/,
    'the control room still subtracts a bottom bar the event tree no longer draws',
  );
});
