import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  decryptUnderPrimary,
  decryptUnderPrevious,
  encryptToken,
} from '@/lib/encryption';
import { ALL_SECRET_COLUMNS } from '@/lib/integrations/registry';

// ENCRYPTION_KEY rotation — the re-encrypt sweep.
//
// Step 4 of the dual-key runbook on /admin/secrets. With ENCRYPTION_KEY = the
// NEW key and ENCRYPTION_KEY_PREVIOUS = the OLD one, this walks every place the
// app stores AES-256-GCM ciphertext and rewrites anything still sealed under the
// old key. When it reports failed = 0 AND reencrypted = 0, nothing depends on
// the previous key any more and it is safe to delete from Vercel.
//
// The three storage sites are the COMPLETE set of encryptToken() call sites as
// of 2026-07-25 (grep-verified): the integration-secrets singleton, the Photo
// Delivery OAuth token on events, and the vendor Instagram token. Add a case
// here the moment a fourth appears — a missed site becomes silent data loss the
// next time the key rotates.
//
// SECURITY: plaintext exists only as a local const between decrypt and
// re-encrypt. Nothing is logged, returned, or thrown with a value attached — the
// return type is three integers. A value that decrypts under NEITHER key is
// counted as `failed` and LEFT UNTOUCHED (never nulled): it may be pre-existing
// corruption, and destroying it would be worse than leaving it.

export type ReencryptCounts = {
  /** Rewritten from the previous key to the primary. */
  reencrypted: number;
  /** Already sealed under the primary — no write performed. */
  alreadyCurrent: number;
  /** Decrypts under neither key — left exactly as-is for manual triage. */
  failed: number;
};

type Counts = ReencryptCounts;

const EMPTY: Counts = { reencrypted: 0, alreadyCurrent: 0, failed: 0 };

function add(a: Counts, b: Counts): Counts {
  return {
    reencrypted: a.reencrypted + b.reencrypted,
    alreadyCurrent: a.alreadyCurrent + b.alreadyCurrent,
    failed: a.failed + b.failed,
  };
}

/**
 * Classify one ciphertext. Returns the fresh ciphertext when a rewrite is
 * needed, otherwise null plus the bucket it fell into.
 */
function reseal(
  ciphertext: string,
): { next: string | null; counts: Counts } {
  if (decryptUnderPrimary(ciphertext) !== null) {
    return { next: null, counts: { ...EMPTY, alreadyCurrent: 1 } };
  }
  const viaPrevious = decryptUnderPrevious(ciphertext);
  if (viaPrevious === null) {
    return { next: null, counts: { ...EMPTY, failed: 1 } };
  }
  return { next: encryptToken(viaPrevious), counts: { ...EMPTY, reencrypted: 1 } };
}

/** Every encrypted column on the platform_integration_secrets singleton. */
function integrationSecretColumns(): string[] {
  // resend_api_key_enc predates the registry (PR1 bespoke card) so it isn't in
  // ALL_SECRET_COLUMNS — union it in explicitly.
  return [...new Set([...ALL_SECRET_COLUMNS, 'resend_api_key_enc'])];
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function sweepIntegrationSecrets(admin: AdminClient): Promise<Counts> {
  const columns = integrationSecretColumns();
  const { data, error } = await admin
    .from('platform_integration_secrets')
    .select(columns.join(', '))
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return EMPTY;

  const row = data as unknown as Record<string, unknown>;
  const patch: Record<string, string> = {};
  let counts = EMPTY;

  for (const column of columns) {
    const value = row[column];
    if (typeof value !== 'string' || !value) continue;
    const { next, counts: c } = reseal(value);
    counts = add(counts, c);
    if (next) patch[column] = next;
  }

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await admin
      .from('platform_integration_secrets')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (updErr) {
      // The write failed — those rows are NOT re-encrypted. Re-bucket them as
      // failures so the operator keeps ENCRYPTION_KEY_PREVIOUS and retries.
      const moved = Object.keys(patch).length;
      counts = {
        ...counts,
        reencrypted: counts.reencrypted - moved,
        failed: counts.failed + moved,
      };
    }
  }
  return counts;
}

/**
 * Generic single-column sweep over a table's non-null ciphertext rows.
 * Paged — these tables are small today, but an unbounded select is a trap.
 */
async function sweepColumn(
  admin: AdminClient,
  table: string,
  pkColumn: string,
  valueColumn: string,
): Promise<Counts> {
  const PAGE = 500;
  let counts = EMPTY;
  let from = 0;

  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select(`${pkColumn}, ${valueColumn}`)
      .not(valueColumn, 'is', null)
      .order(pkColumn, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return counts;
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    if (rows.length === 0) return counts;

    for (const row of rows) {
      const value = row[valueColumn];
      const pk = row[pkColumn];
      if (typeof value !== 'string' || !value || pk == null) continue;
      const { next, counts: c } = reseal(value);
      counts = add(counts, c);
      if (!next) continue;
      const { error: updErr } = await admin
        .from(table)
        .update({ [valueColumn]: next })
        .eq(pkColumn, pk as string);
      if (updErr) {
        counts = {
          ...counts,
          reencrypted: counts.reencrypted - 1,
          failed: counts.failed + 1,
        };
      }
    }

    if (rows.length < PAGE) return counts;
    from += PAGE;
  }
}

/**
 * Re-seal every stored ciphertext under the CURRENT ENCRYPTION_KEY.
 * Idempotent — a second run on a settled system reports only alreadyCurrent.
 */
export async function reencryptStoredSecrets(): Promise<ReencryptCounts> {
  const admin = createAdminClient();
  let counts = EMPTY;

  // 1. Integration console secrets (singleton, many columns).
  counts = add(counts, await sweepIntegrationSecrets(admin));

  // 2. Photo Delivery OAuth token, one per event.
  counts = add(
    counts,
    await sweepColumn(admin, 'events', 'event_id', 'photo_delivery_oauth_token_encrypted'),
  );

  // 3. Vendor Instagram access token, one per vendor.
  counts = add(
    counts,
    await sweepColumn(
      admin,
      'vendor_ig_connections',
      'vendor_ig_connection_id',
      'access_token_enc',
    ),
  );

  return counts;
}
