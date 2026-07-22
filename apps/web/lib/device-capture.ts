'use server';

import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { deviceFingerprintEnabled } from '@/lib/device-capture-flag';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';

/**
 * Phase E slice 1 — record a secured account's coarse device id into
 * `user_devices` (the dormant fraud-cluster capture path). The client sends a
 * random, first-party device id from localStorage; we hash it SERVER-side with a
 * stable salt (same id → same hash, so a shared browser links accounts) and
 * upsert one row per (user, device_hash). The raw id never lands in the DB.
 *
 * Writes go through the caller's OWN RLS session — `user_devices` already has an
 * owner-write policy (user_id = auth.uid()), so no elevated client is needed.
 * Only SECURED (non-anonymous) accounts are captured. Entirely best-effort +
 * flag-gated: never throws, does nothing when the flag is off. RA 10173: the
 * stored value is a pseudonymous hash used solely for fraud prevention.
 */
const DEVICE_HASH_SALT = process.env.DEVICE_HASH_SALT ?? 'sn-device-fp-v1';

export async function recordDeviceHash(deviceId: string): Promise<void> {
  // AND-gate: the client-side env flag is the pre-check, but the authoritative
  // RA 10173 gate is the `device_fingerprint` data-privacy control (DPO-gated).
  // BOTH must be on before any device id is collected/hashed/stored. Fail-closed.
  if (!deviceFingerprintEnabled()) return;
  if (!(await isDataPrivacyControlActive('device_fingerprint'))) return;
  const raw = typeof deviceId === 'string' ? deviceId.trim() : '';
  // A well-formed client id is a UUID (~36 chars). Bound the input hard so a
  // forged/oversized value can never be abused as a storage vector.
  if (raw.length < 8 || raw.length > 200) return;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Only secured accounts — an anonymous draft has no fraud-subject identity
    // and its placeholder shouldn't seed a cluster.
    if (!user || user.is_anonymous) return;

    const hash = createHash('sha256').update(`${DEVICE_HASH_SALT}:${raw}`).digest('hex');
    await supabase.from('user_devices').upsert(
      {
        user_id: user.id,
        device_hash: hash,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_hash' },
    );
  } catch {
    // Best-effort — capture must never block or surface to the user.
  }
}
