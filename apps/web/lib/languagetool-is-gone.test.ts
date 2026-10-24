/**
 * LANGUAGETOOL IS GONE — NO TEXT LEAVES FOR A SPELLING CHECK.
 *
 * ⚖ DPO ruling 2026-10-23 (corpus DECISION_LOG): *"drop LanguageTool"* — no
 * data agreement is possible with its public API, and `lib/editorial-scan.ts`
 * sent it every field of a couple's editorial draft. The call is removed (the
 * OpenAI moderation layer stays), and so is its line on /privacy.
 *
 * THE PROPERTY: no CODE in app/ or lib/ names LanguageTool or its host, and
 * /privacy does not list it as a processor. Comments are stripped first, so the
 * notes recording the removal never convict anything.
 *
 * SABOTAGE (run when written): put `fetch('https://api.languagetool.org/v2/check')`
 * back in editorial-scan.ts → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('no code calls or names LanguageTool', () => {
  const hits: string[] = [];
  const files = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))];
  assert.ok(files.length > 500, `only ${files.length} files read`);
  for (const f of files) {
    if (/languagetool/i.test(stripComments(readFileSync(f, 'utf8')))) hits.push(f.slice(WEB.length + 1));
  }
  assert.deepEqual(hits, [], `LanguageTool is back in:\n${hits.join('\n')}`);
});

test('the editorial scan still moderates through OpenAI', () => {
  const scan = stripComments(readFileSync(join(WEB, 'lib/editorial-scan.ts'), 'utf8'));
  assert.match(scan, /api\.openai\.com\/v1\/moderations/, 'removing LanguageTool must not remove moderation');
});
