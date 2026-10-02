/**
 * shown-values.test.ts — the SHOWN-VALUES check (Root map part 2, slice 5).
 *
 * Both sides: "190 days to go" typed into a screen IS a finding and
 * `{days} days to go` is NOT; a rule constant ("within 7 days", "0%
 * commission", "₱0") is NOT; a sample file is NOT scanned; and one
 * calculation drawn by two components on one screen IS a duplicate while the
 * same calculation on two different screens is NOT.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { renderedTextIn, scanShownValues, typedNumbersIn } from './scan-shown-values';
import { scanScreens } from './scan-screens';

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ugat-shown-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

test('a typed number next to a unit is found; a variable and a rule are not', () => {
  assert.deepEqual(typedNumbersIn('190 days to go'), ['190 days']);
  assert.deepEqual(typedNumbersIn('# days to go'), [], 'a run-time value');
  assert.deepEqual(typedNumbersIn('Reply within 7 days'), []);
  assert.deepEqual(typedNumbersIn('0% commission, ever'), []);
  assert.deepEqual(typedNumbersIn('Free — ₱0, forever.'), []);
  assert.deepEqual(typedNumbersIn('34 changes · 52%'), ['52%']);
  assert.deepEqual(typedNumbersIn('Pair a DSLR — ₱100 / seat / day'), ['₱100']);
  assert.deepEqual(renderedTextIn('<p className="w-[50%]">{n} guests</p>'), ['guests'], 'the class name is skipped; the words after a variable are read');
  assert.deepEqual(typedNumbersIn('guests'), [], '…and carry no typed number');
  assert.deepEqual(renderedTextIn('<input placeholder="₱ 680,000" />'), [], 'a placeholder is never a value');
});

const page = (body: string, imports = '') => `${imports}\nexport default function P() { return (<main>${body}</main>); }\n`;

test('the scan: typed numbers per file; duplicates per screen', () => {
  const root = fixture({
    'app/page.tsx': page('<a href="/home">h</a><a href="/other">o</a>'),
    'app/home/page.tsx': page('<Hero /><Tile />', "import { Hero } from './_c/hero';\nimport { Tile } from './_c/tile';"),
    'app/home/_c/hero.tsx': `export function Hero() { const d = daysUntil(x); return <p>{d} days to go</p>; }\n`,
    'app/home/_c/tile.tsx': `export function Tile() { return <p><b>190</b> days to go</p>; }\n`,
    'app/other/page.tsx': page('<p>{daysUntil(x)} days to go</p>'),
    'app/home/_c/sample-card.tsx': `export const S = () => <p>128 guests</p>;\n`,
  });
  const screens = scanScreens({ webRoot: root, builders: new Map(), tableNodes: new Map() });
  const f = scanShownValues({ webRoot: root, screens });
  const typed = f.filter((x) => x.check === 'typed-number').map((x) => x.key);
  assert.deepEqual(typed, [], '<b>190</b> is split from its unit by markup — named as a limit in the report');
  const dup = f.filter((x) => x.check === 'duplicate').map((x) => x.key);
  assert.deepEqual(dup, ['/home shows days-to-go'], 'two components on Home; /other draws it once');
});

test('the scan finds a sentence with the number typed in it', () => {
  const root = fixture({
    'app/page.tsx': page('<a href="/home">h</a>'),
    'app/home/page.tsx': page('<p>Only 190 days to go!</p><p>{n} guests</p>'),
  });
  const screens = scanScreens({ webRoot: root, builders: new Map(), tableNodes: new Map() });
  const f = scanShownValues({ webRoot: root, screens }).filter((x) => x.check === 'typed-number');
  assert.deepEqual(f.map((x) => x.key), ['app/home/page.tsx "Only 190 days to go!"']);
  assert.deepEqual(f[0]!.screens, ['/home']);
});
