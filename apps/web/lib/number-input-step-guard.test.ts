/**
 * number-input-step-guard.test.ts — a `type="number"` input whose `min` isn't
 * on its own `step` lattice silently refuses a value the seed/prefill can hand
 * it.
 *
 * ── THE BUG THIS CLOSES (2026-09-11, live test) ─────────────────────────────
 * `proposal-maker.tsx`'s pax field was `min={1} step={10}`. HTML number
 * validity is `min + k*step`, so the only values the browser will accept are
 * 1, 11, 21 … 191, 201 — every ROUND guest count (100, 150, 200) is refused,
 * and the field is SEEDED from the couple's live pax count (commit
 * 4fd6d9311c, 2026-09-09), so an ordinary 200-guest couple could never submit
 * a quote. The browser's own error — "the two nearest valid values are 191
 * and 201" — never named `min`/`step` as the cause, so this went live.
 *
 * ── WHY A REGEX OVER THE WHOLE FILE IS THE WRONG TOOL ───────────────────────
 * `proposal-maker.tsx` alone has a dozen `<input type="number">` elements.
 * A regex `/min=\{?(\d+)\}?.*?step=\{?(\d+)\}?/s` run over the whole source
 * can pair the `min` from one input with the `step` from a LATER, unrelated
 * one — the "guard tests the wrong claim" failure mode. This test instead
 * finds each `<input …>` TAG's own boundary (brace- and quote-aware, so an
 * `onChange={(e) => …}` handler inside the tag doesn't look like the tag's
 * end) and reads `min`/`step` only from within that one tag's attribute text.
 * It also runs on the STRIPPED source via the repo's one shared lexer
 * (`lib/strip-comments.ts`) so a commented-out `min={1} step={10}` example
 * (like the one two paragraphs up, if this docblock were scanned) is not
 * mistaken for a live violation.
 *
 * ── WHY THE DIVISIBILITY CHECK IS DECIMAL, NOT `%` ──────────────────────────
 * `1 % 0.01` is `0.009999999999999929` in IEEE double arithmetic — a real
 * field in this codebase (`amount_php`, `min="1" step="0.01"`) would false-
 * positive under a naive `%` check even though 1 peso IS an exact multiple of
 * one centavo. The literal `min`/`step` TEXT is parsed as exact decimal
 * digits and compared as scaled BigInts, so a false positive can't happen
 * because of float representation.
 *
 * ── SCOPE + EXEMPTIONS ───────────────────────────────────────────────────────
 * `min={0}` is exempt (0 is a multiple of every step) and `step={1}` is
 * exempt (every whole-number min lands on a step-1 lattice) — those are the
 * two safe shapes RULE 2 of the fix asks every quote/payment number field to
 * use. Only LITERAL numeric `min`/`step` are checked; an input whose min or
 * step is a variable/expression (`step={cond ? 100 : undefined}`) can't be
 * evaluated statically and is left alone — that is a runtime concern, not a
 * static-source one.
 *
 * The full audit (this test's own scan, run 2026-09-11 against every
 * `<input type="number">` under `app/`) found exactly ONE violation — the pax
 * field fixed in the same PR as this guard — so `ALLOWLIST` below is empty.
 * If a future PR needs one, add a `{ file, reason }` entry; don't weaken the
 * check itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/**
 * Reasoned exemptions. Each entry is a file that DOES contain a `min`/`step`
 * mismatch the scan would otherwise flag, kept because fixing it is not
 * trivially safe (or not this PR's to fix). Empty today — see the docblock.
 */
const ALLOWLIST: { file: string; reason: string }[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * Every `<input …>` tag's raw text, found by scanning for `<input` and
 * walking forward to the first `>` that is NOT inside a `{…}` expression or a
 * string/template literal — i.e. the tag's own close, not a `>` belonging to
 * an arrow function or comparison nested in one of its attribute values.
 * `<input>` is a void element in JSX (always self-closing), so this is always
 * the whole opening — and only — tag.
 */
function findInputTags(src: string): string[] {
  const tags: string[] = [];
  const re = /<input\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = m.index;
    let i = start + 6;
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    while (i < src.length) {
      const c = src[i];
      if (quote) {
        if (c === '\\') { i += 2; continue; }
        if (c === quote) quote = null;
        i += 1;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; i += 1; continue; }
      if (c === '{') { depth += 1; i += 1; continue; }
      if (c === '}') { depth -= 1; i += 1; continue; }
      if (c === '>' && depth === 0) { end = i; break; }
      i += 1;
    }
    if (end === -1) continue; // unterminated — not our claim to make
    tags.push(src.slice(start, end + 1));
    re.lastIndex = end + 1;
  }
  return tags;
}

