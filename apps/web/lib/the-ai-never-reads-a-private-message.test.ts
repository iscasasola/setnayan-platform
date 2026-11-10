/**
 * 🔒 THE AI NEVER READS A PRIVATE MESSAGE (FINAL RULINGS 2026-11-09, "Private messages": "The AI never reads private
 * messages"). Measured 2026-11-09 by `a-private-message-never-reaches-a-third-person`: the auto-reply's two reads of
 * `chat_messages` (the latest host line it answers, the supplier's own lines it learns a voice from) ran through the
 * ADMIN client with no recipient filter — RLS could not help. Every `chat_messages` read under `lib/vendor-autoreply/`
 * now asks for shared lines only (`.is('recipient_user_id', null)`); a new read without it fails here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const DIR = join(__dirname, 'vendor-autoreply');

/** Each `.from('chat_messages')` READ (not an insert) in the source, with the chain that follows it. */
export function unfilteredReads(src: string): string[] {
  const code = stripComments(src);
  const out: string[] = [];
  const re = /\.from\('chat_messages'\)([\s\S]*?);/g;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    const chain = m[1]!;
    if (/^\s*\.(insert|update|delete|upsert)\(/.test(chain)) continue;
    if (!/\.is\('recipient_user_id',\s*null\)/.test(chain)) out.push(chain.trim().split('\n')[0]!.trim());
  }
  return out;
}

test('every chat_messages read in the auto-reply asks for shared lines only', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
  let reads = 0;
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    reads += (stripComments(src).match(/\.from\('chat_messages'\)\s*\.select\(/g) ?? []).length;
    assert.deepEqual(unfilteredReads(src), [], `${f} reads chat_messages without .is('recipient_user_id', null)`);
  }
  assert.ok(reads >= 2, `expected the auto-reply's two chat reads, found ${reads} — the guard is looking at nothing`);
});

test('sabotage: the guard fires on a read without the filter, and lets an insert through', () => {
  assert.equal(unfilteredReads(`x.from('chat_messages').select('body').eq('thread_id', t).limit(1);`).length, 1);
  assert.equal(unfilteredReads(`x.from('chat_messages').select('body').is('recipient_user_id', null).limit(1);`).length, 0);
  assert.equal(unfilteredReads(`x.from('chat_messages').insert({ body: 'hi' });`).length, 0);
});
