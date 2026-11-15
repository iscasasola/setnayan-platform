/**
 * app-colours.test.ts — 🎨 ADMIN › COLOURS: THE RULES THE EDITOR SHOWS AND THE SERVER ENFORCES (owner 12 Nov 2026;
 * corpus Design_App_Colours_2026-11-12).
 *
 *   (1) NOTHING SAVED = NOTHING MOVES. Every default is the value globals.css paints today, and the default set emits
 *       no stylesheet at all.
 *   (2) A saved set paints light mode only, and hands the guest Event Hub back today's values.
 *   (3) A stored value fails toward its own default, field by field; a SUBMITTED one names what is wrong.
 *   (4) The gate: unreadable words refuse Save, two filled button kinds that look alike refuse Save, a toggle that
 *       matches a button only warns, and every mood the page offers can be saved.
 *   (5) Every "Use …" fix produces a set whose own check passes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APP_COLOURS_DEFAULT,
  MOODS,
  appColoursToCss,
  appColourTokens,
  applyFix,
  derive,
  invalidAppColourFields,
  isDefaultAppColours,
  judgeAppColours,
  lightestPoint,
  parseAppColours,
  readabilityChecks,
  wcagRatio,
  type AppColours,
} from './app-colours';

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const ROOT = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('html.dark {'));
const rootVar = (name: string): string => {
  const m = new RegExp(`\\n\\s*${name}:\\s*([^;]+);`).exec(ROOT);
  assert.ok(m, `${name} is not declared in the light :root block`);
  return m[1]!.trim();
};
const tripleOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
const mood = (id: string) => MOODS.find((m) => m.id === id)!.colours;

test('(1) every default is what globals.css paints today', () => {
  const d = APP_COLOURS_DEFAULT;
  assert.equal(rootVar('--sn-page-bg'), tripleOf(d.page));
  assert.equal(rootVar('--color-ok'), tripleOf(d.money));
  assert.equal(rootVar('--color-mulberry'), tripleOf(d.decision));
  assert.equal(rootVar('--color-mulberry'), tripleOf(d.toggle), 'today the toggle IS the decision colour');
  assert.equal(rootVar('--sn-accent'), 'var(--color-mulberry)');
  assert.equal(rootVar('--color-private'), tripleOf(d.private));
  assert.equal(rootVar('--color-private-text'), tripleOf(derive.privateText(d.private)));
  assert.equal(rootVar('--color-private-tint'), tripleOf(derive.privateTint(d.private)));
  assert.equal(rootVar('--color-mulberry-600'), tripleOf(derive.decisionHover(d.decision)));
  assert.equal(rootVar('--color-mulberry-700'), tripleOf(derive.decisionWord(d.decision)));
  for (const [k, hex] of Object.entries(d.tiles)) assert.equal(rootVar(`--sn-cat-${k}`), tripleOf(hex), `tile ${k}`);
  // The tokens a later wave reads are declared with the same defaults the setting holds.
  const t = appColourTokens(d);
  for (const k of ['--sn-band-from', '--sn-band-to', '--sn-band-angle', '--sn-on-band', '--sn-frame-bg', '--sn-frame-radius', '--sn-frame-shadow']) {
    assert.equal(rootVar(k), t[k], k);
  }
});

test('(1) nothing saved, or a saved set equal to today, writes no stylesheet', () => {
  assert.equal(appColoursToCss(parseAppColours(null)), '');
  assert.equal(appColoursToCss(APP_COLOURS_DEFAULT), '');
  assert.equal(appColoursToCss(mood('current')), '');
  assert.ok(isDefaultAppColours(parseAppColours({})));
});

test('(2) a saved set paints light mode only and gives the guest islands back today', () => {
  const ocean = mood('ocean');
  const css = appColoursToCss(ocean);
  assert.ok(css.startsWith('html:not(.dark){'), 'the set is not scoped to light mode');
  assert.doesNotMatch(css, /html\.dark/);
  const set = /^html:not\(\.dark\)\{([^}]*)\}/.exec(css)![1]!;
  assert.match(set, new RegExp(`--sn-decision:${tripleOf(ocean.decision)}(;|$)`));
  assert.match(set, new RegExp(`--sn-accent:${tripleOf(ocean.toggle)}(;|$)`));
  assert.match(set, new RegExp(`--color-ok:${tripleOf(ocean.money)}(;|$)`));
  const island = /:where\(([^{]*\.sn-editorial[^{]*)\)\{([^}]*)\}/.exec(css);
  assert.ok(island, 'the guest Event Hub is not handed back its colours');
  assert.match(island[2]!, /--sn-decision:initial/, 'inside a guest island the decision must fall back, not be the house terracotta');
  assert.match(island[2]!, new RegExp(`--sn-accent:${tripleOf(APP_COLOURS_DEFAULT.toggle)}(;|$)`));
  assert.match(island[2]!, new RegExp(`--color-ok:${tripleOf(APP_COLOURS_DEFAULT.money)}(;|$)`));
  // Only parsed hexes reach the stylesheet — a smuggled value cannot close the tag.
  const evil = appColoursToCss(parseAppColours({ ...ocean, page: '#fff}</style><script>' }));
  assert.doesNotMatch(evil, /[<>]|script/);
});

test('(3) a stored value fails toward its own default, field by field', () => {
  const p = parseAppColours({ money: 'not a colour', decision: '#6b3fa0', frameRadius: 99, bandAngle: 'sideways', tiles: { asked: 12 } });
  assert.equal(p.money, APP_COLOURS_DEFAULT.money);
  assert.equal(p.decision, '#6B3FA0');
  assert.equal(p.frameRadius, APP_COLOURS_DEFAULT.frameRadius);
  assert.equal(p.bandAngle, APP_COLOURS_DEFAULT.bandAngle);
  assert.equal(p.tiles.asked, APP_COLOURS_DEFAULT.tiles.asked);
  assert.deepEqual(parseAppColours('nonsense'), parseAppColours(null));
});

test('(3) a submitted set names every malformed field', () => {
  assert.deepEqual(invalidAppColourFields(APP_COLOURS_DEFAULT), []);
  const bad = invalidAppColourFields({ ...APP_COLOURS_DEFAULT, money: 'green', frameRadius: 3, tiles: { ...APP_COLOURS_DEFAULT.tiles, booked: '' } });
  assert.deepEqual(bad.sort(), ['frameRadius', 'money', 'tiles.booked']);
});

test('(4) every mood the page offers can be saved', () => {
  for (const m of MOODS) assert.deepEqual(judgeAppColours(m.colours).refusals, [], `${m.name} is refused`);
});

test('(4) words that would not read refuse Save', () => {
  const v = judgeAppColours({ ...APP_COLOURS_DEFAULT, decision: '#F5C7B5' });
  assert.ok(v.refusals.some((r) => r.startsWith('Decision button: white words on it')), v.refusals.join(' | '));
  // A pale band stop is measured at the lightest point of the blend.
  const band: AppColours = { ...APP_COLOURS_DEFAULT, bandFrom: '#1E3A9E', bandTo: '#9AD7FF' };
  assert.equal(lightestPoint(band.bandFrom, band.bandTo), '#9AD7FF');
  assert.ok(judgeAppColours(band).refusals.some((r) => r.startsWith('Header band')));
});

test('(4) two filled button kinds that look alike refuse Save; a toggle that matches only warns', () => {
  const alike = judgeAppColours({ ...APP_COLOURS_DEFAULT, money: '#C9471A' }); // money ≈ the decision terracotta
  assert.ok(alike.refusals.some((r) => /look the same/.test(r)), alike.refusals.join(' | '));
  const today = judgeAppColours(APP_COLOURS_DEFAULT);
  assert.ok(today.lookAlikes.some((l) => l.a === 'decision' && l.b === 'toggle' && !l.refuses), 'toggle = decision should only warn');
  assert.deepEqual(today.refusals, []);
});

test('(5) every offered fix passes the check it was offered for', () => {
  const broken: AppColours = {
    ...APP_COLOURS_DEFAULT,
    page: '#3A3A3A',
    bandFrom: '#FFE9A8',
    bandTo: '#FFFFFF',
    frameFill: '#555555',
    money: '#9BE7B4',
    decision: '#FFD0C0',
    private: '#CDEBFF',
    toggle: '#FFE0F0',
    tiles: { booked: '#E8FFF0', schedule: '#EAF2FF', asked: '#FFF0E8', collect: '#FFEAF6' },
  };
  const failing = readabilityChecks(broken).filter((c) => !c.pass && !c.soft);
  assert.ok(failing.length >= 8, `expected many failures, got ${failing.length}`);
  for (const ch of failing) {
    assert.ok(ch.fix, `${ch.job} · ${ch.label} offers no fix`);
    const after = readabilityChecks(applyFix(broken, ch.fix)).find((c) => c.job === ch.job && c.label === ch.label)!;
    assert.ok(after.pass, `${ch.job} · ${ch.label}: the offered fix still reads ${after.ratio.toFixed(2)}:1`);
  }
});

test('the measured pairs the comments quote', () => {
  assert.ok(Math.abs(wcagRatio('#FFFFFF', '#C24E25') - 4.76) < 0.01);
  assert.ok(Math.abs(wcagRatio('#FFFFFF', '#2B744A') - 5.68) < 0.02);
});