type AttrRead = { present: boolean; raw: string; isLiteral: boolean };

/** Reads one JSX attribute's value text from a tag, handling all three forms
 * React allows: `name={expr}`, `name="str"`, `name='str'`. Multi-line tags
 * (attributes stacked one per line) work the same as single-line — this
 * operates on the tag's full text, not per-line. */
function attrValue(tag: string, name: string): AttrRead {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:\\{([^{}]*)\\}|"([^"]*)"|'([^']*)')`);
  const m = tag.match(re);
  if (!m) return { present: false, raw: '', isLiteral: false };
  const raw = (m[1] ?? m[2] ?? m[3] ?? '').trim();
  const isLiteral = /^-?\d+(\.\d+)?$/.test(raw);
  return { present: true, raw, isLiteral };
}

function decimalPlaces(raw: string): number {
  return (raw.split('.')[1] || '').length;
}

/** Scales a decimal literal's exact digits (never its float value) to a
 * BigInt at the given number of decimal places. */
function toScaledBigInt(raw: string, scale: number): bigint {
  let s = raw;
  let sign = 1n;
  if (s.startsWith('-')) { sign = -1n; s = s.slice(1); }
  const [intPart, fracPartRaw = ''] = s.split('.');
  const fracPart = fracPartRaw.padEnd(scale, '0').slice(0, scale);
  const digits = (intPart || '0') + fracPart;
  return sign * BigInt(digits === '' ? '0' : digits);
}

/** `min` is on the `min + k*step` lattice — computed on exact decimal digits,
 * never IEEE floats, so `min="1" step="0.01"` (1 peso is 100 centavos) is
 * correctly exact even though `1 % 0.01` is not zero in JS. */
function minIsOnStepLattice(minRaw: string, stepRaw: string): boolean {
  const scale = Math.max(decimalPlaces(minRaw), decimalPlaces(stepRaw));
  const minScaled = toScaledBigInt(minRaw, scale);
  const stepScaled = toScaledBigInt(stepRaw, scale);
  if (stepScaled === 0n) return true; // step="0" is a different bug, not ours
  return minScaled % stepScaled === 0n;
}

type Violation = { file: string; tag: string };

/** The actual scan: every `<input type="number">` under `app/`, checked in
 * its own tag's terms. */
function scan(): Violation[] {
  const violations: Violation[] = [];
  for (const f of walk(resolve(WEB, 'app'))) {
    const rel = relative(WEB, f);
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const tag of findInputTags(src)) {
      const type = attrValue(tag, 'type');
      if (!type.present || type.raw !== 'number') continue;
      const min = attrValue(tag, 'min');
      const step = attrValue(tag, 'step');
      if (!min.present || !step.present) continue;
      if (!min.isLiteral || !step.isLiteral) continue; // dynamic — not statically checkable
      if (min.raw === '0' || step.raw === '1') continue; // the two safe shapes
      if (!minIsOnStepLattice(min.raw, step.raw)) {
        violations.push({ file: rel, tag: tag.replace(/\s+/g, ' ').slice(0, 200) });
      }
    }
  }
  return violations;
}

test('fixture: min={1} step={10} is caught — the exact shape of the 200-guest bug', () => {
  const src = `
    <input
      type="number"
      min={1}
      step={10}
      value={pax}
      onChange={(e) => setPax(Number(e.target.value) || 0)}
    />
  `;
  const tag = findInputTags(src)[0];
  assert.ok(tag, 'the fixture tag was not found — the tag-boundary scan is broken');
  const min = attrValue(tag!, 'min');
  const step = attrValue(tag!, 'step');
  assert.equal(min.raw, '1');
  assert.equal(step.raw, '10');
  assert.equal(minIsOnStepLattice(min.raw, step.raw), false, 'min=1 step=10 must be flagged (191/201, never 200)');
});

test('fixture: min={0} step={10} passes — 0 is a multiple of every step', () => {
  const src = `<input type="number" min={0} step={10} value={x} onChange={(e) => setX(e.target.value)} />`;
  const tag = findInputTags(src)[0]!;
  const min = attrValue(tag, 'min');
  const step = attrValue(tag, 'step');
  assert.equal(minIsOnStepLattice(min.raw, step.raw), true);
});

test('fixture: min={1} step={1} passes — every whole number is valid', () => {
  const src = `<input type="number" min={1} step={1} value={x} onChange={(e) => setX(e.target.value)} />`;
  const tag = findInputTags(src)[0]!;
  const min = attrValue(tag, 'min');
  const step = attrValue(tag, 'step');
  assert.equal(minIsOnStepLattice(min.raw, step.raw), true);
});

