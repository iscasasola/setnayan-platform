/**
 * GUARD — the four facts never invent a number.
 *
 * `WhereYouStand` answers the first question a person asks on opening Papic:
 * where do I stand? It reads three counts and a credit balance. **Every one of
 * them must fail to an em dash, never to `0`.**
 *
 * 🚨 WHY THIS IS THE RULE AND NOT A PREFERENCE. A failed read that renders
 * "Empty — yours to start" tells a couple their wedding photographs are gone.
 * It is the most alarming sentence this strip can produce, and a network blip
 * is enough to produce it. There is no user-visible difference between "we
 * could not read it" and "there is nothing there" unless the code makes one.
 *
 * 🔑 SUPABASE DOES NOT THROW ON A FAILED READ — it resolves with `{ error }`.
 * So a `try/catch` around one of these is decoration, and the only real check
 * is an explicit `.error` test per read.
 *
 * 🔑 `{ count }` IS A DIFFERENT SHAPE FROM `{ data }`. A guard written for
 * `data` cannot see a count read fail. In this repo an invented zero has
 * already triggered a WRITE; here it would only mislead, which is bad enough.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE = join(PAPIC_DIR, 'page.tsx');

// ⚠ THE READS AND THE RENDER LIVE IN TWO FILES NOW, AND THE RULES FOLLOWED THEM
// RATHER THAN BEING RELAXED. On 2026-08-28 the four facts moved onto the dark
// stage, and the counts behind them moved into one shared reader because the
// stage needs the same answer ("is the library empty?") that the strip reports.
// Two components counting the same thing is a definition twice.
//
// So: the READ rules below are asserted against the reader, and the RENDER rules
// against the stage. Neither was dropped — check both files before concluding
// this guard got easier.
const READER = join(PAPIC_DIR, '..', '..', '..', '..', '..', 'lib', 'papic-standings.ts');
const STAGE = join(PAPIC_DIR, '_components/papic-stage.tsx');
const READS = readFileSync(READER, 'utf8');
const SRC = readFileSync(STAGE, 'utf8');

/** The reads this strip makes, derived from the source rather than typed here. */
function countReads(): string[] {
  return [...READS.matchAll(/(\w+)\s*=\s*await Promise\.all|from\('([a-z_]+)'\)/g)]
    .map((m) => m[2])
    .filter((t): t is string => !!t);
}

test('the strip still makes its reads — otherwise every rule below is vacuous', () => {
  const tables = countReads();
  assert.ok(
    tables.length >= 3,
    `expected at least 3 table reads in the facts strip, found ${tables.length}: ${tables.join(', ')}`,
  );
});

test('🚨 every count read checks its own error explicitly', () => {
  // One `if (xRes.error)` per read result. A catch cannot see a Supabase
  // rejection, so this is the only check that exists.
  const results = /const \[([^\]]+)\]\s*=\s*await Promise\.all/.exec(READS)?.[1];
  assert.ok(results, 'the Promise.all destructure is gone — the reads were restructured');
  const names = results
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.endsWith('Res'));
  assert.ok(names.length >= 3, `expected 3+ *Res results, found ${names.join(', ') || 'none'}`);
  const unchecked = names.filter((n) => !new RegExp(`if \\(${n}\\.error\\)`).test(READS));
  assert.deepEqual(unchecked, [], `these reads never check their error: ${unchecked.join(', ')}`);
});

test('🚨 a failed read resolves to null, never to a number', () => {
  for (const [value, guard] of [
    ['cameras', 'seatRes.error'],
    ['inLibrary', 'photoRes.error || guestRes.error'],
  ] as const) {
    // ⚠ MATCH THE RULE, NOT ONE SYNTAX. These were `const cameras = …;` while
    // the strip did its own reads; the shared reader returns them as fields of
    // one object (`cameras: …,`). Same rule, same fallback, different
    // expression — a guard that only knows one spelling reports a defect that
    // is not there, which this repo has paid for more than once.
    const line =
      new RegExp(`const ${value}\\s*=[\\s\\S]{0,160}?;`).exec(READS)?.[0] ??
      new RegExp(`\\b${value}:[\\s\\S]{0,160}?,\\n`).exec(READS)?.[0] ??
      '';
    assert.ok(line.includes(guard), `${value} no longer branches on ${guard}`);
    assert.ok(
      /\?\s*null/.test(line),
      `${value} falls back to something other than null on a failed read — a number here is a lie a couple will believe`,
    );
  }
  assert.ok(
    /\bcredits\s*[:=][\s\S]{0,140}?pool\.ok[\s\S]{0,140}?:\s*null/.test(READS),
    'credits no longer resolves to null when the pool read fails',
  );
});

