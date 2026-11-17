import { createHash } from 'node:crypto';

/**
 * De-identify a viewer. Returns sha256(salt || id) — a stable, non-reversible
 * hash so unique-viewer counts work without ever storing the raw user_id /
 * anon-session id. NEVER store or expose the input `id`.
 *
 * Salt resolves from VIEWER_HASH_SALT, falling back to SUPABASE_SERVICE_ROLE_KEY
 * (mirrors lib/guest-session.ts) — the hash is non-reversible either way; the
 * dedicated salt just decouples it from the service key for rotation.
 */
export function hashViewer(id: string): string {
  const salt =
    process.env.VIEWER_HASH_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createHash('sha256').update(`${salt}:${id}`).digest('hex');
}
