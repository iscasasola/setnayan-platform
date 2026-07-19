#!/usr/bin/env node
// Fold per-PR changelog fragments (changelog.d/*.md) into CHANGELOG.md, newest
// at top, and delete them. Run anytime — typically at release, or whenever you
// want the running log refreshed. Fragments are the conflict-free per-PR unit;
// this is the only step that touches CHANGELOG.md, so feature PRs never collide
// on it. See changelog.d/README.md for the why. No dependencies (built-ins only).
import { readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fragDir = join(root, 'changelog.d');
const changelogPath = join(root, 'CHANGELOG.md');

const fragments = readdirSync(fragDir)
  .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
  .sort();

if (fragments.length === 0) {
  console.log('No changelog fragments to collect.');
  process.exit(0);
}

const collected =
  fragments.map((f) => readFileSync(join(fragDir, f), 'utf8').trim()).join('\n\n') + '\n';

const changelog = readFileSync(changelogPath, 'utf8');
const divider = '\n---\n';
const at = changelog.indexOf(divider);
if (at === -1) throw new Error('CHANGELOG.md is missing its "---" divider.');

const head = changelog.slice(0, at + divider.length);
const body = changelog.slice(at + divider.length).replace(/^\n+/, '');
writeFileSync(changelogPath, `${head}\n${collected}\n${body}`);

for (const f of fragments) rmSync(join(fragDir, f));

console.log(`Folded ${fragments.length} fragment(s) into CHANGELOG.md:`);
for (const f of fragments) console.log(`  - ${f}`);
