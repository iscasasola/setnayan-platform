import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/encryption';
import { CONSOLE_COLUMN_TO_SECRET_ID } from '@/lib/secrets/rotation-registry';

// The ONE write layer for DB-stored platform secrets.
//
// Two surfaces set the same keys: the Integration Activation Console
// (/admin/integrations, feature setup) and the Secrets & Rotation board
// (/admin/secrets, the rotation dashboard). Before this module each console
// action carried its own copy of "encrypt → update the singleton → stamp the
// rotation clock"; a second copy on the board would have been the third, and
// the first place a crypto or allowlist fix would fail to land. So both call
// through here and there is exactly one implementation.
//
// SECURITY CONTRACT:
//   • Plaintext arrives, ciphertext leaves. Nothing here logs, returns, or
//     echoes a value — the result type carries a status code and nothing else.
//   • COLUMN NAMES ARE THE CALLER'S ALLOWLIST DUTY. Every caller resolves its
//     columns from a static registry (lib/integrations/registry.ts or
//     lib/secrets/rotation-registry.ts); a raw form field must never reach these
//     functions as a column name.
//   • Writes target the platform_integration_secrets SINGLETON (id = 1), which
//     is deny-by-default (no RLS policies) — hence the service-role client.

/**
 * Success, or a short boring code. Deliberately NOT the driver's error message:
 * a Postgres error can quote the offending value back at you, and this path
 * handles secret material.
 */
export type SecretWriteResult =
  | { ok: true; columns: string[] }
  | { ok: false; code: 'write_failed' | 'row_missing' | 'encrypt_failed' };

/**
 * Columns that stop being true the moment a secret column is cleared.
 *
 * `last_verified_at` records "this Resend key sent a test email successfully".
 * Leaving it behind after the key is removed makes the console claim a verified
 * key that no longer exists. Encoded here (rather than at one call site) so the
 * board's clear button inherits the same correction the console's always had.
 */
const COMPANION_NULL_ON_CLEAR: Readonly<Record<string, readonly string[]>> = {
  resend_api_key_enc: ['last_verified_at'],
};

/**
 * Reset the rotation clock for the registry rows behind these columns.
 *
 * BEST-EFFORT BY CONTRACT: wrapped so a missing table (pre-migration), an
 * unmapped column, or any DB hiccup can never turn a successful key save into a
 * failed action. Bookkeeping must never outrank the thing it books.
 *
 * Columns that share a registry id (Maya's public + secret key) collapse to a
 * single stamp — the pair is one rotation.
 */
async function stampRotationForColumns(
  columns: readonly string[],
  note: string,
): Promise<void> {
  const secretIds = [
    ...new Set(
      columns
        .map((column) => CONSOLE_COLUMN_TO_SECRET_ID[column])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (secretIds.length === 0) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nowIso = new Date().toISOString();
    const admin = createAdminClient();
    await admin.from('platform_secret_rotations').upsert(
      secretIds.map((secretId) => ({
        secret_id: secretId,
        last_rotated_at: nowIso,
        rotated_by: user?.email ?? user?.id ?? null,
        note,
        updated_at: nowIso,
      })),
      { onConflict: 'secret_id' },
    );
  } catch {
    // Never fatal.
  }
}

/**
 * Encrypt and persist one or more secret columns on the singleton, then stamp
 * the rotation clock for whatever registry rows they belong to.
 *
 * Pass ONLY the columns the owner actually filled in — a blank field means
 * "keep what's there", so the caller drops it before calling. That is what makes
 * a partial save (one half of the Maya pair, the Resend key without touching the
 * from-address) safe: an untouched column is never named in the patch, so the
 * UPDATE cannot null it.
 *
 * @param plaintextByColumn column (from a static registry) → the new plaintext
 * @param note              rotation-log note, e.g. which surface saved it
 */
export async function writeIntegrationSecretColumns(
  plaintextByColumn: Record<string, string>,
  note: string,
): Promise<SecretWriteResult> {
  const columns = Object.keys(plaintextByColumn);
  if (columns.length === 0) return { ok: true, columns: [] };

  const patch: Record<string, string> = {};
  try {
    for (const column of columns) {
      patch[column] = encryptToken(plaintextByColumn[column] as string);
    }
  } catch {
    // ENCRYPTION_KEY missing or malformed — storing plaintext is not an option.
    return { ok: false, code: 'encrypt_failed' };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('platform_integration_secrets')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1)
      // `id` only — the ciphertext must not travel back into a render tree.
      // Selecting also tells us whether the singleton row actually exists: a
      // bare .update() on a missing row succeeds with zero rows touched, which
      // would otherwise report a save that never happened.
      .select('id');
    if (error) return { ok: false, code: 'write_failed' };
    if (!data || data.length === 0) return { ok: false, code: 'row_missing' };
  } catch {
    return { ok: false, code: 'write_failed' };
  }

  await stampRotationForColumns(columns, note);
  return { ok: true, columns };
}

/**
 * Null out one or more stored secret columns (plus any companion column that
 * only made sense while the secret existed). Does NOT stamp a rotation — an
 * emptied slot is not a rotated key, and pretending otherwise would silence the
 * board's alarm for a secret that is now missing entirely.
 */
export async function clearIntegrationSecretColumns(
  columns: readonly string[],
): Promise<SecretWriteResult> {
  if (columns.length === 0) return { ok: true, columns: [] };

  const patch: Record<string, null> = {};
  for (const column of columns) {
    patch[column] = null;
    for (const companion of COMPANION_NULL_ON_CLEAR[column] ?? []) {
      patch[companion] = null;
    }
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('platform_integration_secrets')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select('id');
    if (error) return { ok: false, code: 'write_failed' };
    if (!data || data.length === 0) return { ok: false, code: 'row_missing' };
  } catch {
    return { ok: false, code: 'write_failed' };
  }

  return { ok: true, columns: [...columns] };
}

/** Rotation-log note for a save made on the Integration Activation Console. */
export const CONSOLE_SAVE_NOTE = 'Saved from the Integrations console.';
/** Rotation-log note for a save made on the Secrets & Rotation board. */
export const BOARD_SAVE_NOTE = 'Pasted on the Secrets & Rotation board.';
