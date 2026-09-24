/**
 * dpo-questions-resolve.test.ts — a docblock may not cite a register that does
 * not exist, and the register may not be empty.
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 * `lib/erasure/coverage.ts` cited `DPO_QUESTIONS` TWICE — once to justify that
 * jointly-authored event fields are deliberately not cleared, once to justify
 * that `event_vendors` third-party PII is excluded — and the symbol **had never
 * existed**. Both references arrived in the same commit that mentioned them
 * (`9637655d5`), and `git log -S 'DPO_QUESTIONS ='` across all history returns
 * nothing. The author wrote "see DPO_QUESTIONS below" and never added it.
 *
 * 🔑 THOSE ARE THE TWO DECISIONS A DPO ACTUALLY HAS TO DEFEND. Under RA 10173
 * §16(e) a controller who declines to erase must say on what basis. "See the
 * document that does not exist" is not a basis — and the failure is silent,
 * because a comment cannot fail to compile.
 *
 * ── What this holds ─────────────────────────────────────────────────────────
 * 1. Every `DPO_QUESTIONS` citation in `lib/erasure/` resolves — the citing
 *    file either defines or imports it. This is the general fix: it kills the
 *    dangling-reference class, not just this one instance.
 * 2. The register is non-empty and every row is answerable — a key, what
 *    happens today, the competing interest, what a ruling would change, and the
 *    tables it touches.
 * 3. A row states a TENSION, not a resolution. A "question" whose tension is
 *    blank is an engineering decision wearing a question's clothes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DPO_QUESTIONS } from './coverage';

const HERE = dirname(fileURLToPath(import.meta.url));

test('every DPO_QUESTIONS citation in lib/erasure resolves to the symbol', () => {
  const citing: string[] = [];
  const dangling: string[] = [];

  for (const name of readdirSync(HERE)) {
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
    const src = readFileSync(join(HERE, name), 'utf8');
    if (!src.includes('DPO_QUESTIONS')) continue;
    citing.push(name);

    // Resolves when the file DEFINES it or IMPORTS it. A mention in a comment
    // with neither is the exact defect this test exists for.
    const defines = /export const DPO_QUESTIONS\b/.test(src);
    const imports = /import\s*\{[^}]*\bDPO_QUESTIONS\b[^}]*\}\s*from/.test(src);
    if (!defines && !imports) dangling.push(name);
  }

  console.log(
    `[dpo-questions] ${citing.length} file(s) cite DPO_QUESTIONS, ${dangling.length} dangling`,
  );
  assert.ok(citing.length > 0, 'nothing cites DPO_QUESTIONS — did the docblocks move?');
  assert.deepEqual(
    dangling,
    [],
    'A file cites DPO_QUESTIONS but neither defines nor imports it, so the reference points ' +
      'at nothing. Either import it, or stop citing it and state the basis inline.\n  ' +
      dangling.join('\n  '),
  );
});

test('the register is non-empty and every row is answerable', () => {
  assert.ok(
    DPO_QUESTIONS.length >= 3,
    `only ${DPO_QUESTIONS.length} question(s) — the two decisions the docblocks cite, plus the ` +
      'deposit receipt, are the known minimum',
  );

  const keys = DPO_QUESTIONS.map((q) => q.key);
  assert.equal(new Set(keys).size, keys.length, 'duplicate question key');

  for (const q of DPO_QUESTIONS) {
    assert.ok(/^[a-z0-9-]+$/.test(q.key), `key is not a slug: ${q.key}`);
    for (const field of ['today', 'tension', 'ifRuledForSubject'] as const) {
      assert.ok(
        q[field].trim().length >= 60,
        `${q.key}.${field} is ${q[field].trim().length} chars — too short to be an answer a DPO ` +
          'could act on',
      );
    }
    assert.ok(q.tables.length > 0, `${q.key} names no table`);
    for (const t of q.tables) {
      assert.ok(/^[a-z_]+$/.test(t), `${q.key} names a table oddly: ${t}`);
    }
  }
});

test('a question states a TENSION — not a decision already taken', () => {
  // A row whose "tension" merely restates what the code does is an engineering
  // decision wearing a question's clothes, and it will never get asked.
  for (const q of DPO_QUESTIONS) {
    assert.notEqual(
      q.tension.trim(),
      q.today.trim(),
      `${q.key}: tension and today are identical — that is a statement, not a question`,
    );
  }
});
