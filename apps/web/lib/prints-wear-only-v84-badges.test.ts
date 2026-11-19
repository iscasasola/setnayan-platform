/**
 * 🔒 NO PRINT SURFACE WEARS A RETIRED BADGE (owner 15 Nov 2026, DECISION_LOG "THE BADGES IN THE APPROVED PROTOTYPE ARE
 * THE ONLY BADGES"; art `prototypes/supplier_badges_2026-11-15/badge-milestones_v84.html`).
 *
 * A print surface — the seven prints and their Save files, the calling card, the QR door print, the tarps and posters,
 * the badges file, the door sticker's SVG and PDF, the Prints sheet that shows them — may draw a badge ONLY through
 * `printBadgesV84` → `resolvePrintBadgeArt` → `printBadgeG` / `printBadgeOps`. It may not import the retired parts:
 *
 *   · the long pill            `ShopBadgePill` (app/_components/shop-badge-pill), `badgePill` / `badgePillOps`
 *   · the round image badge    `ImageBadge` (app/_components/image-badge), `badgeImageOf` (lib/shop-badge-row)
 *   · the retired badge list   anything from lib/shop-badges but the `ShopBadgeFacts` type — `shopBadges`,
 *                              `cardBadges`, `milestoneBadge`, `verifiedBadge`, `badgesForPrint`, `ShopBadge`
 *   · the pill's materials     `TIERS` (lib/badge-tiers)
 *
 * WHICH FILES: the named surfaces below, AND every shipped file that imports a print renderer — so a new print surface
 * is held the day it is written, without anyone remembering to list it. The list is printed so a reader sees it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';

const WEB = path.join(__dirname, '..');
const read = (f: string) => readFileSync(path.join(WEB, f), 'utf8');
const files = execFileSync('git', ['ls-files', '--', 'app', 'lib'], { cwd: WEB, encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));

type Imp = { from: string; names: string[]; typeOnly: boolean };
function importsOf(src: string): Imp[] {
  const out: Imp[] = [];
  for (const m of stripComments(src).matchAll(/^\s*import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
    const names = (/\{([\s\S]*)\}/.exec(m[2]!)?.[1] ?? m[2]!).split(',').map((s) => s.trim()).filter(Boolean);
    out.push({ from: m[3]!, names, typeOnly: Boolean(m[1]) });
  }
  for (const m of stripComments(src).matchAll(/import\(\s*(?:\/\*.*?\*\/\s*)?['"]([^'"]+)['"]\s*\)/g)) out.push({ from: m[1]!, names: ['*'], typeOnly: false });
  return out;
}
const is = (from: string, mod: string) => from === `@/${mod}` || from.endsWith(`/${mod.split('/').pop()}`);

/** The print surfaces by name — what the task named: Prints, QR cards, posters, every PDF/print render. */
const NAMED = [
  'app/api/vendor/prints/route.ts', // the seven prints: card · standee · door (QR) · backdrop · tarp · roll-up · table
  'app/api/vendor/badges/route.ts', // the badges print file
  'app/api/vendor/door-sticker/route.ts', // the door/window sticker, SVG and PDF
  'app/dev/supplier-plan-lab/prints-art/[shop]/route.lab.ts', // the prints' lab twin
  'app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx', // the Prints sheet, what it shows before Save
  'lib/supplier-prints-svg.ts',
  'lib/supplier-prints-shop.ts',
  'lib/door-sticker-print.ts',
  'lib/shop-badge-print.ts',
  'lib/print-badges-v84.ts',
  'lib/print-badges-v84.server.ts',
  'lib/print-badge-art.ts',
];
/** A print renderer: whoever imports one draws a print. */
const RENDERERS = ['lib/supplier-prints-svg', 'lib/door-sticker-print', 'lib/shop-badge-print', 'lib/print-render-svg', 'lib/print-render-pdf', 'lib/print-badge-art'];
const SURFACES = [
  ...new Set([
    ...NAMED,
    ...files.filter((f) => !f.startsWith('app/dev/') && importsOf(read(f)).some((i) => !i.typeOnly && RENDERERS.some((r) => is(i.from, r)))),
  ]),
].sort();

