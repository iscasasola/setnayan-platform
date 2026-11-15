/**
 * ARTICLES TAKE LINKS ONLY TO SETNAYAN.COM — checked while typing AND again on
 * the server (owner, 16 Nov: "it only allows links from setnayan.com"; prototype
 * screen 4).
 *
 * Two halves, both required:
 *   · the RULE — `refusedLinks` refuses every other host, in every spelling a
 *     reader could follow, and lets setnayan.com through;
 *   · the WIRING — the composer runs it as the words are typed, and the write
 *     path runs the SAME function before it stores anything. A composer-only
 *     check is a suggestion: a script that skips the page skips it.
 *
 * SABOTAGE (each turns this red):
 *   · allow any host ending in "setnayan.com"      → `notsetnayan.com` passes
 *   · drop the bare-host pattern                   → `instagram.com/x` passes
 *   · remove `refusedLinks` from gateWriter         → the server half is gone
 *   · remove `refusedLinks` from the composer       → the typing half is gone
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { refusedLinks, splitArticleText } from '@/lib/articles-links';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('every link that is not setnayan.com is refused', () => {
  const refusedCases = [
    'Our photographer was great, see instagram.com/tala.studio',
    'https://facebook.com/tala',
    'http://bit.ly/abc',
    'www.tala.studio',
    'tala.ph is cheaper',
    'message me at tala@gmail.com',
    'https://setnayan.com.evil.io/v/tala',
    'https://notsetnayan.com/v/tala',
    'https://user@evil.com/setnayan.com',
    'HTTPS://WWW.FACEBOOK.COM',
    'look: shopee.ph/item?x=1.',
  ];
  for (const t of refusedCases) assert.ok(refusedLinks(t).length > 0, `must refuse: ${t}`);
});

test('setnayan.com links and ordinary words are fine', () => {
  const okCases = [
    'A shop’s own page is fine: setnayan.com/v/tala-studio',
    'https://www.setnayan.com/articles/S89A-0123456789',
    'https://setnayan.com',
    'We did it and it was the best of the day. Ask your photographer how long it adds.',
    'Hi.there — e.g. a first look at 3.30pm costs 1.5 hours',
  ];
  for (const t of okCases) assert.deepEqual(refusedLinks(t), [], `must allow: ${t}`);
});

test('only setnayan.com is ever drawn as a link card', () => {
  const parts = splitArticleText('see setnayan.com/v/tala and instagram.com/tala');
  const links = parts.filter((p) => p.kind === 'link');
  assert.equal(links.length, 1);
  assert.equal(links[0]!.kind === 'link' && links[0]!.href, 'https://www.setnayan.com/v/tala');
});

test('the server runs the same rule before anything is stored', () => {
  const src = code('lib/articles.server.ts');
  assert.match(src, /import \{ refusedLinks \} from '@\/lib\/articles-links'/);
  const gate = src.slice(src.indexOf('async function gateWriter'));
  assert.match(gate.slice(0, 600), /refusedLinks\(/, 'gateWriter must run refusedLinks');
  for (const fn of ['postArticleTopic', 'postArticleReply']) {
    const body = src.slice(src.indexOf(`export async function ${fn}`));
    const gateAt = body.indexOf('gateWriter(');
    const insertAt = body.indexOf('.insert(');
    assert.ok(gateAt > 0 && insertAt > gateAt, `${fn} must pass the link gate before it inserts`);
  }
  // …and the one write route reaches it.
  const route = code('app/api/articles/route.ts');
  assert.match(route, /postArticleTopic\(/);
  assert.match(route, /postArticleReply\(/);
});

test('the composer checks while typing and locks Send', () => {
  const src = code('app/(shell)/articles/_components/article-composer.tsx');
  assert.match(src, /from '@\/lib\/articles-links'/);
  assert.ok((src.match(/refusedLinks\(/g) ?? []).length >= 3, 'the line, New topic and the reply box each run the rule');
  assert.equal(
    (src.match(/disabled=\{pending \|\| blocked/g) ?? []).length,
    2,
    'Post (New topic) AND Send (reply) are each locked while a refused link is in the box',
  );
  assert.match(src, /Remove the link/);
});
