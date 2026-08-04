'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSecretDef,
  secretFields,
  dbPasteFields,
  consoleColumnsForSecret,
} from '@/lib/secrets/rotation-registry';
import { upsertProjectEnv, triggerProdRedeploy } from '@/lib/vercel-env';
import { reencryptStoredSecrets, type ReencryptCounts } from '@/lib/secrets/reencrypt';
import {
  writeIntegrationSecretColumns,
  clearIntegrationSecretColumns,
  BOARD_SAVE_NOTE,
} from '@/lib/integrations/write';

// Secrets & Rotation board — server actions.
//
// SAME admin gate as the Integration console actions (requireAdmin below is
// the team-member-aware check, NOT the SQL is_admin() helper — that one only
// looks at account_type='admin' and would lock out team-member admins).
//
// SECURITY CONTRACT for this whole file:
//   • A pasted value goes exactly one way: formData → the Vercel API, or
//     formData → AES-256-GCM → Setnayan's own secrets table. It is never
//     logged, returned, echoed into a redirect param, or rendered back.
//   • Every write is keyed by a registry id resolved through getSecretDef(),
//     and the env var NAME / DB COLUMN comes from the registry row — never from
//     the form. A crafted `secret_id` or field name cannot reach an arbitrary
//     env var or column.
//   • Redirect params carry status flags only (`saved`, `error=…`), never a
//     value or a fragment of one.
//   • DB-stored secrets are written through lib/integrations/write.ts — the SAME
//     helper the Integrations console posts to. One encrypt+upsert
//     implementation, one allowlist posture, one rotation-clock path.

/**
 * Vercel's error strings are codes like `forbidden` / `bad_request`, but the API
 * can also hand back a free-text `message`. Neither has ever contained a
 * submitted value — and this makes sure it stays that way even if that changes:
 * the flag we put in the URL is reduced to a short, boring slug.
 */
function safeErrorCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'unknown';
}

async function requireAdmin(): Promise<{ userId: string; email: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id, email: user.email ?? null };
}

/**
 * Record that a secret was rotated. Best-effort by design: a bookkeeping row
 * must never be the reason a real rotation fails.
 */
async function stampRotation(
  secretId: string,
  rotatedBy: string | null,
  note?: string | null,
): Promise<void> {
  if (!getSecretDef(secretId)) return; // allowlist — unknown ids write nothing.
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    await admin.from('platform_secret_rotations').upsert(
      {
        secret_id: secretId,
        last_rotated_at: nowIso,
        rotated_by: rotatedBy,
        note: note ?? null,
        updated_at: nowIso,
      },
      { onConflict: 'secret_id' },
    );
  } catch {
    // Table missing (pre-migration) or transient DB error — never fatal.
  }
}

/**
 * Write one or more new values into the Vercel project env for a registry row.
 *
 * Production + Preview only. Development is deliberately untouched — a dev
 * machine's .env.local is the owner's own copy and clobbering it from here
 * would break local work with no signal.
 */
export async function updateVercelSecret(formData: FormData): Promise<void> {
  const { userId, email } = await requireAdmin();

  const rawId = formData.get('secret_id');
  const def = typeof rawId === 'string' ? getSecretDef(rawId) : undefined;
  if (!def) throw new Error('Unknown secret');
  if (def.editable !== 'vercel-api') throw new Error('Secret is not editable here');

  // Collect the values — the env var names come from the REGISTRY, and the form
  // field is namespaced by that same name, so nothing user-supplied selects a key.
  const writes: { envVar: string; value: string }[] = [];
  for (const field of secretFields(def)) {
    const raw = formData.get(`value__${field.envVar}`);
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value) writes.push({ envVar: field.envVar, value });
  }

  if (writes.length === 0) {
    redirect(`/admin/secrets?error=empty#${def.id}`);
  }

  for (const write of writes) {
    const res = await upsertProjectEnv(write.envVar, write.value, [
      'production',
      'preview',
    ]);
    if (!res.ok) {
      // Sanitised error CODE only (e.g. 'forbidden') — never a value.
      redirect(`/admin/secrets?error=vercel&code=${safeErrorCode(res.error)}#${def.id}`);
    }
  }

  await stampRotation(def.id, email ?? userId);

  revalidatePath('/admin/secrets');
  redirect(`/admin/secrets?saved=1&redeploy=1#${def.id}`);
}

/**
 * Paste a DB-stored secret straight into Setnayan's encrypted secrets table.
 *
 * The owner rule this exists for: any key, any secret → /admin/secrets, always.
 * Before this, a `db-paste` row could only deep-link to /admin/integrations,
 * which made the board a dashboard you had to leave to act on.
 *
 * No new write path: the columns come from the registry and the encrypt+upsert
 * is the console's own helper, so this action is routing + copy, nothing more.
 *
 * PARTIAL SAVES ARE CORRECT HERE. Only the boxes the owner filled in are named
 * in the patch, so:
 *   • Resend saves the API KEY only — `resend_from_address` lives on
 *     platform_settings and is never touched by this path.
 *   • Maya's public + secret keys are independent columns; replacing one leaves
 *     the other exactly as it was.
 * A blank box always means "keep what's there" — never "clear it". Clearing is
 * a separate, confirmed action below.
 */
