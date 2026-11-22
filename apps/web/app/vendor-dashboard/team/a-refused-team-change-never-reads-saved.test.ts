/**
 * a-refused-team-change-never-reads-saved.test.ts — Team (`/vendor-dashboard/team`), #8036 ship review 2026-11-21.
 *
 * RLS that matches no row is not an error: PostgREST answers an UPDATE or DELETE that touched nothing with no error at
 * all. `updateVendorTeamMember` and `removeVendorTeamMember` then said "saved" — and the remove signed the person out
 * of every device — for a change the database had refused (a Branch Manager reaching past their branch). Each now asks
 * for the row back, counts it, and on zero says "You can't change this person" without touching anyone's sessions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, 'actions.ts'), 'utf8'));

function body(name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is gone — re-point this guard`);
  const next = src.indexOf('\nexport async function ', start + 1);
  return src.slice(start, next < 0 ? undefined : next);
}

for (const name of ['updateVendorTeamMember', 'removeVendorTeamMember']) {
  test(`${name} counts the row it changed before it says saved`, () => {
    const b = body(name);
    const write = b.search(/\.from\('vendor_team_members'\)\s*\.(update|delete)\(/);
    assert.ok(write >= 0, 'the write moved — re-point this guard');
    const afterWrite = b.slice(write);
    assert.match(afterWrite, /\.select\('vendor_team_member_id'\)/, 'ask for the changed row back');
    const zero = afterWrite.search(/\.length === 0\) return err\(CANT_CHANGE_THIS_PERSON\)/);
    assert.ok(zero >= 0, 'zero rows must say "You can’t change this person"');
    const saved = afterWrite.indexOf("back('saved=1')");
    assert.ok(saved > zero, 'the zero-row refusal comes before "saved"');
    const revoke = afterWrite.indexOf('revokeAllSessions(');
    if (revoke >= 0) assert.ok(revoke > zero, 'sessions are revoked only after a row was really deleted');
  });
}

test('the refusal reads in the owner’s words', () => {
  assert.match(src, /const CANT_CHANGE_THIS_PERSON = 'You can’t change this person';/);
});
