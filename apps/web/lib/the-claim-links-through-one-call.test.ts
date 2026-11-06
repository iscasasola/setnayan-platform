/**
 * THE CLAIM ASKS; ONLY THE COUPLE'S APPROVE LINKS.
 *
 * Until 2026-10-20 the claim linked the couple's record to the shop itself,
 * through ONE SQL call, `claim_link_record_to_shop` (merge-aware — migration
 * 20271268139017). Owner, 2026-10-20: *"access to the event is automatic but
 * has an approval."* Every supplier-side read of an event finds the supplier
 * through `event_vendors.marketplace_vendor_id`, so the BOND is the access:
 * the claim now raises one ask (`claim_ask_for_access`) and the bond — still
 * that one merge-aware call — runs inside `answer_claim_access_request`, on the
 * couple's Approve (migration 20271280900282).
 *
 * Properties, read from the source with comments stripped:
 *   1. `applyClaimAutoLink` raises `claim_ask_for_access` and writes NO bond —
 *      neither the merge-aware call nor a bare `marketplace_vendor_id` update.
 *   2. No TypeScript file calls `claim_link_record_to_shop` at all — the only
 *      door to the bond is the SQL answer, so the app cannot grow a second one.
 *   3. The answer goes through ONE path (`answerAccessRequest` → the module's
 *      own `answerClaimAccess`), which reads the ask on the couple's own session
 *      before the grant runs.
 * The SQL itself is held by `tests/db/a-claimed-supplier-asks-for-access.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const SRC = read('lib/vendor-invite-actions.ts');

function body(src: string, head: string): string {
  const start = src.indexOf(head);
  assert.ok(start >= 0, `re-point: ${head} moved`);
  const next = src.indexOf('\nexport ', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}

test('1 · the claim raises the ask and writes no bond', () => {
  const claim = body(SRC, 'export async function applyClaimAutoLink(');
  assert.match(claim, /\.rpc\('claim_ask_for_access'/, "the claim no longer raises the couple's approval");
  assert.doesNotMatch(claim, /claim_link_record_to_shop/, 'the claim bonds the record to the shop before the couple approved');
  assert.doesNotMatch(claim, /marketplace_vendor_id\s*:/, 'the claim writes marketplace_vendor_id — that is the access itself');
});

function* tsFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* tsFiles(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

test("2 · no app code calls the bond directly — only the couple's answer reaches it", () => {
  const offenders: string[] = [];
  let scanned = 0;
  for (const root of ['app', 'lib']) {
    for (const f of tsFiles(join(WEB, root))) {
      scanned++;
      if (/\.rpc\(\s*['"]claim_link_record_to_shop['"]/.test(stripComments(readFileSync(f, 'utf8')))) {
        offenders.push(relative(WEB, f));
      }
    }
  }
  assert.ok(scanned > 500, `scanned only ${scanned} files — the walk is not reading the app`);
  assert.deepEqual(offenders, [], `the bond has a second door: ${offenders.join(', ')}`);
});

test("3 · the answer is one server action that reads the ask on the couple's session first", () => {
  const actions = read('app/dashboard/[eventId]/access-requests/actions.ts');
  const answer = body(actions, 'async function answerClaimAccess(');
  const readAt = answer.indexOf(".from('event_access_requests')");
  const grantAt = answer.indexOf(".rpc('answer_claim_access_request'");
  assert.ok(readAt > 0, "the answer no longer reads the ask on the couple's own session");
  assert.ok(grantAt > readAt, "the grant runs before the couple's read proved the ask is theirs");
  assert.match(answer.slice(0, grantAt), /createClient\(\)/, "the ask is not read on the caller's session");
  assert.match(answer, /COORDINATOR_AREAS/, 'a coordinator is no longer seated with the coordinator grant');
});
