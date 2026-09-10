/**
 * ACCEPT IS THE ONLY WAY ANYTHING ENTERS (08 step 1.2).
 *
 * The desk writes a host decision to four status columns. If a PUBLIC reader
 * stops requiring the accepted value, that decision stops meaning anything —
 * the buttons still work, the meter still fills, and the story publishes what
 * the host turned down. **The desk would be decoration, and nothing would look
 * wrong.**
 *
 * 🔑 THIS IS THE HALF THAT ROTS QUIETLY. Two of the four filters are BRAND NEW
 * (`papic_mission_completions` and `editorial_vendor_media` had no host decision
 * at all before this step), so there is no habit protecting them and no reader
 * who remembers why the line is there. A future edit tidying a `.select()` chain
 * would take one out without a single test failing anywhere else.
 *
 * ⚠ IT READS THE STRIPPED SOURCE. `lib/strip-comments.ts` is the repo's ONE
 * comment stripper, so prose ABOUT a filter can never be mistaken for the
 * filter — including the long comments this very PR added directly above each
 * of these lines, which would otherwise satisfy the check on their own.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_TS = path.join(HERE, '..', 'app', '[slug]', '_components', 'editorial', 'data.ts');

function publicReader(): string {
  return stripComments(fs.readFileSync(DATA_TS, 'utf8'));
}

/**
 * The QUERY CHAIN for one table, and nothing else.
 *
 * 🪤 THIS EXISTS BECAUSE THE FIRST VERSION OF THIS GUARD WAS DECORATION, and a
 * sabotage run proved it. It asserted `.eq('status','approved')` appeared at
 * least twice ANYWHERE in the file — but `photo_messages` and `guest_columns`
 * have carried that exact filter since long before the desk, so the count sat
 * at three with the supplier read having none. Deleting the supplier filter
 * outright left the guard green.
 *
 * A COUNT ACROSS A FILE IS A CHEAPER PROXY FOR "this query requires it", and it
 * accused nothing while the thing it protects was gone. Slicing to the chain
 * tests the actual claim.
 */
function queryChainFor(table: string): string {
  const src = publicReader();
  const start = src.indexOf(`.from('${table}')`);
  assert.notEqual(start, -1, `no read of ${table} in the public story reader`);
  // A chain ends at its terminator; `.limit(`/`.order(`/`;` all appear inside
  // one, so the slice is bounded by the NEXT `.from(` instead — the reads are
  // sequential in this file and never nested.
  const next = src.indexOf('.from(', start + 8);
  return src.slice(start, next === -1 ? src.length : next);
}

test('meta: the file is there and the stripper did not blank it', () => {
  // Anti-vacuity. Every assertion below is an `includes` on this string, and a
  // string that is empty (a moved file, a stripper that ate the code) would
  // fail them all with a misleading message — or, if any were `doesNotMatch`,
  // pass while checking nothing.
  const src = publicReader();
  assert.ok(src.length > 20000, `the public story reader stripped to ${src.length} chars`);
  assert.ok(
    src.includes("from('papic_mission_completions')"),
    'the challenge-answer read is not in this file any more — this guard is ' +
      'pointing at the wrong place and is no longer checking anything',
  );
  assert.ok(
    src.includes("from('editorial_vendor_media')"),
    'the supplier-media read is not in this file any more — same problem',
  );
});

test('a challenge answer reaches the public story ONLY if the host accepted it', () => {
  const chain = queryChainFor('papic_mission_completions');
  assert.ok(
    chain.includes(".eq('status', 'approved')"),
    'the challenge-answer read no longer requires an accepted status. Before ' +
      'the desk shipped, an answer went public the moment the GUEST consented ' +
      'and the host was never asked at all — dropping this line restores that.',
  );
});

test('BOTH the guest’s yes and the host’s yes are required — neither substitutes', () => {
  // `consent_to_share` is the guest's own RA 10173 opt-in; `status` is the
  // host's curation. They answer different questions, and a reader keeping only
  // one of them is wrong in whichever direction it dropped.
  const chain = queryChainFor('papic_mission_completions');
  assert.ok(
    chain.includes(".eq('consent_to_share', true)"),
    'the guest’s own opt-in is no longer required — the host could publish an ' +
      'answer its author never agreed to share',
  );
  assert.ok(chain.includes(".eq('status', 'approved')"), 'the host’s acceptance is no longer required');
});

test('a supplier’s frame is shown only when accepted AND not hidden AND screened', () => {
  const chain = queryChainFor('editorial_vendor_media');
  assert.ok(
    chain.includes(".eq('status', 'approved')"),
    'the supplier read no longer requires an accepted status. Its only other ' +
      'lever, hidden_by_couple, DEFAULTS TO FALSE and has never had a writer — ' +
      'so without this line a supplier’s frame publishes itself, which is the ' +
      'exact opt-out model the desk replaced.',
  );
  assert.ok(
    chain.includes(".eq('hidden_by_couple', false)"),
    'the supplier read lost its hidden_by_couple filter — the belt-and-braces ' +
      'pair is down to one',
  );
  assert.ok(
    chain.includes(".eq('moderation_state', 'clean')"),
    'the supplier read lost its screening filter — unscreened third-party ' +
      'media would reach a public page',
  );
});

test('the two shipped text sources still require approved AND clean', () => {
  // Not new — but they are the pattern the two new columns were modelled on,
  // and a change that loosened them would make the desk inconsistent about
  // what "accepted" means across its own four sources.
  const src = publicReader();
  assert.ok(src.includes("from('photo_messages')"), 'the Kwento read moved');
  assert.ok(src.includes("from('guest_columns')"), 'the letters read moved');
  assert.ok(
    src.includes(".eq('author_publicly_hidden', false)"),
    'a public read stopped honouring author_publicly_hidden, which removes the ' +
      'WHOLE message from publication when a guest sets it',
  );
});
