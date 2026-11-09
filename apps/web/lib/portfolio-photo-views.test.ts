/**
 * 🔒 PORTFOLIO PHOTOS COUNT THEIR VIEWS (Build 3 Lane E item 11; DECISION_LOG 2026-11-09 👁).
 * The owner's rules, held where they live — the migration — plus the one caller:
 *   · ONE writer: a SECURITY DEFINER function, service role only (never anon/authenticated, never a client UPDATE);
 *   · the shop's own people (owner + team) and admins never count;
 *   · one per viewer per photo per Manila day (a primary key + ON CONFLICT DO NOTHING);
 *   · one atomic increment (`views = v.views + 1`), never read → add → write;
 *   · the viewer is HASHED (sha256 hex), never a raw id; RLS on at create time;
 *   · exactly one place in the app calls the RPC, and it hashes the viewer first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const MIG_DIR = join(process.cwd(), '..', '..', 'supabase', 'migrations');
const file = readdirSync(MIG_DIR).find((f) => f.endsWith('_portfolio_photo_views.sql'));
const SQL = file ? readFileSync(join(MIG_DIR, file), 'utf8').replace(/--.*$/gm, '') : '';

test('the migration exists and turns RLS on for both tables', () => {
  assert.ok(file, 'the portfolio photo views migration is gone');
  for (const t of ['vendor_portfolio_photo_view_days', 'vendor_portfolio_photo_views']) {
    assert.match(SQL, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t}`));
    assert.match(SQL, new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`), `${t} has no RLS`);
    assert.match(SQL, new RegExp(`REVOKE ALL ON TABLE public\\.${t} FROM PUBLIC, anon, authenticated`), `${t} is open to the public key`);
  }
});

test('ONE writer: security definer, service role only', () => {
  assert.match(SQL, /CREATE OR REPLACE FUNCTION public\.record_portfolio_photo_view\(/);
  assert.match(SQL, /SECURITY DEFINER\s+SET search_path = public/);
  assert.match(SQL, /REVOKE ALL ON FUNCTION public\.record_portfolio_photo_view\(UUID, TEXT, TEXT, UUID\) FROM PUBLIC, anon, authenticated;/);
  assert.match(SQL, /GRANT EXECUTE ON FUNCTION public\.record_portfolio_photo_view\(UUID, TEXT, TEXT, UUID\) TO service_role;/);
  assert.doesNotMatch(SQL, /GRANT (INSERT|UPDATE|DELETE)/, 'a table write grant crept in');
});

test('the shop’s own people and admins never count; only a photo on the portfolio counts', () => {
  assert.match(SQL, /account_type = 'admin'/);
  assert.match(SQL, /vp\.user_id = p_viewer_user_id/);
  assert.match(SQL, /vendor_team_members tm WHERE tm\.vendor_profile_id = p_vendor_profile_id AND tm\.user_id = p_viewer_user_id/);
  assert.match(SQL, /p_photo_key = ANY \(vp\.portfolio_r2_keys\)/);
});

test('one per viewer per photo per Manila day, then one atomic increment', () => {
  assert.match(SQL, /PRIMARY KEY \(vendor_profile_id, photo_key, viewer_hash, viewed_on\)/);
  assert.match(SQL, /now\(\) AT TIME ZONE 'Asia\/Manila'/);
  assert.match(SQL, /ON CONFLICT DO NOTHING;\s*GET DIAGNOSTICS v_new = ROW_COUNT;/);
  assert.match(SQL, /DO UPDATE SET views = v\.views \+ 1/);
  assert.match(SQL, /viewer_hash ~ '\^\[0-9a-f\]\{64\}\$'/, 'the viewer is not held to a hash');
});

test('exactly one caller, and it hashes the viewer first', () => {
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.name === 'node_modules' || e.name.startsWith('.') ? [] : e.isDirectory() ? walk(join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [join(d, e.name)] : [],
    );
  const callers = [...walk(join(process.cwd(), 'app')), ...walk(join(process.cwd(), 'lib'))].filter((f) =>
    /rpc\(\s*'record_portfolio_photo_view'/.test(readFileSync(f, 'utf8')),
  );
  assert.deepEqual(callers.map((f) => f.slice(process.cwd().length + 1)), ['lib/record-portfolio-photo-view.ts']);
  const rec = stripComments(readFileSync(join(process.cwd(), 'lib/record-portfolio-photo-view.ts'), 'utf8'));
  assert.match(rec, /p_viewer_hash: hashViewer\(raw\)/);
  assert.match(rec, /createAdminClient\(\)\.rpc\('record_portfolio_photo_view'/);
});