test('🚨 an unmeasured fact renders a dash, and 0 is only ever a real 0', () => {
  assert.ok(SRC.includes('function Unmeasured()'), 'the Unmeasured fallback is gone');
  const uses = SRC.split('<Unmeasured />').length - 1;
  assert.ok(uses >= 3, `only ${uses} facts fall back to a dash — every read needs one`);
  // The empty-library sentence must sit behind an explicit `=== 0`, never behind
  // a falsy check that a null would also satisfy.
  assert.ok(
    /inLibrary === 0 \?/.test(SRC),
    '"Empty — yours to start" is no longer gated on an exact 0 — a null would render it, telling a couple their photographs are gone',
  );
});

/**
 * The blocks that TELL A COUPLE WHERE THEY STAND, as opposed to asking them to
 * decide something. Only these may lead a phase.
 *
 * - `credits` is the running credit balance and what it buys.
 * - `gallery` carries `<PapicStage>` — the facts strip, on the thing it describes.
 *
 * Everything else (dates, guests, filter, challenges, wall, kwento, made, more)
 * opens by asking for a decision.
 */
const STANDING_BLOCKS = new Set(['credits', 'gallery']);

/** `BLOCK_ORDER[phase]` as it is written in the page, block → N from `order-N`. */
function phaseOrder(phase: 'before' | 'after'): Record<string, number> {
  const page = readFileSync(PAGE, 'utf8');
  const block = page.match(new RegExp(`${phase}:\\s*\\{([^}]*)\\}`));
  assert.ok(block, `BLOCK_ORDER.${phase} is gone — this guard has lost the mechanism it reads`);
  const out: Record<string, number> = {};
  for (const e of block[1]!.matchAll(/(\w+):\s*'order-(\d+)'/g)) out[e[1]!] = Number(e[2]);
  assert.ok(
    Object.keys(out).length >= 8,
    `only ${Object.keys(out).length} blocks parsed out of BLOCK_ORDER.${phase} — ` +
      'the map changed shape and this guard would judge a fragment of the page',
  );
  return out;
}

test('a person is told where they stand before anything asks them to decide', () => {
  // ⚠ RE-POINTED 2026-09-22. THE OLD FORM COMPARED `indexOf` POSITIONS IN THE
  // SOURCE, and it had already been re-anchored once before that ("this used to
  // read 'above the rooms'"). It cannot work on this page any more: the ten
  // blocks are children of one `flex flex-col` section and carry `order-1..10`
  // from `${ord(key)}`, so **DOM order is not visual order here**. A source-order
  // assertion encodes a sequence nobody sees.
  //
  // 🔑 AND THE RULE ITSELF WAS NEVER ABOUT THE STAGE. It is: a person is told
  // where they stand BEFORE anything asks them to decide. The owner reordered
  // the page on 2026-09-22 — *"the top one needs to be the credits purchase and
  // running credits / Then Coverage / Then alotment"* — which means before the
  // event the leading block is the running balance, not the facts strip. The
  // property holds; the block carrying it changed. So this asserts the PROPERTY
  // against the real mechanism, per phase, rather than pinning one component to
  // one position.
  const page = readFileSync(PAGE, 'utf8');
  assert.ok(page.indexOf('<PapicStage') > 0, 'the stage is not mounted');

  for (const phase of ['before', 'after'] as const) {
    const order = phaseOrder(phase);

    // A duplicate `order-1` would give the phase two leaders and let a decision
    // block share the top slot with a standing one.
    const slots = Object.values(order);
    assert.equal(
      new Set(slots).size,
      slots.length,
      `BLOCK_ORDER.${phase} assigns the same order-N twice — the phase has no single first block`,
    );

    const leader = Object.entries(order).sort((a, b) => a[1] - b[1])[0]!;
    assert.ok(
      STANDING_BLOCKS.has(leader[0]),
      `in the "${phase}" phase the page opens on "${leader[0]}" (order-${leader[1]}), which asks ` +
        'the couple to decide something before telling them where they stand. Only ' +
        `${[...STANDING_BLOCKS].join(' or ')} may lead a phase.`,
    );
  }
});

test('the two phases are not the same order — the page really does rearrange', () => {
  // If a bad merge collapsed both maps to one, the guard above would still pass
  // while the page stopped responding to the day entirely.
  const before = phaseOrder('before');
  const after = phaseOrder('after');
  assert.notDeepEqual(
    before,
    after,
    'BLOCK_ORDER.before and .after are identical — the page no longer rearranges around the event',
  );
});

test('the attention colour is the one that passes in BOTH themes', () => {
  assert.ok(!SRC.includes('mulberry-700'), 'mulberry-700 is 3.05:1 on a dark panel — a fail a light-only check waves through');
});
