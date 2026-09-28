/**
 * GUARD — a retired feature name never reaches a screen again.
 *
 * Owner, 2026-09-29: *"Change pakanta to Music Maker."* · *"Only Papic is
 * customized and all other namings should be generic"* · *"Samahan - Group"* ·
 * *"Ala ala - Memories"* · Alaga → *"Loved ones"*. Papic and Patiktok keep
 * their names (DECISION_LOG "PATIKTOK KEEPS ITS NAME").
 *
 * The rename was of WORDS, not identifiers: `/studio/pakanta`, `samahan_stories`,
 * the `PAKANTA` SKU, `lib/alaala-wall.ts` and `kind === 'alaga'` all stay, so
 * old links keep working. That is exactly why a plain grep cannot hold this
 * line — ~2,000 legitimate identifier hits would drown the one label that
 * slips back. `retired-names-scan.ts` decides per OCCURRENCE by AST position
 * (JSX text · prose literal · bare Title-case label) and says why.
 *
 * ⚠ ITS SUBJECT LIST IS DERIVED, NOT ENUMERATED — it walks every .ts/.tsx under
 * app/ lib/ components/. The next screen is never on a hand-written list.
 *
 * 🪤 EVERY PART OF THIS GUARD IS PROVEN TO BITE BEFORE IT IS TRUSTED: the
 * scanner is run over known-visible and known-code fixtures first, and the
 * walk asserts it actually read the files that carry the most identifier hits.
 * A scanner that matches nothing passes forever and reads exactly like success.
 *
 * To retire another name (Panood is pending the owner): add ONE row to
 * `RETIRED_NAMES` in `retired-names-scan.ts`, then fix what this prints.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RETIRED_NAMES, scanRetiredNames } from './retired-names-scan';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'lib', 'components'];

/**
 * Files exempt BY REASON, never by convenience:
 *  - the retired-name list itself has to spell the old names;
 *  - `*.generated.ts` is derived from identifiers (`deliverPakantaSong` →
 *    "deliver pakanta song") by its own generator and drift guard.
 */
const EXEMPT = new Set(['lib/retired-names-scan.ts']);
const isExempt = (rel: string) => EXEMPT.has(rel) || rel.endsWith('.generated.ts');

function* sources(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith('.d.ts')) yield p;
  }
}

test('the scanner flags a retired name where a person reads it', () => {
  const visible = [
    ['a.tsx', `export const A = () => <h1>Pakanta</h1>;`],
    ['b.tsx', `export const B = () => <p>Create a samahan for your barkada</p>;`],
    ['c.ts', `export const t = { title: 'Pakanta' };`],
    ['d.ts', `export const t = 'Your Alaala gathers as you go';`],
    ['e.ts', "export const t = (n: string) => `Welcome to ${n}'s Samahan`;"],
    ['f.ts', `export const t = { label: 'Add an alaga' };`],
    ['g.ts', `export const t = 'Ala Ala memory hub';`],
    ['h.tsx', `export const H = () => <img alt="Pakanta — your song" />;`],
  ] as const;
  for (const [file, src] of visible) {
    assert.ok(scanRetiredNames(file, src).length >= 1, `scanner missed a visible name in: ${src}`);
  }
});

test('the scanner leaves identifiers, routes, keys and SKU codes alone', () => {
  const code = [
    `import { x } from '@/lib/pakanta-brief';`,
    `export const r = '/dashboard/samahan/new';`,
    `export const s = "event_id, pakanta_song_r2_key, pakanta_song_status";`,
    `export const k = { key: 'samahan', kind: 'alaga' };`,
    `export const sku = 'PAKANTA';`,
    `export const c = 'alaala-orb-glow';`,
    `export const n = 'admin.sidebar.pakanta';`,
    `// Pakanta is mentioned in a comment only`,
    `export const l = () => console.warn('[samahan-stories] refused a story');`,
    `export const p = 'Patiktok booth';`,
    `export const q = 'Papic camera';`,
  ];
  for (const src of code) {
    assert.deepEqual(scanRetiredNames('x.tsx', src), [], `scanner flagged code as copy: ${src}`);
  }
});

test('the retired list is the owner-named set, and keeps Papic + Patiktok', () => {
  const was = RETIRED_NAMES.map((n) => n.was).sort();
  assert.deepEqual(was, ['Alaala', 'Alaga', 'Pakanta', 'Samahan']);
  for (const kept of ['Papic', 'Patiktok']) {
    assert.deepEqual(
      scanRetiredNames('k.tsx', `export const K = () => <p>${kept}</p>;`),
      [],
      `${kept} keeps its name (owner 2026-09-29) — it must never be retired here`,
    );
  }
  const now = Object.fromEntries(RETIRED_NAMES.map((n) => [n.was, n.now]));
  assert.equal(now.Pakanta, 'Music Maker', 'brand: "Music Maker", two capitalised words');
});

test('no retired feature name is left on any screen', () => {
  const findings: string[] = [];
  let scanned = 0;
  let pakantaFiles = 0;
  for (const root of ROOTS) {
    for (const file of sources(join(WEB, root))) {
      const rel = relative(WEB, file);
      if (isExempt(rel)) continue;
      const src = readFileSync(file, 'utf8');
      scanned += 1;
      if (/pakanta/i.test(src)) pakantaFiles += 1;
      for (const f of scanRetiredNames(file, src)) {
        findings.push(`${rel}:${f.line}  "${f.was}" → say "${f.now}"  ·  ${f.text}`);
      }
    }
  }
  // Anchors: the walk read the tree, and read the files that carry the old
  // spelling as identifiers — so a zero below is a real zero.
  assert.ok(scanned > 1000, `walked only ${scanned} files — the tree walk is broken`);
  assert.ok(pakantaFiles > 20, `only ${pakantaFiles} files mention pakanta at all — wrong tree?`);
  assert.deepEqual(
    findings,
    [],
    `A retired feature name is back on a screen (owner 2026-09-29: only Papic ` +
      `and Patiktok keep custom names). Change the WORD, never the identifier:\n  ` +
      findings.join('\n  '),
  );
});