export async function updateDbSecret(formData: FormData): Promise<void> {
  await requireAdmin();

  const rawId = formData.get('secret_id');
  const def = typeof rawId === 'string' ? getSecretDef(rawId) : undefined;
  if (!def) throw new Error('Unknown secret');
  if (def.editable !== 'db-paste') throw new Error('Secret is not editable here');

  // COLUMN NAMES COME FROM THE REGISTRY. The form field is namespaced by the
  // registry's own column name, so nothing user-supplied selects a column.
  const plaintextByColumn: Record<string, string> = {};
  for (const field of dbPasteFields(def)) {
    const raw = formData.get(`value__${field.column}`);
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value) plaintextByColumn[field.column] = value;
  }

  const filled = Object.keys(plaintextByColumn).length;
  if (filled === 0) {
    redirect(`/admin/secrets?error=empty#${def.id}`);
  }

  // Shared write layer: encrypt → update the singleton → stamp the rotation
  // clock. Returns a short status code, never a driver message (a Postgres
  // error can quote the offending value back, and this path handles secrets).
  const res = await writeIntegrationSecretColumns(plaintextByColumn, BOARD_SAVE_NOTE);
  if (!res.ok) {
    redirect(`/admin/secrets?error=db&code=${safeErrorCode(res.code)}#${def.id}`);
  }

  revalidatePath('/admin/secrets');
  revalidatePath('/admin/integrations');
  // `keys` is a COUNT of boxes written — how the page says "1 key saved, the
  // one you left blank is untouched". Never a value or a column name.
  redirect(`/admin/secrets?saved=1&store=db&keys=${filled}#${def.id}`);
}

/**
 * Remove the stored value(s) for a db-paste row without leaving the board.
 *
 * Deliberately NOT a rotation: an emptied slot is a missing secret, and stamping
 * the clock would silence the very alarm that should now be loudest. The feature
 * falls back to its env var if one is set, otherwise it goes dark — which is the
 * honest outcome and why the UI confirms first.
 */
export async function clearDbSecret(formData: FormData): Promise<void> {
  await requireAdmin();

  const rawId = formData.get('secret_id');
  const def = typeof rawId === 'string' ? getSecretDef(rawId) : undefined;
  if (!def) throw new Error('Unknown secret');
  if (def.editable !== 'db-paste') throw new Error('Secret is not editable here');

  const columns = consoleColumnsForSecret(def.id);
  if (columns.length === 0) {
    redirect(`/admin/secrets?error=empty#${def.id}`);
  }

  const res = await clearIntegrationSecretColumns(columns);
  if (!res.ok) {
    redirect(`/admin/secrets?error=db&code=${safeErrorCode(res.code)}#${def.id}`);
  }

  revalidatePath('/admin/secrets');
  revalidatePath('/admin/integrations');
  redirect(`/admin/secrets?cleared=1#${def.id}`);
}

/**
 * "I rotated this elsewhere" — resets the age clock for any registry row.
 * The only write path for github / instructions-only secrets.
 */
export async function markRotated(formData: FormData): Promise<void> {
  const { userId, email } = await requireAdmin();

  const rawId = formData.get('secret_id');
  const def = typeof rawId === 'string' ? getSecretDef(rawId) : undefined;
  if (!def) throw new Error('Unknown secret');

  const rawNote = formData.get('note');
  // Bounded, plain text. The card warns not to paste secret material here.
  const note =
    typeof rawNote === 'string' && rawNote.trim() ? rawNote.trim().slice(0, 500) : null;

  await stampRotation(def.id, email ?? userId, note);

  revalidatePath('/admin/secrets');
  redirect(`/admin/secrets?marked=1#${def.id}`);
}

/** Kick a production deployment so freshly-written env vars take effect. */
export async function redeployProduction(): Promise<void> {
  await requireAdmin();
  const res = await triggerProdRedeploy();
  revalidatePath('/admin/secrets');
  if (!res.ok) {
    redirect(`/admin/secrets?error=redeploy&code=${safeErrorCode(res.error)}`);
  }
  redirect('/admin/secrets?deploying=1');
}

/**
 * Step 4 of the ENCRYPTION_KEY runbook. Calls the sweep library directly (no
 * HTTP hop) and returns counts to the client component that rendered the button.
 */
export async function runReencryptSweep(): Promise<ReencryptCounts> {
  await requireAdmin();
  return reencryptStoredSecrets();
}
