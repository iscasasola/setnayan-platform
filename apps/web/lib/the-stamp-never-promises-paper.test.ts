/**
 * THE STAMP NEVER PROMISES PAPER.
 *
 * `07` Q6, owner-ruled 2026-09-09, asks for one thing to be said out loud in the
 * product and not only in a pull request:
 *
 *   🔑 **A copy printed before S14 shipped carries no stamp and can never know
 *   anything. Paper cannot be recalled. The stamp lets a reader CHECK; it does
 *   not reach a printed page.**
 *
 * The danger is not that somebody writes an outright lie. It is the reassuring
 * half-sentence — *"we'll keep your copy up to date"*, *"withdrawn photos are
 * removed from printed copies"* — that a kind person adds to soften a limit. A
 * host who believes that has handed printed keepsakes out at their reception.
 *
 * So this reads the sentences themselves and fails on the VOCABULARY OF RECALL,
 * and then checks that the honest ones are actually RENDERED.
 *
 * ⚠ AN IMPORT IS NOT A RENDERING. S8 measured exactly this: replacing its
 * consent sentence in the JSX took the rendering 2 → 1 and its checklist still
 * reported nothing missing, because the survivor was the import line. So the
 * check below ignores import lines and requires the constant to appear in a JSX
 * CHILD position — between a `>` and the next `<`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { PRINTED_STAMP_LEAD, PRINTED_STAMP_LIMIT } from './a-withdrawal-reaches-every-copy';
import { STORY_AUDIENCE_NOTE } from './who-can-see-your-story';
import { PUBLISH_STATE_BLURB } from './publish-once-knowing-who-reads-it';

const WEB = join(__dirname, '..');

/**
 * Phrases that claim a printed page can be reached. Each is a sentence somebody
 * would write while trying to be kind, and every one of them is false.
 */
const PROMISES_PAPER: RegExp[] = [
  /printed cop(y|ies)[^.]*\b(updated?|corrected|recalled|removed|refreshed)\b/i,
  /\b(update|correct|recall|refresh)\b[^.]*\byour printed\b/i,
  /\bwe(?:'| w)ill\b[^.]*\bprint/i,
  /\bautomatically\b[^.]*\bprint(ed)?\b/i,
  /\bprint(ed)?\b[^.]*\bstays? (?:current|up to date|accurate)\b/i,
  /\bkeeps? your (?:copy|copies|print|keepsake)\b/i,
  /*
    🔴 THIS RULE ACCUSED THE HONEST SENTENCE ON ITS FIRST RUN, AND THE FIX IS
    THE POINT. Written as `comes down … from a printed`, it matched
    "it comes down from the story — **but never** from a printed page" — the
    exact sentence it exists to protect. A banned phrase that ignores the
    negation in front of it is a cheaper proxy for the claim, and a cheaper
    proxy does not merely miss things: it convicts correct copy, and the
    tempting way out is to reword true copy until a regex is happy. The window
    now stops at a negation.
  */
  /\bcomes down\b(?:(?!\bnever\b|\bnot\b|\bcannot\b)[^.])*\bfrom a printed\b/i,
];

const SENTENCES: Array<[string, string]> = [
  ['PRINTED_STAMP_LEAD', PRINTED_STAMP_LEAD],
  ['PRINTED_STAMP_LIMIT', PRINTED_STAMP_LIMIT],
  ['the Taken back audience note', STORY_AUDIENCE_NOTE.taken_back],
  ['the Taken back rung blurb', PUBLISH_STATE_BLURB.taken_back],
];

test('no sentence about the stamp claims a printed page can be reached', () => {
  for (const [where, sentence] of SENTENCES) {
    for (const promise of PROMISES_PAPER) {
      assert.ok(
        !promise.test(sentence),
        `${where} promises something paper cannot do (${promise}):\n  ${sentence}`,
      );
    }
  }
});

test('both sentences that state the limit say so in plain words', () => {
  // The limit has to be POSITIVELY present, not merely un-violated — a guard
  // that only bans phrases passes an empty string.
  assert.match(PRINTED_STAMP_LIMIT, /never from a printed page/i);
  assert.match(STORY_AUDIENCE_NOTE.taken_back, /printed/i);
  assert.match(PUBLISH_STATE_BLURB.taken_back, /printed on paper cannot be changed/i);
});

test('the printed keepsake really renders the stamp and its limit', () => {
  const file = join(WEB, 'app', '[slug]', 'print', 'print-sheet.tsx');
  const src = stripComments(readFileSync(file, 'utf8'))
    .split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/from '@\/lib\//.test(l))
    .join('\n');

  // A JSX child position: between a closing `>` and the next `<`.
  const rendered = />[^<]*\{\s*PRINTED_STAMP_LIMIT\s*\}/s;
  assert.match(
    src,
    rendered,
    'PRINTED_STAMP_LIMIT is no longer rendered by the print sheet — an import on ' +
      'its own puts nothing on the paper.',
  );
  assert.match(
    src,
    />[^<]*\{\s*stampLine\s*\}/s,
    'the print sheet no longer renders the moment the copy was true.',
  );
});

test('the fourth rung is offered only to a story that has been published', async () => {
  const { rungIsOffered } = await import('./publish-once-knowing-who-reads-it');
  assert.equal(
    rungIsOffered('taken_back', { hasBeenPublished: false, current: 'draft' }),
    false,
    'a story that was never public was offered a control to take it back.',
  );
  assert.equal(rungIsOffered('taken_back', { hasBeenPublished: true, current: 'published' }), true);
  // A story already standing on the rung always shows it, or there is no way back.
  assert.equal(
    rungIsOffered('taken_back', { hasBeenPublished: false, current: 'taken_back' }),
    true,
  );
  for (const other of ['draft', 'event', 'published'] as const) {
    assert.equal(rungIsOffered(other, { hasBeenPublished: false, current: 'draft' }), true);
  }
});
