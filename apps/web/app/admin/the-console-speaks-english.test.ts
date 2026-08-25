/**
 * No admin screen prints a table name, a migration number or an iteration
 * reference at the person using it.
 *
 * 🚨 THE OWNER READ ONE OF THESE OFF HIS OWN SCREEN, 2026-08-26, and asked what
 * it was — `AWAITING_VENDOR`, the stored value rendered straight out of the
 * column and uppercased by CSS. The Completions page also ended with
 * "table event_vendors (migrations 20270101000000 + 20270106000000)".
 *
 * 🔑 THE SWEEP THAT FOUND THESE WAS WRONG TWICE BEFORE IT WAS RIGHT. Searching
 * for the string "Source ·" found 8 files; the real number was 13, because five
 * screens carry the same defect in a different shape ("(iteration 0026)" inside
 * an otherwise-fine sentence, a table name inside an ERROR message). One
 * spelling is not a survey — this rule matches the THING, not the phrasing.
 *
 * ⚖ TWO SITES ARE DELIBERATELY LEGAL and must stay that way: `<code>true</code>`
 * on Free windows is the literal value an operator has to set, and
 * `<code>status</code>` on the Taxonomy studio explains a field they can see.
 * Naming a thing the person acts on is not developer text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN = join(process.cwd(), 'app/admin');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Comments explain the very strings this bans, so strip them first. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Sites that name something the OPERATOR types or sees, not the schema. */
const ALLOWED = new Set(['taxonomy/_components/taxonomy-studio.tsx']);

const OFFENDERS =
  /(migration[s]?\s+\d{10,}|iteration\s+\d{4}|<code>[a-z_]{5,}<\/code>)/g;

test('no admin screen prints schema at the person using it', () => {
  const found: string[] = [];
  for (const file of walk(ADMIN)) {
    const rel = file.slice(ADMIN.length + 1);
    if (rel.endsWith('.test.tsx') || ALLOWED.has(rel)) continue;
    const hits = [...new Set(code(readFileSync(file, 'utf8')).match(OFFENDERS) ?? [])];
    if (hits.length) found.push(`${rel} → ${hits.join(', ')}`);
  }
  assert.deepEqual(
    found,
    [],
    'These screens show a person the plumbing:\n  ' + found.join('\n  ') +
      '\nSay what the screen is FOR. The table name belongs in the code.',
  );
});

test('the guard can actually fire — it reads real files and a real pattern', () => {
  // A sweep that silently matches nothing passes forever. Both floors are far
  // below the real values (≈380 admin .tsx files).
  const files = walk(ADMIN);
  assert.ok(files.length > 100, `walked only ${files.length} admin files`);
  assert.ok(
    OFFENDERS.test('table <code>event_vendors</code> (migration 20270101000000)'),
    'the pattern no longer matches the exact string this rule was written for',
  );
});

test('a stored status is shown as words, not as the column value', () => {
  const src = code(readFileSync(join(ADMIN, 'completions/page.tsx'), 'utf8'));
  // The badge must resolve through the label map. Falling back to the raw value
  // is fine — an empty badge would be worse than an ugly one.
  assert.match(src, /STATUS_LABEL\[r\.completion_status \?\? ''\] \?\? r\.completion_status/);
  assert.match(src, /awaiting_vendor: 'Supplier has not confirmed'/);
  // And it must stop SHOUTING it in the data face.
  assert.ok(
    !/uppercase tracking-\[0\.15em\][^`]*STATUS_TONE/.test(src),
    'the status badge still renders in mono uppercase — that is the face that made a stored value look like a code',
  );
});
