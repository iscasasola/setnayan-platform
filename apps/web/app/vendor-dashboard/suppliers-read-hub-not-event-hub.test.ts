/**
 * 🏷 A SUPPLIER NEVER READS "EVENT HUB" (owner, 2026-11-05: "Event Hub" is a couple-side word, for the front page only —
 * never in supplier or coordinator material). On a supplier's screens their day page is the **Hub** (the tab is already
 * called Hub); the page guests open is "the guests' page".
 *
 * Every file under app/vendor-dashboard, plus the crew phone's words and the supplier's Today rows (both in lib/), is
 * read with its comments stripped — a comment may name the couple's Event Hub; a word a supplier reads may not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = [...walk(HERE), join(WEB, 'lib', 'crew-pass.ts'), join(WEB, 'lib', 'supplier-today-view.ts')];

test('no supplier screen says "Event Hub"', () => {
  assert.ok(FILES.length > 50, `read only ${FILES.length} files — did the folder move?`);
  const hits: string[] = [];
  for (const f of FILES) {
    const src = stripComments(readFileSync(f, 'utf8'));
    src.split('\n').forEach((line, i) => {
      if (/Event Hub/.test(line)) hits.push(`${relative(WEB, f)}:${i + 1}  ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(hits, [], `say "Hub" (their day page) or "the guests’ page" instead:\n${hits.join('\n')}`);
});

test('the supplier’s day page is the Hub', () => {
  const screen = readFileSync(join(HERE, 'on-the-day', '_components', 'hub-screen.tsx'), 'utf8');
  assert.match(screen, /label="Open the Hub"/);
  const page = readFileSync(join(HERE, 'on-the-day', 'page.tsx'), 'utf8');
  assert.match(page, /title: 'Hub · Supplier'/);
});
