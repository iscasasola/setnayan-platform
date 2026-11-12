/**
 * 🔒 The locks' TypeScript side says what the SQL says: every refusal the database can return has words, every RPC the
 * switch calls exists, and a check that cannot be made REFUSES (an ask written past a lock is the bug).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

import { askRefusal, flipLock, LOCK_REFUSAL_WORDS } from './supplier-locks';

const MIG = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const sql = readdirSync(MIG)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(MIG, f), 'utf8'))
  .join('\n');

const fake = (answer: { data: unknown; error: unknown }) => ({ rpc: async () => answer }) as unknown as SupabaseClient;

test('every word supplier_lock_refusal can return has a sentence here', () => {
  const body = sql.slice(sql.lastIndexOf('CREATE OR REPLACE FUNCTION public.supplier_lock_refusal'));
  for (const w of ['quote_locked', 'plan_locked', 'form_locked', 'not_found']) {
    assert.ok(body.includes(`'${w}'`), `the SQL no longer returns ${w}`);
    assert.ok(LOCK_REFUSAL_WORDS[w as keyof typeof LOCK_REFUSAL_WORDS], `no words for ${w}`);
  }
});

test('a final quotation says the guest count can still move it — and the repricer that makes that true exists', () => {
  // DECISION_LOG 2026-11-12: the supplier's Quotation lock stops the couple's asks, never the guest list.
  assert.equal(
    LOCK_REFUSAL_WORDS.quote_locked,
    'The supplier marked this quotation final — only your guest count can move the price.',
  );
  assert.doesNotMatch(LOCK_REFUSAL_WORDS.quote_locked, /won.t change/);
  // The sentence is only true while the repricer exists and does NOT skip a changes_locked quote.
  const body = sql.slice(sql.lastIndexOf('CREATE OR REPLACE FUNCTION public.quote_follow_guest_count('));
  assert.ok(body.length > 0 && body.includes('FOR UPDATE'), 'quote_follow_guest_count is gone');
  const fn = body.slice(0, body.indexOf('$$;'));
  // 📉 Since the fall-back (migration 20271340566104, DECISION_LOG "WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK — UNLESS
  // THE SUPPLIER LOCKED IT") the repricer DOES read the lock — but only to stop a FALL: it may never skip a locked quote.
  // The rise itself is held by tests/db/a-quote-follows-the-guest-list.db.test.ts ("rises but never falls back").
  const skips = fn.split('\n').filter((l) => /locked/.test(l) && /CONTINUE|RETURN/.test(l));
  assert.deepEqual(skips, [], 'the repricer must not skip a final quotation — it still rises with the list');
  assert.match(fn, /quote_follow_lines\(r\.line_items, v_billed, NOT v_locked\)/, 'the lock only decides whether the lines may fall');
  const ifs = [...fn.matchAll(/IF[^;]*v_locked[^;]*THEN\s+CONTINUE/g)];
  assert.equal(ifs.length, 0, 'no lock branch ends in CONTINUE');
});

test('the RPCs the switch and the check call exist in the migrations', () => {
  for (const fn of ['supplier_lock_refusal', 'vendor_set_proposal_lock', 'vendor_set_form_lock']) {
    assert.ok(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`).test(sql), fn);
  }
});

test('askRefusal: null = may ask; a lock is named; a failed check refuses', async () => {
  assert.equal(await askRefusal(fake({ data: null, error: null }), 'quote', 'p'), null);
  assert.equal(await askRefusal(fake({ data: 'plan_locked', error: null }), 'plan', 'p'), 'plan_locked');
  assert.equal(await askRefusal(fake({ data: null, error: { code: '42501' } }), 'form', 'f', 'e'), 'unreadable');
  assert.equal(await askRefusal(fake({ data: 'something_new', error: null }), 'quote', 'p'), 'unreadable');
});

test('flipLock: the server word comes back; an error is "failed", never ok', async () => {
  assert.equal(await flipLock(fake({ data: 'ok', error: null }), 'quote', 'p', true, 'e'), 'ok');
  assert.equal(await flipLock(fake({ data: 'not_allowed', error: null }), 'form', 'f', true, 'e'), 'not_allowed');
  assert.equal(await flipLock(fake({ data: null, error: { code: 'x' } }), 'plan', 'p', false, 'e'), 'failed');
});
