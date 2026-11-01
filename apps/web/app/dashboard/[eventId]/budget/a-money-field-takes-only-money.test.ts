/**
 * 💱 A MONEY FIELD TAKES ONLY MONEY (walk of the dev labs, 2026-11-01).
 *
 * Seen: typing "abc" into the Budget's Target left "2,250,000abc" in the box — a letter standing in an amount. The
 * Target (and the Budget sheets' Amount / Paid so far fields) were plain inputs whose `onChange` stored whatever was
 * typed; only the shared Form row's amount went through the peso keeper.
 *
 * Held here:
 *   1. the ONE keeper (`keepPesoTyping`, lib/peso-as-you-type.ts) — run, not read: letters and stray marks never
 *      survive it, the commas are put in, whole pesos drop a point, centavos keep two;
 *   2. EVERY number-pad `<input>` on the Budget page (`inputMode` numeric / decimal) calls it from its `onInput`;
 *   3. the shared Form row's amount calls the same keeper (one way, not two).
 *
 * SABOTAGE, seen red: drop the Target's `onInput` → "budget-summary.tsx: a money <input> keeps what is typed".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { keepPesoTyping } from '@/lib/peso-as-you-type';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A stand-in for the field the browser hands `onInput`. */
function field(value: string, caret = value.length) {
  return {
    value,
    selectionStart: caret as number | null,
    caret,
    setSelectionRange(a: number) {
      this.caret = a;
    },
  };
}

test('the keeper drops what is not money', () => {
  for (const [typed, decimals, kept] of [
    ['2,250,000abc', 0, '2,250,000'],
    ['abc', 0, ''],
    ['2250000', 0, '2,250,000'],
    ['₱1,500.75x', 2, '1,500.75'],
    ['1500.5', 0, '15,005'],
    ['12e3', 2, '123'],
  ] as const) {
    const el = field(typed);
    assert.equal(keepPesoTyping(el, decimals), kept, `"${typed}"`);
    assert.equal(el.value, kept, `"${typed}" is left in the field`);
    assert.doesNotMatch(el.value, /[^\d,.]/, `"${typed}" keeps a mark that is not money`);
  }
});

test('every number-pad <input> on the Budget page goes through the keeper', () => {
  const dir = join(HERE, '_components');
  let seen = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
    const src = stripComments(readFileSync(join(dir, file), 'utf8'));
    for (const m of src.matchAll(/<input\b[\s\S]*?\/>/g)) {
      const tag = m[0];
      if (!/inputMode="(numeric|decimal)"/.test(tag)) continue;
      seen += 1;
      assert.match(tag, /onInput=\{\(e\) => void keepPesoTyping\(e\.currentTarget\b/, `${file}: a money <input> keeps what is typed\n${tag}`);
    }
  }
  console.log(`budget money inputs held: ${seen}`);
  assert.ok(seen >= 6, `only ${seen} money inputs found — the Target and the sheets' amounts moved; re-aim this guard`);
});

test('the shared Form row amount uses the same keeper', () => {
  const row = stripComments(readFileSync(join(HERE, '..', '..', '..', '_components', 'form-row.tsx'), 'utf8'));
  assert.match(row, /onInput=\{mark \? \(e\) => void keepPesoTyping\(e\.currentTarget, 0\) : undefined\}/);
});
