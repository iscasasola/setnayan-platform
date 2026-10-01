/**
 * admin-do-it-from-admin.test.ts — P5a part 2 (admin audit 2026-09-30).
 *
 * One property per fixed row, each written so that undoing the fix turns it
 * RED. Source-level, comments stripped (a docblock ABOUT a fix must never pass
 * for the fix), anchored on the code that renders or decides — the render-level
 * pattern of lib/admin-reads-are-truthful.test.ts.
 *
 *   §2e  Download their data — admin-gated, logged, message text withheld.
 *   §3.4 Supplier record page — every read says when it failed.
 *   row 38 Morning digest — "sent" only survives an accepted email; the switch
 *          sits next to the delivery log's answer, on Notifications.
 *   row 25 Unclaimed suppliers exclude demo shops.
 *   row 22 Supplier-plan names can be renamed.
 *   row 31 An approved-but-never-erased account can be erased again; the
 *          confirm text says what erasure really does.
 *   row 37 Unlock waits for a finished scan; Re-scan is always there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { summarizeDigestSends } from '@/lib/admin/digest-content';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function fnBody(s: string, signature: string): string {
  const start = s.indexOf(signature);
  assert.ok(start >= 0, `${signature} moved — re-anchor this guard`);
  return s.slice(start, s.indexOf('\n}\n', start));
}

// ── §2e · Download their data ─────────────────────────────────────────────────

test('§2e — the admin export door is admin-only, before it reads anyone', () => {
  const r = src('app/admin/users/[userId]/export/route.ts');
  const gate = r.indexOf('if (!isAdminProfile(profile)) return new NextResponse(\'Not found\', { status: 404 });');
  assert.ok(gate > 0, 'the admin gate is gone — a route handler is NOT covered by the /admin layout');
  assert.ok(gate < r.indexOf('getUserById('), 'the subject is looked up before the caller is proven an admin');
  assert.ok(gate < r.indexOf('buildPersonalDataExport('), 'the file is built before the caller is proven an admin');
});

test('§2e — every file an admin prepares is logged, and says an admin prepared it', () => {
  const r = src('app/admin/users/[userId]/export/route.ts');
  assert.match(r, /buildPersonalDataExport\(subject, admin, 'setnayan_admin'\)/);
  assert.match(r, /logAdminDataAccess\(admin, \{[\s\S]{0,200}surface: 'admin_user_data_export'/);
  const self = src('app/api/profile/export/route.ts');
  assert.doesNotMatch(self, /'setnayan_admin'/, 'the self-serve file now claims an admin prepared it');
});

test('§2e — staff never receive message text in a file they prepare', () => {
  const lib = src('lib/personal-data-export.ts');
  assert.match(lib, /chat_messages_authored: forAdmin \? withoutMessageText\(messages\.rows\) : messages\.rows/);
  assert.match(lib, /samahan_messages: forAdmin \? withoutMessageText\(samahanMessages\.rows\) : samahanMessages\.rows/);
});

// ── §3.4 · Supplier record page ───────────────────────────────────────────────

test('§3.4 — the supplier record page says "Couldn\'t load", never a confident blank', () => {
  const p = src('app/admin/vendors/[vendorProfileId]/page.tsx');
  for (const read of ['shopRead', 'teamRead', 'appRead', 'payoutRead']) {
    assert.match(p, new RegExp(`if \\(${read}\\.error\\)`), `${read} no longer checks its own error`);
  }
  assert.match(p, /teamRead\.error \|\| teamRead\.count === null/, 'an unread team size can read as 0');
  assert.match(p, /readError=\{payoutRead\.error\}/, 'payouts render an empty table on a refused read');
  assert.match(p, /logAdminDataAccess\(admin, \{/, 'opening a supplier record is no longer logged');
});

// ── row 38 · Morning digest ───────────────────────────────────────────────────

test('row 38 — the digest claim is released unless an email was actually accepted', () => {
  const f = src('lib/admin/digest-flush.ts');
  assert.match(f, /if \(result\.ok\) accepted \+= 1;/, 'the send result is ignored again');
  assert.match(f, /if \(accepted === 0\) await releaseClaim\(/, '"sent" survives a morning where nothing went out');
  assert.match(f, /kind: DIGEST_EMAIL_KIND/, 'digest emails are logged as "other" — the card cannot find them');
});

test('row 38 — what the card says, from the delivery log', () => {
  assert.deepEqual(summarizeDigestSends(null), { state: 'unread' }, 'a refused read must not read as "never"');
  assert.deepEqual(summarizeDigestSends([]), { state: 'never' });
  const t = '2026-10-01T00:00:00Z';
  const t2 = '2026-10-01T00:00:30Z';
  assert.deepEqual(
    summarizeDigestSends([
      { created_at: t2, outcome: 'send_failed', error: 'boom' },
      { created_at: t, outcome: 'accepted', error: null },
    ]),
    { state: 'sent', at: t },
    'one accepted email in the morning batch means the digest went out',
  );
  const failed = summarizeDigestSends([
    { created_at: '2026-10-02T00:00:00Z', outcome: 'not_configured', error: null },
    { created_at: t, outcome: 'accepted', error: null },
  ]);
  assert.equal(failed.state, 'failed');
  assert.equal(failed.state === 'failed' && failed.lastSentAt, t);
});

test('row 38 — the switch lives next to the answer, on Notifications', () => {
  const card = src('app/admin/settings/_components/morning-digest-card.tsx');
  assert.match(card, /summarizeDigestSends\(rows\)/);
  assert.match(card, /if \(error\) logQueryError\([^;]*;\s*else rows =/, 'a refused log read becomes "never sent"');
  assert.match(card, /action=\{saveAdminDigest\}/);
  assert.match(src('app/admin/settings/_surfaces/notifications-surface.tsx'), /<MorningDigestCard \/>/);
  assert.doesNotMatch(
    src('app/admin/settings/_surfaces/settings-surface.tsx'),
    /saveAdminDigest/,
    'a second digest switch came back on Settings',
  );
  const save = fnBody(src('app/admin/settings/actions.ts'), 'export async function saveAdminDigest(');
  assert.doesNotMatch(save, /error\.message\)/, 'the raw database message reaches the screen again');
});

// ── row 25 · unclaimed suppliers ──────────────────────────────────────────────

test('row 25 — the unclaimed list leaves demo shops to their own list', () => {
  const s = src('app/admin/accounts/_surfaces/vendors-surface.tsx');
  assert.match(s, /\.is\('user_id', null\)\s*\.eq\('is_demo', false\)/);
});

// ── row 22 · supplier-plan names ──────────────────────────────────────────────

test('row 22 — a supplier plan can be renamed from the catalogue', () => {
  const save = fnBody(src('app/admin/pricing/actions.ts'), 'export async function saveVendorRow(');
  assert.match(save, /\.update\(\{ title, price_php/, 'saveVendorRow no longer writes the title');
  assert.match(save, /prior\.title === title/, 'a rename alone reads as "No changes to save."');
  const editor = src('app/admin/pricing/_components/catalog-editor.tsx');
  assert.doesNotMatch(editor, /edit in code/, 'the developer note is back on screen');
  assert.equal([...editor.matchAll(/<input name="title"/g)].length, 1, 'the name field is split by kind again');
});

// ── row 31 · account erasure ──────────────────────────────────────────────────

test('row 31 — an approved request whose account was never erased can be finished', () => {
  const a = src('app/admin/account-deletions/actions.ts');
  assert.match(a, /if \(formData\.get\('intent'\) === 'rerun'\) return rerunErasure\(formData\);/);
  assert.doesNotMatch(a, /export async function rerunErasure/, 'a new exported server action — the budget is at its ceiling');
  const rerun = fnBody(a, 'async function rerunErasure(');
  assert.match(rerun, /loadPendingRequest\(requestId, 'approved'\)/);
  assert.match(rerun, /\.select\('deleted_at'\)/, 'it re-runs on an account that may already be erased');
  const p = src('app/admin/account-deletions/page.tsx');
  assert.match(p, /if \(accountsUnresolved\) return/, 'an unread account is offered a re-run on a guess');
  assert.match(p, /if \(!u \|\| u\.deleted_at\) return/);
  assert.match(p, /name="intent" value="rerun"/);
});

test('row 31 — the confirm text describes the erasure that actually runs', () => {
  const p = src('app/admin/account-deletions/page.tsx');
  assert.doesNotMatch(p, /cascade-deletes|hard-deletes the account/, 'the confirm promises a hard delete that has not happened since 2026-07');
  assert.match(p, /\$\{ERASURE_WORDS\}/);
});

// ── row 37 · editorial review ─────────────────────────────────────────────────

test('row 37 — Unlock waits for a finished scan, and the server agrees', () => {
  const p = src('app/admin/editorial-review/[editorialId]/page.tsx');
  assert.match(p, /const canUnlock = scanFinished && /, 'Unlock is offered on a scan that never ran');
  assert.doesNotMatch(p, /\{\(row\.scan_status === 'flagged'/, 'Re-scan is hidden in some states again');
  const a = src('app/admin/editorial-review/[editorialId]/actions.ts');
  const unlock = fnBody(a, 'export async function unlockForCouple(');
  assert.match(unlock, /scan_status === 'pending' \|\| data\.scan_status === 'scanning'/);
});
