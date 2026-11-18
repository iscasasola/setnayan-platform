/**
 * 🎆 THE TAP SHOWS, HELD TO THE OWNER'S FINAL RULINGS (15 Nov; approved prototype
 * `Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v86.html`, `bzOpen` → `gunFire` · `giftShow` ·
 * `calShow` · `starShow` · `trustShow`).
 *
 *   1 · Gifts given and Invites throw 5, 10, 15, 20, 25, 30, 35 pieces, Bronze → Black Diamond;
 *   2 · Trusted by pulses once per tier step (1 … 7); Five-star reviews throws nothing;
 *   3 · Completed bookings counts each tier's exact pages, and the last page stays;
 *   4 · gift tickets are cut in the badge's own metal (7 metals) — never the reward-ticket art;
 *   5 · no time limit: no forced timer, no fade, no early pull-down on a thrown piece;
 *   6 · lazy: reached only through `import()`, never a value export of the kit's door;
 *   7 · reduced motion plays nothing.
 *
 * 🪤 Same harness as `award-kit.test.ts`: DYNAMIC imports; `.css` modules stubbed (each class name maps to itself).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request.endsWith('.css')) return new Proxy({}, { get: (_o, k) => (k === '__esModule' ? false : String(k)) });
    return load.call(this, request, ...rest);
  };
}

const DIR = __dirname;
const code = (f: string) => stripComments(readFileSync(join(DIR, f), 'utf8'));

test('1 · Gifts given and Invites throw 5, 10, 15, 20, 25, 30, 35 (Bronze → Black Diamond)', async () => {
  const { throwCount, tapShowPieces, THROW_COUNTS } = await import('./tap-shows');
  assert.deepEqual([...THROW_COUNTS], [5, 10, 15, 20, 25, 30, 35]);
  for (const fam of ['giftbox', 'invite'] as const) {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 7].map((t) => tapShowPieces(fam, t).thrown),
      [5, 10, 15, 20, 25, 30, 35],
      fam,
    );
  }
  assert.equal(throwCount(0), 5, 'clamped low');
  assert.equal(throwCount(99), 35, 'clamped high');
});

test('2 · Trusted by pulses 1 … 7 (no hits, no cards); Five-star reviews throws NOTHING', async () => {
  const { tapShowPieces, trustPulses } = await import('./tap-shows');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(trustPulses), [1, 2, 3, 4, 5, 6, 7]);
  for (let t = 1; t <= 7; t++) {
    assert.deepEqual(tapShowPieces('shield', t), { thrown: 0, pulses: t, pages: 0 });
    assert.deepEqual(tapShowPieces('bubble', t), { thrown: 0, pulses: 0, pages: 0 });
  }
  // the old handshake cards and the thrown stars are gone from the source
  const src = code('tap-shows.ts');
  assert.ok(!/TRUST_SVG|STAR_SVG/.test(src), 'no handshake cards, no thrown stars');
});

test('3 · Completed bookings: each tier counts exactly as ruled, and the last page stays', async () => {
  const { calendarPages, calendarLabel, tapShowPieces } = await import('./tap-shows');
  const want = [
    [1, 2, 3, 4, 5],
    [5, 10, 15, 20, 25],
    [25, 30, 35, 40, 45, 50],
    [50, 60, 70, 80, 90, 100],
    [100, 150, 200, 250],
    [250, 300, 350, 400, 450, 500],
    [500, 600, 700, 800, 900, 1000],
  ];
  want.forEach((w, i) => {
    assert.deepEqual(calendarPages(i + 1), w, `tier ${i + 1}`);
    // one torn page per step: the first number is on the badge at open and the LAST page is never torn
    assert.equal(tapShowPieces('calendar', i + 1).pages, w.length - 1);
  });
  assert.equal(calendarLabel(1000), '1k');
  assert.equal(calendarLabel(500), '500');
  const src = code('tap-shows.ts');
  assert.match(src, /vals\.slice\(1\)/, 'pages tear for every value after the first');
  assert.match(src, /STEP = 420/, 'a page about every 0.4 s');
  assert.match(src, /duration: 1600/, 'each page glides away over 1.6 s');
});

test('4 · gift tickets are cut in the badge’s own metal — 7 metals, never the reward-ticket art', async () => {
  const { TICKET_METALS, giftTicketSvg } = await import('./tap-shows');
  assert.equal(TICKET_METALS.length, 7);
  assert.equal(new Set(TICKET_METALS.map((m) => m.join())).size, 7, 'each tier has its own metal');
  for (let t = 1; t <= 7; t++) {
    const svg = giftTicketSvg(t);
    for (const c of TICKET_METALS[t - 1]!) assert.ok(svg.includes(c), `tier ${t} uses ${c}`);
    assert.ok(svg.includes('>POINTS</text>'), 'POINTS');
    assert.match(svg, /stroke-dasharray="3 3"/, 'the torn stub');
    assert.match(svg, /translate\(20 30\)/, 'the gift mark');
  }
  const src = code('tap-shows.ts');
  assert.ok(!/ticket-svg|TICKET_SPECS|reward-ticket/.test(src), 'no reward-ticket art for thrown tickets');
  assert.match(src, /duration: 3600/, 'the lid takes its full 3.6 s');
});

test('5 · no time limit: no forced end, no fade, no early pull-down on a thrown piece', () => {
  const src = code('tap-shows.ts');
  assert.ok(!/30000|\bEND\b|\.end\b/.test(src), 'no end-of-show deadline');
  assert.ok(!/style\.opacity/.test(src), 'nothing fades a thrown piece');
  assert.ok(!/innerHeight \* 5|2600/.test(src), 'no hard pull-down');
  // a thrown piece is removed only once it has left the screen
  assert.match(src, /c\.y > H \+ 80/);
  const css = code('tap-shows.module.css');
  const cardRules = css.split('}').filter((r) => /\.card/.test(r));
  assert.ok(cardRules.length > 0);
  for (const r of cardRules) {
    assert.ok(!/opacity:\s*0\s*[;}]?$|opacity:\s*0;/.test(r), 'a card never goes to opacity 0');
    assert.ok(!/animation/.test(r), 'no CSS fade on a card');
  }
  assert.ok(!/border-radius:\s*\d/.test(css), 'radii ride the --m-r-* scale');
});

test('6 · lazy: badge-fullscreen reaches tap-shows only via import(); the kit door exports no value from it', () => {
  const bf = code('badge-fullscreen.tsx');
  assert.ok(/import\('\.\/tap-shows'\)/.test(bf), 'the full screen fetches the show on open');
  assert.ok(!/from '\.\/tap-shows'/.test(bf), 'no static import');
  const idx = code('index.ts');
  const lines = idx.split('\n').filter((l) => l.includes('tap-shows'));
  for (const l of lines) assert.match(l, /export type /, 'only types may cross the door');
  for (const f of ['seal-plaque.tsx', 'verified-fullscreen.tsx', 'reward-ticket.tsx', 'locked-tile.tsx']) {
    assert.ok(!code(f).includes("'./tap-shows'"), `${f} does not reach tap-shows`);
  }
  assert.ok(!/fetch\(|'use server'|navigator\.sendBeacon/.test(code('tap-shows.ts')), 'no server, no fetch');
});

test('7 · reduced motion plays nothing (and touches nothing)', async () => {
  const { playTapShow, primeTapShow, TAP_FAMILIES } = await import('./tap-shows');
  const trap = new Proxy({}, { get: () => assert.fail('the show touched the page under reduced motion') });
  for (const family of TAP_FAMILIES) {
    const stop = playTapShow({
      family,
      tier: 7,
      svg: trap as SVGSVGElement,
      host: trap as HTMLElement,
      under: trap as Element,
      pulse: trap as HTMLElement,
      sz: 300,
      cx: 200,
      cy: 300,
      alive: () => true,
      reducedMotion: true,
    });
    assert.equal(typeof stop, 'function');
    stop();
    primeTapShow(family, 7, trap as SVGSVGElement, true);
  }
  const bf = code('badge-fullscreen.tsx');
  // the full screen asks for a show only on the moving path, and hands the reduced-motion read through
  assert.match(bf, /reducedMotion: rm\.current/);
  const landIdx = bf.indexOf("import('./tap-shows')");
  const rmIdx = bf.lastIndexOf('if (rm.current) {', landIdx);
  assert.ok(rmIdx > 0 && rmIdx < landIdx, 'the show is fetched in the else-branch of reduced motion');
});