function retiredIn(src: string): string[] {
  const bad: string[] = [];
  for (const i of importsOf(src)) {
    if (is(i.from, 'app/_components/shop-badge-pill')) bad.push(`ShopBadgePill (${i.from})`);
    if (is(i.from, 'app/_components/image-badge')) bad.push(`ImageBadge (${i.from})`);
    if (is(i.from, 'lib/shop-badge-row')) bad.push(`badge row parts (${i.from}): ${i.names.join(', ')}`);
    if (i.from === '@/lib/shop-badges' || i.from === './shop-badges') {
      const extra = i.names.filter((n) => !/^(type\s+)?ShopBadgeFacts$/.test(n));
      if (extra.length) bad.push(`retired badges (${i.from}): ${extra.join(', ')}`);
    }
    if (is(i.from, 'lib/badge-tiers') && i.names.some((n) => /^(type\s+)?TIERS\b/.test(n))) bad.push('the pill materials (TIERS)');
  }
  const code = stripComments(src);
  for (const sym of ['badgePill', 'badgePillOps', 'laurelSvg', 'pillParts', 'badgesForPrint']) if (new RegExp(`\\b${sym}\\b`).test(code)) bad.push(sym);
  return bad;
}

test('the print surfaces (named + every shipped importer of a print renderer)', () => {
  console.log(`print surfaces held (${SURFACES.length}):\n  ${SURFACES.join('\n  ')}`);
  for (const f of NAMED) assert.ok(files.includes(f), `${f} is gone — update this guard's list`);
  assert.ok(SURFACES.length >= NAMED.length);
});

test('🔒 no print surface imports a retired badge part', () => {
  const hits = SURFACES.flatMap((f) => retiredIn(read(f)).map((b) => `${f}: ${b}`));
  assert.deepEqual(hits, [], `a print surface wears a retired badge:\n${hits.join('\n')}`);
});

test('the guard bites: a print file importing the pill, the image badge or the retired list is caught', () => {
  const probe = (src: string) => retiredIn(src).length > 0;
  assert.ok(probe(`import { ShopBadgePill } from '@/app/_components/shop-badge-pill';`));
  assert.ok(probe(`import { ImageBadge } from '@/app/_components/image-badge';`));
  assert.ok(probe(`import { shopBadges, type ShopBadgeFacts } from '@/lib/shop-badges';`));
  assert.ok(probe(`const x = badgePill(b);`));
  assert.equal(probe(`import type { ShopBadgeFacts } from '@/lib/shop-badges';`), false, 'the facts type is allowed');
  assert.ok(probe(`import { TIERS } from '@/lib/badge-tiers';`));
  assert.ok(probe(`import { badgeImageOf } from '@/lib/shop-badge-row';`));
});

test('the retired print parts are gone from their modules — nothing left to import by mistake', () => {
  assert.doesNotMatch(stripComments(read('lib/shop-badges.ts')), /export function badgesForPrint\b/);
  assert.doesNotMatch(stripComments(read('lib/shop-badge-print.ts')), /export function (badgePill|badgePillOps)\b|function (pill|pillParts|laurelSvg)\b/);
});

test('the heavy seal art and the node-only resolver never reach a client file', () => {
  const client = files.filter((f) => /^\s*['"]use client['"]/.test(read(f)));
  for (const f of client) {
    for (const i of importsOf(read(f))) {
      if (i.typeOnly) continue;
      for (const m of ['lib/print-seal-art.generated', 'lib/print-seal-art', 'lib/print-badge-art', 'lib/print-badges-v84.server']) {
        assert.ok(!is(i.from, m), `${f} imports ${m} — ~270 KB of seal art / node-only code in a client bundle`);
      }
    }
  }
  const generatedImporters = files.filter((f) => f !== 'lib/print-seal-art.generated.ts' && importsOf(read(f)).some((i) => is(i.from, 'lib/print-seal-art.generated')));
  assert.deepEqual(generatedImporters, ['lib/print-seal-art.ts'], 'only the seal art module reads the generated art');
});

test('the tier pictures a print reads from disk are traced into every route that draws one', () => {
  const cfg = read('next.config.ts');
  for (const r of ['/api/vendor/prints', '/api/vendor/badges', '/api/vendor/door-sticker']) {
    const line = cfg.split('\n').find((l) => l.includes(`'${r}':`)) ?? '';
    assert.match(line, /\.\/public\/badges\/v84\/\*\.webp/, `${r} cannot read public/badges/v84 in production`);
  }
});
