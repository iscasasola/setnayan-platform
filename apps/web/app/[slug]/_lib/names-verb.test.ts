/**
 * THE VERB AFTER THE HOSTS' NAMES AGREES WITH HOW MANY THEY ARE.
 *
 * A guest's walk, 2026-10-11 (fault N21): "Marco & Marga hasn't set up e-gifts yet." and "Marco & Marga hasn't
 * published their wedding recap." — two people, a singular verb.
 *
 * WHAT IS HELD:
 *   (1) THE RULE, RUN: two names of a two-person event → "haven’t"; one name, a company with an ampersand in a
 *       one-host event, a missing name → "hasn’t". And it is the masthead's own split, on every case: the sentence
 *       says "haven’t" exactly when the cover stacks the name as two.
 *   (2) NO GUEST PAGE PUTS A FIXED SINGULAR VERB STRAIGHT AFTER THE EVENT'S NAME. Every `{…display_name…} hasn’t|has|
 *       is|was|doesn’t` under `app/[slug]` is found and named — a new sentence written the old way goes red here.
 *       (The event's own nouns — "The couple", "The host" — are one subject and keep the singular.)
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): `hasntAfter` made to answer "hasn’t"
 * always → (1) red; the recap's sentence put back to the fixed `hasn&rsquo;t` → (2) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROOT = join(__dirname, '..');

test('(1) two names of a two-person event take "haven’t"; one host keeps "hasn’t" — and it is the cover’s own split', async () => {
  const { hasntAfter, namesAreTwo } = await import('./names-verb');
  const { splitCoupleNames } = await import('../_components/pahina-masthead');
  const CASES: Array<[string | null, boolean, 'hasn’t' | 'haven’t']> = [
    ['Marco & Marga', true, 'haven’t'],
    ['Indalecio and Claire', true, 'haven’t'],
    ['Marco&Marga', true, 'haven’t'],
    // A wedding whose name is one line.
    ['The Santos Wedding', true, 'hasn’t'],
    // One host, whatever the punctuation: a company is not two people.
    ['Ayala & Partners Year-End', false, 'hasn’t'],
    ['Nina', false, 'hasn’t'],
    // No name at all: the page falls back to "the couple" / "the host" — one subject.
    [null, true, 'hasn’t'],
    ['   ', true, 'hasn’t'],
  ];
  for (const [name, twoPeople, want] of CASES) {
    assert.equal(hasntAfter(name, twoPeople), want, `${JSON.stringify(name)} (twoPeople=${twoPeople})`);
    const stacked = (name ?? '').trim() !== '' && splitCoupleNames((name ?? '').trim(), twoPeople).second !== null;
    assert.equal(namesAreTwo(name, twoPeople), stacked, `${JSON.stringify(name)}: the sentence and the cover disagree about how many they are`);
  }
  assert.ok(CASES.some((c) => c[2] === 'haven’t') && CASES.some((c) => c[2] === 'hasn’t'));
});

test('(2) no guest page puts a fixed singular verb straight after the event’s name', () => {
  const walk = (dir: string): string[] =>
    readdirSync(join(ROOT, dir)).flatMap((name) => {
      const rel = dir ? `${dir}/${name}` : name;
      if (statSync(join(ROOT, rel)).isDirectory()) return walk(rel);
      return /\.tsx$/.test(name) && !/\.(?:test|fixture)\.tsx$/.test(name) ? [rel] : [];
    });
  const files = walk('');
  assert.ok(files.length > 150 && files.includes('recap/page.tsx') && files.includes('pabuya/page.tsx'), `anti-vacuity: walked ${files.length} files`);
  /* The event's name, or a local holding it — `{event.display_name}`, `{hostName}`, `${names}` — directly followed
     by a verb that would be wrong for two. */
  const NAME = String.raw`\$?\{(?:event\.display_name|displayName|hostName|coupleNames|names|name)\}`;
  const FIXED = new RegExp(`${NAME}\\s+(?:hasn(?:&rsquo;|’|')t|has|is|isn(?:&rsquo;|’|')t|was|wasn(?:&rsquo;|’|')t|doesn(?:&rsquo;|’|')t|does|invites|wants)\\b`);
  const AGREES = new RegExp(`${NAME}\\s+\\{hasntAfter\\(`);
  const fixed: string[] = [];
  let agreeing = 0;
  for (const rel of files) {
    const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
    src.split('\n').forEach((line, i) => {
      if (AGREES.test(line)) agreeing += 1;
      if (FIXED.test(line)) fixed.push(`app/[slug]/${rel} line ${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  assert.ok(agreeing >= 2, `anti-vacuity: only ${agreeing} sentence(s) were found agreeing with the name — the e-gifts page and the recap both should`);
  assert.deepEqual(fixed, [], 'a sentence about the hosts by NAME has a verb that is wrong when they are two — use hasntAfter (app/[slug]/_lib/names-verb.ts)');
});
