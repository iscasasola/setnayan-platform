/**
 * GUARD — Papic is ONE service, and the retired names stay out of what a
 * customer reads.
 *
 * Owner, 2026-08-11 and again 2026-08-26 after finding them still on screen:
 * *"we do not have papic one or papic pool. no 2 ways of papic service. just 1.
 * papic pool will be our papic service. this was documented before already."*
 *
 * 🔑 "SETTING SHOTS ASIDE FOR ONE CAMERA" IS A FEATURE, NOT A SECOND PRODUCT.
 * Owner: *"they just alot some photos for a specific Papic. so for example they
 * get 3000 photos. and then they can assign the 500 photos to 1 papic."* That
 * ships — `setCameraShots` writes the allocation and
 * `papic_reserve_capture_split` spends the camera's own shots first and lets
 * the pot pay the remainder, under one row lock. Dedicated shots are a FLOOR,
 * never a ceiling. So a page may absolutely describe that; what it may not do
 * is offer it as an ALTERNATIVE to Papic.
 *
 * ⚠ THIS IS A CENSUS, NOT AN ALLOW-LIST. The decision that let the old names
 * survive was recorded in the database (every legacy tier deactivated and
 * renamed) and in one button label, and never reached the sentences around
 * them. A guard that checks the files somebody thought of would have missed the
 * same sentences. So it walks every source file under `app/` and `lib/` and
 * asks the question of all of them.
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST. Every removal left a note NAMING what it
 * removed — including this docblock. A raw-source guard would report the defect
 * it just fixed. Log lines are exempt: an operator reading a server log is not
 * a customer, and renaming a log string changes nothing a person sees.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const RETIRED = ['Papic Pool', 'Papic One'] as const;

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strip // and block comments, preserving string literals. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i]!;
    const nxt = src[i + 1];
    if (quote) {
      if (c === '\\') { out += c + (nxt ?? ''); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i += 1; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i += 1; continue; }
    if (c === '/' && nxt === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i += 1; } continue; }
    if (c === '/' && nxt === '*') {
      i += 2;
      // ⚠ NEWLINES ARE PRESERVED. A first cut blanked them too, so every line
      // number this guard reported was wrong — it named lines 1354/1376 for
      // hits that really sat at 1658/1680. A guard that reports the wrong
      // location sends the next reader to innocent code.
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      i += 2; continue;
    }
    out += c; i += 1;
  }
  return out;
}

const FILES = [...sources(join(WEB_ROOT, 'app')), ...sources(join(WEB_ROOT, 'lib'))];

test('the census actually sweeps something — a guard over zero files always passes', () => {
  assert.ok(
    FILES.length > 500,
    `only ${FILES.length} source files found — the walk is broken and every rule below is vacuous`,
  );
});

test('the comment stripper actually strips — otherwise this guard reads prose', () => {
  // ⚠ NOT "Papic Pool" — that phrase legitimately lives in this file's CODE,
  // in RETIRED above, so the first cut of this test could never pass. Use a
  // phrase that exists ONLY in prose.
  // ⚠ SPLIT ON PURPOSE. Written whole, the literal would live in this file's
  // CODE and the stripper would rightly keep it — the test could never pass.
  // Two cuts of this guard failed that way before the canary was split.
  const CANARY = 'no 2 ways of ' + 'papic service';
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.ok(self.includes(CANARY), 'the docblock lost the phrase this test strips for');
  assert.ok(
    !stripComments(self).includes(CANARY),
    'the stripper left comment text behind — the census is now matching explanations, not code',
  );
  // …and it must not eat real strings while it is at it.
  assert.ok(stripComments(self).includes("'Papic Pool'"), 'the stripper ate a string literal');
});

test('🚨 no customer-facing string names a retired Papic product', () => {
  const offenders: string[] = [];
  for (const file of FILES) {
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const [n, line] of code.split('\n').entries()) {
      if (line.includes('console.')) continue; // an operator's log is not a customer's screen
      for (const name of RETIRED) {
        if (line.includes(name)) {
          offenders.push(`${file.slice(WEB_ROOT.length + 1)}:${n + 1} — "${name}"`);
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Papic is ONE service (owner-locked 2026-08-11, restated 2026-08-26). These name a retired one:\n  ${offenders.join('\n  ')}`,
  );
});

test('🚨 the pricing estimator offers no choice BETWEEN two Papics', () => {
  const est = stripComments(
    readFileSync(join(WEB_ROOT, 'app/(shell)/pricing/_papic-estimator.tsx'), 'utf8'),
  );
  for (const shape of ["'one' | 'pool'", "Mode>", 'setMode', 'effectiveMode']) {
    assert.ok(
      !est.includes(shape),
      `the two-product switch is back (${shape}) — one Papic, and setting shots aside for a camera happens inside the event`,
    );
  }
  assert.ok(
    !/dedicated cameras or a shared/i.test(est),
    'the headline offers a fork again — "or" is the bug; it is one product',
  );
});