test('fixture: an unrelated onChange between min and step does not get paired in', () => {
  // The failure mode a whole-file regex has: it could read this tag's `min`
  // together with a LATER tag's `step`. The tag-boundary scan must not.
  const src = `
    <input type="number" min={1} step={1} onChange={(e) => setA(e.target.value)} />
    <input type="number" min={1} step={10} onChange={(e) => setB(e.target.value)} />
  `;
  const tags = findInputTags(src);
  assert.equal(tags.length, 2, 'the two inputs were not found as two separate tags');
  const first = { min: attrValue(tags[0]!, 'min'), step: attrValue(tags[0]!, 'step') };
  const second = { min: attrValue(tags[1]!, 'min'), step: attrValue(tags[1]!, 'step') };
  assert.equal(minIsOnStepLattice(first.min.raw, first.step.raw), true, 'the first (safe) tag was wrongly flagged');
  assert.equal(minIsOnStepLattice(second.min.raw, second.step.raw), false, 'the second (unsafe) tag was missed');
});

test('fixture: a decimal peso/centavo pair (min=1 step=0.01) is NOT a float false positive', () => {
  // 1 % 0.01 !== 0 in IEEE double arithmetic, but 1 peso IS exactly 100
  // centavos. This is the exact shape of `amount_php` fields already shipped
  // in this repo (payment-asks-panel.tsx and others) — they must stay green.
  assert.notEqual(1 % 0.01, 0, 'sanity: JS float % really is nonzero here');
  assert.equal(minIsOnStepLattice('1', '0.01'), true);
});

test('fixture: a multi-line attribute list is read the same as a single-line one', () => {
  const singleLine = `<input type="number" min={1} step={10} />`;
  const multiLine = `
    <input
      type="number"
      min={1}
      step={10}
    />
  `;
  const a = findInputTags(singleLine)[0]!;
  const b = findInputTags(multiLine)[0]!;
  assert.equal(
    minIsOnStepLattice(attrValue(a, 'min').raw, attrValue(a, 'step').raw),
    minIsOnStepLattice(attrValue(b, 'min').raw, attrValue(b, 'step').raw),
  );
});

test('a commented-out violation is not flagged — comments are stripped first', () => {
  const src = stripComments(`
    // <input type="number" min={1} step={10} />
    <input type="number" min={0} step={10} />
  `);
  const tags = findInputTags(src);
  assert.equal(tags.length, 1, 'the commented-out tag should not survive stripComments');
  const min = attrValue(tags[0]!, 'min');
  assert.equal(min.raw, '0', 'the live tag, not the commented one, must be what remains');
});

test('the proposal-maker pax field is fixed — min=1 step=1, every whole guest count valid', () => {
  const src = stripComments(readFileSync(resolve(WEB, 'app/_components/proposal-maker.tsx'), 'utf8'));
  const paxTag = findInputTags(src).find((t) => /value=\{pax\}/.test(t));
  assert.ok(paxTag, 'the pax input was not found — did it move or get renamed?');
  const min = attrValue(paxTag!, 'min');
  const step = attrValue(paxTag!, 'step');
  assert.equal(min.raw, '1');
  assert.equal(step.raw, '1', 'the pax field must accept every whole number — step=10 refuses round guest counts');
  assert.equal(minIsOnStepLattice(min.raw, step.raw), true);
});

test('every type="number" input under app/ has a min on its own step lattice', () => {
  const found = scan();
  const allowedFiles = new Set(ALLOWLIST.map((a) => a.file));
  const unexpected = found.filter((v) => !allowedFiles.has(v.file));
  assert.deepEqual(
    unexpected,
    [],
    `${unexpected.length} number input(s) have a min that is not reachable by their own ` +
      `step (min + k*step never lands on min for some whole value ≥ min), which silently ` +
      `refuses a value a seed/prefill can produce:\n` +
      unexpected.map((v) => `  • ${v.file}\n      ${v.tag}`).join('\n'),
  );
  // Every allowlist entry must still be a real, currently-flagged case — an
  // entry for a bug that got fixed elsewhere would hide a regression if the
  // mismatch ever came back under a different min/step pair.
  for (const entry of ALLOWLIST) {
    assert.ok(
      found.some((v) => v.file === entry.file),
      `${entry.file} is allowlisted ("${entry.reason}") but the scan no longer flags it — ` +
        `remove the stale entry`,
    );
  }
});

test('the scan actually scanned something', () => {
  const files = walk(resolve(WEB, 'app'));
  assert.ok(files.length > 500, `only ${files.length} files walked — the root is wrong`);
  const withNumberInputs = files.filter((f) => /type="number"/.test(readFileSync(f, 'utf8')));
  assert.ok(withNumberInputs.length > 10, `only ${withNumberInputs.length} files have a number input — the scan found too little to trust`);
});
