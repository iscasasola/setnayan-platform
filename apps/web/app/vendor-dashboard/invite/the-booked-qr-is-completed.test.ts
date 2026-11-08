/**
 * 🎟 THE BOOKED QR IS THE SHIPPED LOCKED QR, COMPLETED (Supplier Build 2 row #34; owner: *"this is a one-time QR…
 * it needs to create a quotation… identify how much the client paid already… track and delete a QR"*).
 *
 * The database half (the column, the void, the forward-only status) is held by
 * `tests/db/booked-qr-quote-lines-and-void.db.test.ts`. This holds the app half:
 *   · the quotation is built in place and stored in the ONE quote-line shape; the Total is the lines' sum, re-added on
 *     the server — never the typed figure;
 *   · changing a waiting code = void + reissue, the NEW code made first, the old one voided after, and the new one
 *     voided back if the old was scanned meanwhile (never two live codes, never none);
 *   · the Booked QRs list: Waiting · Used · Deleted; tap waiting = change it, tap used = that client, swipe a waiting
 *     one = delete with Undo (written when the window closes), a deleted one has no door.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockQuoteTotalPhp, sanitizeLockQuoteLines } from '@/lib/vendor-locked-qr';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = readFileSync(join(HERE, 'actions.ts'), 'utf8');
const PAGE = readFileSync(join(HERE, 'page.tsx'), 'utf8');
const GEN = readFileSync(join(HERE, '_components', 'locked-qr-generator.tsx'), 'utf8');
const LIST = readFileSync(join(HERE, '_components', 'booked-qrs-list.tsx'), 'utf8');
const MIGRATION = readFileSync(join(HERE, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20271327929301_booked_qr_quote_lines_and_void.sql'), 'utf8');

test('the quote lines are cleaned into the one quote-line shape; the Total is their sum', () => {
  const lines = sanitizeLockQuoteLines([
    { label: ' Full-day coverage ', detail: '', amount_centavos: 6_500_000.4 },
    { label: '', amount_centavos: 100 }, // no label → dropped
    { label: 'Refund', amount_centavos: -5 }, // negative → dropped
    { label: 'Same-day edit', detail: 'Shown at the reception', amount_centavos: '1500000' },
    'junk',
  ]);
  assert.deepEqual(lines, [
    { label: 'Full-day coverage', detail: null, amount_centavos: 6_500_000 },
    { label: 'Same-day edit', detail: 'Shown at the reception', amount_centavos: 1_500_000 },
  ]);
  assert.equal(lockQuoteTotalPhp(lines), 80_000);
  assert.deepEqual(sanitizeLockQuoteLines({ label: 'not a list' }), []);
  // The same shape `vendor_proposals.line_items` stores and `accepted-quote-terms` reads.
  assert.match(MIGRATION, /vendor_proposals\.line_items/);
});

test('issue: the lines are stored, and with lines the Total is re-added on the server', () => {
  assert.match(ACTIONS, /quoteLines = sanitizeLockQuoteLines\(JSON\.parse\(String\(formData\.get\('quote_lines_json'\) \?\? '\[\]'\)\)\);/);
  assert.match(
    ACTIONS,
    /const totalPhp = quoteLines\.length > 0 \? lockQuoteTotalPhp\(quoteLines\) : toAmount\(formData\.get\('total_php'\)\);/,
    'the typed Total is trusted over the quotation',
  );
  assert.match(ACTIONS, /quote_line_items: quoteLines\.length > 0 \? quoteLines : null,/, 'an issue without lines claims "no lines" ([])');
});

test('change = void + reissue: the new code first, the old one voided after, the new one undone if the old was scanned', () => {
  const at = (s: string) => ACTIONS.indexOf(s);
  assert.ok(at(".from('vendor_locked_qr_tokens')\n    .insert(") > 0);
  const insert = at('quote_line_items: quoteLines.length');
  const voidOld = at("supabase.rpc('vendor_void_locked_qr', { p_token: replaces })");
  assert.ok(insert > 0 && voidOld > insert, 'the old code is voided before the new one exists — a refusal leaves no code');
  // The withdraw of the NEW code is read (a Supabase call resolves with { error }): if THAT refuses too, both codes
  // stand and the shop is told so (`replace_both_live`) — never "nothing new was made".
  assert.match(ACTIONS, /if \(voidError \|\| \(gone !== 'void' && gone !== 'already_void'\)\) \{[\s\S]{0,400}?const \{ data: rolledBack, error: rollbackError \} = await supabase\.rpc\('vendor_void_locked_qr', \{\s*p_token: inserted\.token,\s*\}\);\s*if \(rollbackError \|\| rolledBack !== 'void'\) fail\('replace_both_live'\);/);
  assert.match(PAGE, /replace_both_live:\s*'The change didn’t go through/, 'the both-live refusal has its own words');
  assert.match(ACTIONS, /fail\(gone === 'claimed' \? 'replaced_claimed' : 'issue'\);/);
  assert.match(PAGE, /replaced_claimed:/, 'the refusal has no words');
  // The form carries what it replaces, and opens filled from the waiting code (this shop's, still waiting).
  assert.match(GEN, /\{initial\?\.replaces \? <input type="hidden" name="replaces" value=\{initial\.replaces\} \/> : null\}/);
  assert.match(PAGE, /\.eq\('token', search\.edit\)\s*\.eq\('vendor_profile_id', vendorProfileId\)\s*\.eq\('status', 'pending'\)/);
});

test('the generator builds the quotation in place and its Total follows the lines', () => {
  assert.match(GEN, /<input type="hidden" name="quote_lines_json" value=\{JSON\.stringify\(quoteLinesJson\)\} \/>/);
  assert.match(GEN, /readOnly=\{lines\.length > 0\}/, 'the Total can be typed against the quotation');
  assert.match(GEN, /if \(lines\.length > 0\) setTotal\(linesTotal > 0 \? String\(linesTotal\) : ''\);/);
  // A picked service seeds its line; unpicked, its line goes.
  assert.match(GEN, /setLines\(\(prev\) => \[\.\.\.prev, \{ key: nextKey\(\), label, amount: price != null && price > 0 \? String\(price\) : '', fromRef: value \}\]\);/);
  assert.match(GEN, /setLines\(\(prev\) => prev\.filter\(\(l\) => l\.fromRef !== value\)\);/);
});

test('the Booked QRs list: Waiting · Used · Deleted — change, open the client, swipe to delete with Undo', () => {
  assert.match(LIST, /\{ status: 'pending', word: 'Waiting'[\s\S]*\{ status: 'claimed', word: 'Used'[\s\S]*\{ status: 'void', word: 'Deleted'/);
  assert.match(LIST, /if \(r\.status !== 'pending'\) return <div key=\{r\.token\}>\{row\}<\/div>;/, 'a used or deleted code can be swiped away');
  assert.match(LIST, /deleteWithUndo\(\{[\s\S]{0,300}commit: \(\) => voidCode\(r\.token\),/, 'the delete is written at once — no Undo');
  // The void is a MODE of the shipped `issueLockedQr` (the action budget is at its ceiling — no new route).
  assert.match(LIST, /fd\.set\('void_token', token\);\s*return issueLockedQr\(fd\);/);
  assert.match(ACTIONS, /const voidToken = String\(formData\.get\('void_token'\) \?\? ''\)\.trim\(\);\s*if \(voidToken\) \{[\s\S]{0,300}db\.rpc\('vendor_void_locked_qr', \{ p_token: voidToken \}\)/);
  assert.match(ACTIONS, /if \(error \|\| \(data !== 'void' && data !== 'already_void'\)\) throw new Error/, 'a scanned code reads as deleted');
  assert.doesNotMatch(ACTIONS, /export async function voidLockedQr/, 'the void became its own exported action — one more Vercel route');
  // The doors: waiting → change it · used → that client's Details (#38) · deleted → none.
  assert.match(PAGE, /t\.status === 'pending'\s*\? `\$\{QR_HREF\}\?mode=locked&edit=\$\{t\.token\}`\s*: t\.status === 'claimed' && t\.claimed_event_id\s*\? customerCardHref\(t\.claimed_event_id, 'details'\)\s*: null,/);
});
