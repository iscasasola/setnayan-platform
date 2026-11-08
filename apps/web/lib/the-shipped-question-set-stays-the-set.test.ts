/**
 * 🔒 THE SHIPPED QUESTION SET STAYS THE SET (THE ONE BUILD · Forms, B2 §5 guard 4).
 *
 * Migration 20271325118550 made `vendor_questions` the item table of the Form Maker too. `form_id IS NULL` is the
 * shipped "Questions for the couple" set; a library form's items carry their form's id. One reader that forgets the
 * filter would show a Shot list's items as the couple's "Questions for the couple" — and a Media or Video item as a
 * question box nobody can answer.
 *
 * So: every `.from('vendor_questions')` chain outside the Forms code names `form_id` — `.is('form_id', null)` for the
 * shipped set, or `.in/.eq('form_id', …)` when it deliberately reads a sent form's items. An `.insert(` needs nothing
 * (the column defaults to NULL). Counted PER CHAIN and printed per file, because a file-level match cannot say which
 * read still lacks it (CLAUDE.md trap: "sabotage landed 2→1 and stayed green").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The Forms code owns form-scoped reads by construction. */
const FORMS_CODE = [/^lib\/vendor-forms/, /^app\/vendor-dashboard\/forms\//, /^app\/admin\/categories\/_components\/form-/];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Each `.from('vendor_questions')` chain: from the call to the end of its statement / Promise.all element. */
export function questionChains(src: string): string[] {
  const chains: string[] = [];
  const re = /\.from\(\s*['"]vendor_questions['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const rest = src.slice(m.index + m[0].length);
    const stop = rest.search(/;|\n\s*(?:supabase|admin|db|sb)\s*\n|\.from\(/);
    chains.push(rest.slice(0, stop === -1 ? rest.length : stop));
  }
  return chains;
}

export function chainScopesTheForm(chain: string): boolean {
  if (/\.insert\(/.test(chain)) return true;
  // `.not('form_id', 'is', null)` names the library explicitly (the form-media sweep) — scoped, not the shipped set.
  return /\.(is|in|eq|not)\(\s*['"]form_id['"]/.test(chain);
}

test('every vendor_questions chain outside the Forms code scopes form_id', () => {
  const files = [...walk(path.join(WEB, 'app')), ...walk(path.join(WEB, 'lib'))];
  const report: string[] = [];
  const bad: string[] = [];
  let readers = 0;
  for (const abs of files) {
    const rel = path.relative(WEB, abs).split(path.sep).join('/');
    if (FORMS_CODE.some((r) => r.test(rel))) continue;
    const src = fs.readFileSync(abs, 'utf8');
    const chains = questionChains(src);
    if (chains.length === 0) continue;
    readers += 1;
    const ok = chains.filter(chainScopesTheForm).length;
    report.push(`${rel}: ${ok}/${chains.length}`);
    if (ok !== chains.length) bad.push(`${rel}: ${chains.length - ok} chain(s) read vendor_questions without form_id`);
  }
  console.log(`vendor_questions readers outside Forms:\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, [], bad.join('\n'));
  // The nine shipped sites (B2 §2.7) — fewer means the scan went blind, not that the readers left.
  assert.ok(readers >= 9, `only ${readers} reader files seen — the scan narrowed`);
});

test('the scan itself tells a scoped chain from an unscoped one', () => {
  const unscoped = `await supabase.from('vendor_questions').select('question_id').eq('vendor_profile_id', v);`;
  const scoped = `await supabase.from('vendor_questions').select('question_id').eq('vendor_profile_id', v).is('form_id', null);`;
  assert.equal(chainScopesTheForm(questionChains(unscoped)[0]!), false);
  assert.equal(chainScopesTheForm(questionChains(scoped)[0]!), true);
});
