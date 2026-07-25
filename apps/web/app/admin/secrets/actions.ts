'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSecretDef, secretFields } from '@/lib/secrets/rotation-registry';
import { upsertProjectEnv, triggerProdRedeploy } from '@/lib/vercel-env';
import { reencryptStoredSecrets, type ReencryptCounts } from '@/lib/secrets/reencrypt';

// Secrets & Rotation board — server actions.
//
// SAME admin gate as the Integration console actions (requireAdmin below is
// the team-member-aware check, NOT the SQL is_admin() helper — that one only
// looks at account_type='admin' and would lock out team-member admins).
//
// SECURITY CONTRACT for this whole file:
//   • A pasted value goes exactly one way: formData → Vercel API. It is never
//     logged, returned, echoed into a redirect param, or written to our DB.
//   • Every write is keyed by a registry id resolved through getSecretDef(),
//     and the env var NAME comes from the registry row — never from the form.
//     A crafted `secret_id` or field name cannot reach an arbitrary env var.
//   • Redirect params carry status flags only (`saved`, `error=…`), never a
//     value or a fragment of one.

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
 * "I rotated this elsewhere" — resets the age clock for any registry row.
 * The only write path for github / instructions-only / db-paste secrets.
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
