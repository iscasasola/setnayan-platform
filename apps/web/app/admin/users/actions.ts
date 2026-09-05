'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revokeAllSessions } from '@/lib/force-logout';
import { parseStoredAsset } from '@/lib/uploads';
import { r2Delete } from '@/lib/r2';
import { deletePublicAsset } from '@/lib/storage';
import { eraseUserAccount, type ErasureIo } from '@/lib/erasure/purge';
import {
  serializeTempPasswordFlash,
  TEMP_PASSWORD_FLASH_COOKIE,
} from '@/lib/account-erasure';
import { datetimeLocalToIso } from '@/lib/schedule';

// TTL of the temp-password flash cookie (see TEMP_PASSWORD_FLASH_COOKIE) — a
// copy-it-now window, not a store.
const TEMP_PASSWORD_FLASH_TTL_SECONDS = 120;

/**
 * The RA 10173 erasure engine lives in `lib/erasure/purge.ts` — a module with no
 * `next/*` or `server-only` import, so `tests/db/erasure-completeness.db.test.ts`
 * can run the REAL purge against the REAL replayed schema. This file supplies
 * the side effects it deliberately does not import.
 *
 * Why the split matters here and not elsewhere: the purge is a list of column
 * and table names checked against nothing. That list drifted — `owner_email` was
 * never a column of `public.events`, so PostgREST rejected the whole owned-event
 * update and the birth data + photo-delivery credential it was meant to clear
 * were never cleared in production, invisibly, because best-effort logged the
 * failure and carried on. A purge you cannot execute in a test is a purge nobody
 * can check.
 */
function erasureIo(): ErasureIo {
  return {
    // Only `r2://bucket/key` refs from the current upload flow are removed; a
    // legacy/external URL is left (it may not even be ours). r2Delete is
    // idempotent on a missing key.
    deleteStoredAsset: async (ref) => {
      const asset = parseStoredAsset(ref);
      if (asset?.kind === 'r2') await r2Delete({ bucket: asset.bucket, key: asset.key });
    },
    // Chat attachments store a PUBLIC R2 URL rather than an `r2://` ref, so they
    // need the URL-shaped round-trip.
    //
    // ⚠ THROW ON A REPORTED NON-DELETION (2026-07-26). `deletePublicAsset`
    // never throws — by design, for the settings callers that just want a
    // best-effort cleanup. That silently disabled erasure's whole audit path:
    // `purgeUserAuthoredChat` wraps this in try/catch to write a
    // `chat-attachment-r2-delete` failure row, and with a function that cannot
    // fail, the catch was unreachable and every miss went unrecorded. Now the
    // outcome comes back as data and this adapter converts it into the throw
    // the purge is already written to audit — matching `r2Delete` above, which
    // throws and is audited correctly. The adapter is the right place for the
    // conversion: erasure needs the failure, the other five callers do not.
    deletePublicAssetUrl: async (url) => {
      const res = await deletePublicAsset({ publicUrl: url });
      if (!res.ok) throw new Error(`${res.reason}: ${res.message}`);
    },
    revokeAllSessions,
  };
}

async function requireAdmin() {
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
  return { adminUserId: user.id };
}

export async function toggleTeamMember(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  const desiredRaw = formData.get('desired');
  if (typeof targetUserId !== 'string' || typeof desiredRaw !== 'string') {
    throw new Error('Invalid input');
  }
  const desired = desiredRaw === 'true';

  const admin = createAdminClient();

  // Capture the prior value so the audit row has clean before/after metadata.
  // Best-effort lookup — if the read fails we still proceed with the toggle.
  const { data: prior } = await admin
    .from('users')
    .select('is_team_member, email')
    .eq('user_id', targetUserId)
    .maybeSingle();

  const { error } = await admin
    .from('users')
    .update({ is_team_member: desired, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId);
  if (error) throw new Error(error.message);

  // Per CLAUDE.md 2026-05-12 § 9.1 admin discipline + System_Wiring_Map_2026-05-28
  // RED #3. Every admin mutation logs to admin_audit_log so the owner can
  // reconstruct who-did-what during pilot. Best-effort: audit failure logs to
  // console but does NOT roll back the toggle (matches the canonical pattern
  // at line 408 / 502 of this file).
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'user_team_member_toggle',
    target_id: targetUserId,
    actor_user_id: adminUserId,
    metadata: {
      target_email: prior?.email ?? null,
      before: prior?.is_team_member ?? null,
      after: desired,
    },
  });
  if (auditErr) {
    console.error('[toggleTeamMember] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/users');
}

/**
 * Force sign-out — revoke ALL of a user's auth sessions on every device
 * (compromised-account remedy; see lib/force-logout.ts for the mechanism).
 * Protective, not destructive: no two-admin gate, but audit-logged like every
 * Setnayan HQ mutation. Guard: you cannot force sign-out yourself (use the
 * profile page's own "Sign out other devices" instead — this action would
 * kill the session you're acting from).
 */
export async function forceSignOutUser(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string' || targetUserId.length === 0) {
    throw new Error('Invalid input');
  }
  if (targetUserId === adminUserId) {
    redirect('/admin/users?error=Use+your+profile%27s+%22Sign+out+other+devices%22+for+your+own+account');
  }

  const admin = createAdminClient();
  const { data: prior } = await admin
    .from('users')
    .select('email')
    .eq('user_id', targetUserId)
    .maybeSingle();

  const result = await revokeAllSessions(targetUserId);
  if (!result.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(result.error)}`);
  }

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'user_force_sign_out',
    target_id: targetUserId,
    actor_user_id: adminUserId,
    metadata: {
      target_email: prior?.email ?? null,
      sessions_revoked: result.ok ? result.sessionsRevoked : null,
    },
  });
  if (auditErr) {
    console.error('[forceSignOutUser] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?signed_out=1');
}

/**
 * Erase a user (RA 10173 right-to-erasure). Soft-deletes + anonymizes via
 * `eraseUserAccount` — no auth.users DELETE is issued (that used to throw on any
 * account with activity; see the helper's docstring). The original email is
 * freed for re-signup (the tombstone releases it); to also BLOCK re-use, call
 * `blacklistUser` instead.
 *
 * ⚠ THE FOREIGN-KEY REASON FOR NOT DELETING IS GONE AS OF 2026-08-02, AND THIS
 * FUNCTION STILL DOES NOT DELETE — on purpose. Two sweeps gave all 48 refusing
 * FKs a written verdict, and exactly three still refuse (order_refunds,
 * supplies_orders, vendor_contract_signatures — see
 * tests/db/user-delete-refusing-fks.baseline.txt). So a hard delete would now
 * succeed for most accounts. It is still the wrong operation: erasure's
 * obligation is to destroy the PERSONAL data, not the business records, and
 * anonymize-and-retain does exactly that while a DELETE would take the
 * transactional history with it. Do not "fix" this to call auth.admin.deleteUser
 * on the strength of the FKs now being clear — that is a different decision, and
 * a DPO one. The only real DELETE in the app is the abandoned-anon-draft sweep
 * (lib/anon-draft-sweep.ts), where the subject has no business records at all.
 *
 * Safety guards:
 * - Cannot delete yourself
 * - Cannot delete is_internal accounts (owner / § 10a)
 */
export async function deleteUser(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') throw new Error('Invalid input');
  if (targetUserId === adminUserId) {
    throw new Error('You cannot delete your own account from this page');
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('is_internal')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (target?.is_internal) {
    throw new Error('Cannot delete an internal account');
  }

  const { publicSlug } = await eraseUserAccount(admin, targetUserId, adminUserId, erasureIo());

  revalidatePath('/admin/users');
  // The anonymize nulls users.slug, but /u/[slug] is a cached public page — it
  // would keep serving the erased profile until its own revalidation window
  // expired. (The EVENT site at /[slug] is shared with the co-partner and is
  // deliberately not invalidated here; see the DPO note in the PR.)
  if (publicSlug) revalidatePath(`/u/${publicSlug}`);
}

/**
 * Erase a user (RA 10173) AND add their email to the permanent blacklist so the
 * signup server action rejects it. Same soft-delete + anonymize as `deleteUser`
 * (via `eraseUserAccount`), but the blacklist row captured here keeps the
 * original address blocked even though the tombstone frees it in auth. Reverse
 * with `unblacklistEmail`.
 *
 * Safety guards:
 * - Cannot blacklist yourself
 * - Cannot blacklist is_internal accounts
 */
export async function blacklistUser(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  const reasonRaw = formData.get('reason');
  if (typeof targetUserId !== 'string') throw new Error('Invalid input');
  if (targetUserId === adminUserId) {
    throw new Error('You cannot blacklist your own account from this page');
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('is_internal, email')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!target) throw new Error('User not found');
  if (target.is_internal) {
    throw new Error('Cannot blacklist an internal account');
  }
  if (!target.email) {
    throw new Error('User has no email to blacklist');
  }

  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim()
      : null;

  // Insert blacklist row FIRST — capturing the ORIGINAL email BEFORE erasure
  // tombstones it — so a failure here doesn't leave the user erased but not
  // blacklisted. Duplicate-key just means the email is already blacklisted —
  // proceed to erase anyway.
  const { error: bError } = await admin.from('blacklisted_emails').insert({
    email: target.email.toLowerCase(),
    reason,
    blacklisted_by_user_id: adminUserId,
  });
  if (bError && !bError.message.toLowerCase().includes('duplicate')) {
    throw new Error(bError.message);
  }

  const { publicSlug } = await eraseUserAccount(admin, targetUserId, adminUserId, erasureIo());

  revalidatePath('/admin/users');
  if (publicSlug) revalidatePath(`/u/${publicSlug}`);
}

/**
 * Remove an email from the blacklist so it can be used to sign up again.
 * The associated account was erased (soft-deleted + anonymized) at blacklist
 * time and its auth email tombstoned, so the original address is free — this
 * only clears the blacklist gate at the signup action.
 */
export async function unblacklistEmail(formData: FormData) {
  await requireAdmin();
  const blacklistId = formData.get('blacklist_id');
  if (typeof blacklistId !== 'string') throw new Error('Invalid input');

  const admin = createAdminClient();
  const { error } = await admin
    .from('blacklisted_emails')
    .delete()
    .eq('id', blacklistId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
}

/**
 * Generates a 12-char temporary password (no ambiguous chars like 0/O/1/l),
 * sets it on the target account via the admin API, and redirects with the
 * temp password in a short-TTL httpOnly cookie (NOT the URL) so the admin can
 * copy + share it without the secret leaking into request logs or history.
 *
 * Useful when Supabase's outbound email isn't wired (no Resend SMTP yet)
 * and a user can't reset their own password. Internal/team-pool only.
 */
export async function resetUserPassword(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') {
    throw new Error('Invalid input');
  }

  const tempPassword = generateTempPassword();

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('users')
    .select('email')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!existing?.email) {
    throw new Error('User not found');
  }

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    password: tempPassword,
  });
  if (error) throw new Error(error.message);

  // Per CLAUDE.md 2026-05-12 § 9.1 admin discipline + System_Wiring_Map_2026-05-28
  // RED #3. Every admin mutation logs to admin_audit_log so the owner can
  // reconstruct who-did-what during pilot. We intentionally do NOT include the
  // temp password in the audit row — only the fact that a reset happened. The
  // temp password rides a short-TTL httpOnly cookie (set below) to the surface
  // that renders it, NOT a URL, and is never persisted server-side.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'user_password_reset',
    target_id: targetUserId,
    actor_user_id: adminUserId,
    metadata: {
      target_email: existing.email,
    },
  });
  if (auditErr) {
    console.error('[resetUserPassword] audit log insert failed', auditErr.message);
  }

  // Deliver the temp password + email via a short-TTL httpOnly cookie instead of
  // the URL. Putting them in `?temp_password=…&for_email=…` (the old behaviour)
  // wrote plaintext credentials + the account email into Vercel/edge request
  // logs and the admin's browser history. The cookie is httpOnly (page JS can
  // never read it), path-scoped to /admin, and expires in ~2 minutes — a
  // copy-it-now flash the admin surface reads server-side and renders once.
  const jar = await cookies();
  jar.set(
    TEMP_PASSWORD_FLASH_COOKIE,
    serializeTempPasswordFlash({ password: tempPassword, email: existing.email }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/admin',
      maxAge: TEMP_PASSWORD_FLASH_TTL_SECONDS,
    },
  );

  revalidatePath('/admin/users');
  redirect('/admin/users');
}

function generateTempPassword(): string {
  // Drop visually ambiguous chars (0, O, 1, I, l) so the password is easy to
  // dictate over the phone if needed.
  const alphabet =
    'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => alphabet[b % alphabet.length])
    .join('');
}

/**
 * Manually confirm a user's email — useful when Supabase's outbound email
 * doesn't arrive (rate limit, spam folder, misconfigured SMTP, etc.).
 * Internal/team-pool only.
 */
export async function confirmUserEmail(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') {
    throw new Error('Invalid input');
  }

  const admin = createAdminClient();

  // Capture the target email for the audit row before the auth-side mutation.
  const { data: existing } = await admin
    .from('users')
    .select('email')
    .eq('user_id', targetUserId)
    .maybeSingle();

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  // Per CLAUDE.md 2026-05-12 § 9.1 admin discipline + System_Wiring_Map_2026-05-28
  // RED #3. Every admin mutation logs to admin_audit_log so the owner can
  // reconstruct who-did-what during pilot. Manual email confirmation is
  // particularly worth auditing — it bypasses the standard verification loop.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'user_email_confirm',
    target_id: targetUserId,
    actor_user_id: adminUserId,
    metadata: {
      target_email: existing?.email ?? null,
    },
  });
  if (auditErr) {
    console.error('[confirmUserEmail] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/users');
}

/**
 * Issue a comp grant against a target user account.
 *
 * Why this action exists
 * ----------------------
 * Pilot launches ~2026-06-01 with a 5-20 personal/family cohort (per
 * [[project_setnayan_pilot_timeline]]). Today /admin/users has only
 * Reset password / Delete / Blacklist / Unblacklist. If a pilot couple
 * is bound to wrong test data, hits a processing failure, or deserves
 * remediation, there's no way to gift them a service cleanly. This
 * action writes a `comp_grants` row scoped to that user so downstream
 * checkout flows (per 0034 § 6 + § 3.1a) can grant free access against
 * the scope.
 *
 * Schema landed via migrations 20260515020000 + 20260515030000 — full
 * canonical 0023 § 3.5b shape (public_id, user_id, source, scope,
 * scoped_skus, expiry, retail_value_centavos, rationale, granted_by,
 * approved_by, two_admin_approval_id, revoked_at). No new migration here.
 *
 * Inputs
 * ------
 *   - user_id (target)
 *   - scope: 'all_services' | 'specific_skus'
 *   - scoped_skus (TEXT[]) — required + non-empty when scope='specific_skus'
 *   - expiry_at (optional ISO timestamp — null = lifetime)
 *   - retail_value_php (int pesos · converted to centavos)
 *   - rationale (TEXT min 20 chars)
 *
 * Safety guards
 * -------------
 *   - Admin role required (is_internal OR is_team_member OR account_type='admin').
 *   - Self-grant blocked at action level — admins use the § 10a
 *     internal-account pattern (`is_internal = TRUE`) for owner-side
 *     unlimited access, not per-user comp grants.
 *   - Granting to existing `is_internal` accounts is blocked — they
 *     already carry a permanent grant; per-SKU comps on top of that
 *     would muddy audit + create dead rows.
 *   - Two-admin gate is NOT enforced in code for V1 (the
 *     `admin_approval_requests` primitive ships V1.x per § 9.1). Grants
 *     with retail_value > ₱10,000 still INSERT but the success message
 *     flags them for owner+spouse co-review.
 *
 * Source = 'external_promo' for every grant issued through this surface.
 * Owner-internal (§ 10a) + team-pool (§ 10b) + dispute-remedy +
 * vendor-self-comp come through separate flows and are not exposed here.
 */
export async function issueCompGrant(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const targetUserId = formData.get('user_id');
  // Optional (2026-09-05, migration 20271205612762): scope the grant to ONE
  // event the target hosts, instead of every event on their account. Blank
  // means "every event", preserving every pre-existing call site's behavior.
  const eventIdRaw = formData.get('event_id');
  const eventId =
    typeof eventIdRaw === 'string' && eventIdRaw.trim().length > 0 ? eventIdRaw.trim() : null;
  const scopeRaw = formData.get('scope');
  // Checkboxes submit one value per checked service under the same name — use
  // getAll. Falls back gracefully if the form still sends a single string
  // (older browser / direct API call): split each value on comma/newline.
  const scopedSkusRaw = formData.getAll('scoped_skus').flatMap((v) =>
    typeof v === 'string' ? v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [],
  );
  const expiryRaw = formData.get('expiry_at');
  const retailValueRaw = formData.get('retail_value_php');
  const rationaleRaw = formData.get('rationale');

  if (typeof targetUserId !== 'string' || targetUserId.length === 0) {
    throw new Error('Pick a user to comp.');
  }
  if (typeof scopeRaw !== 'string') {
    throw new Error('Pick a scope.');
  }
  if (scopeRaw !== 'all_services' && scopeRaw !== 'specific_skus') {
    throw new Error('Scope must be either "all_services" or "specific_skus".');
  }

  // Self-grant block. Owner/spouse use the § 10a internal-account
  // pattern (`is_internal = TRUE` set once by a different admin), not
  // per-user comp grants.
  if (targetUserId === adminUserId) {
    throw new Error(
      'You cannot issue a comp grant to your own account. Owner / spouse internal access uses the § 10a internal-account flag, not comp grants.',
    );
  }

  // Parse + validate scoped_skus when scope='specific_skus'. The form sends one
  // value per checked service (getAll above, already trimmed/split); dedupe to
  // match service_catalog.sku_code style.
  let scopedSkus: string[] | null = null;
  if (scopeRaw === 'specific_skus') {
    const skus = Array.from(new Set(scopedSkusRaw));
    if (skus.length === 0) {
      throw new Error('Select at least one service when scope is specific services.');
    }
    if (skus.length > 50) {
      throw new Error('Pick at most 50 services in a single grant.');
    }
    scopedSkus = skus;
  }

  // Validate rationale (audit-grade · min 20 chars).
  if (typeof rationaleRaw !== 'string' || rationaleRaw.trim().length < 20) {
    throw new Error(
      'Write a rationale of at least 20 characters explaining why this comp is being issued.',
    );
  }
  const rationale = rationaleRaw.trim();

  // Parse retail_value_php (pesos in form → centavos in DB).
  let retailValueCentavos: number | null = null;
  if (typeof retailValueRaw === 'string' && retailValueRaw.trim().length > 0) {
    const pesos = Number.parseInt(retailValueRaw.trim(), 10);
    if (!Number.isFinite(pesos) || pesos < 0) {
      throw new Error('Retail value must be a non-negative whole number of pesos.');
    }
    retailValueCentavos = pesos * 100;
  }

  // Parse expiry (optional), READ AT PH LOCAL.
  //
  // ⚠ The old comment here claimed the value was "treated as PH local" — it was
  // not. `new Date(raw)` on an offset-less `datetime-local` value reads it in
  // the runtime's zone, and a server action runs in UTC. So an admin who gifted
  // a couple a service "until 6 PM today" left it unlocked until 2 AM the next
  // morning, eight hours past the end typed into the audit row.
  let expiry: string | null = null;
  if (typeof expiryRaw === 'string' && expiryRaw.trim().length > 0) {
    const iso = datetimeLocalToIso(expiryRaw);
    if (iso === null) {
      throw new Error('Expiry is not a valid datetime.');
    }
    if (new Date(iso).getTime() < Date.now()) {
      throw new Error('Expiry cannot be in the past.');
    }
    expiry = iso;
  }

  const admin = createAdminClient();

  // Verify target exists + isn't internal. § 10a internal accounts already
  // carry permanent grants; layering per-SKU comps on top creates dead
  // rows + muddies the audit trail.
  const { data: target, error: targetErr } = await admin
    .from('users')
    .select('user_id, is_internal, email, display_name')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (targetErr) throw new Error(`Target lookup failed: ${targetErr.message}`);
  if (!target) {
    throw new Error('Target user not found.');
  }
  if (target.is_internal) {
    throw new Error(
      'Internal accounts (§ 10a) already carry a permanent grant. Per-SKU comps on top of internal status are not allowed.',
    );
  }

  // event_id is never trusted bare — the entitlement functions also re-check
  // host membership at read time, but a grant scoped to an event this target
  // doesn't even host is a silently-dead row, and an admin who typed the
  // wrong event_id deserves an error, not a comp that quietly does nothing.
  let eventDisplayName: string | null = null;
  if (eventId) {
    const { data: hostRow, error: hostErr } = await admin
      .from('event_members')
      .select('event_id, events(display_name)')
      .eq('event_id', eventId)
      .eq('user_id', targetUserId)
      .eq('member_type', 'couple')
      .maybeSingle();
    if (hostErr) throw new Error(`Event host check failed: ${hostErr.message}`);
    if (!hostRow) {
      throw new Error('That event is not hosted by this user — pick one of their own events.');
    }
    eventDisplayName =
      (hostRow as unknown as { events: { display_name: string } | null }).events
        ?.display_name ?? null;
  }

  // Insert the grant. `public_id` defaults to generate_public_id('C')
  // per the schema. `approved_by` stays NULL for V1 — the two-admin
  // gate ships V1.x. retail_value > ₱10K rows still INSERT but get
  // surfaced in the success message for owner+spouse co-review.
  const insertedAt = new Date().toISOString();
  const { data: inserted, error: insertErr } = await admin
    .from('comp_grants')
    .insert({
      user_id: targetUserId,
      event_id: eventId,
      source: 'external_promo',
      scope: scopeRaw,
      scoped_skus: scopedSkus,
      expiry,
      retail_value_centavos: retailValueCentavos,
      rationale,
      granted_by: adminUserId,
      approved_by: null,
      created_at: insertedAt,
    })
    .select('grant_id, public_id, retail_value_centavos')
    .single();
  if (insertErr) throw new Error(`Comp grant insert failed: ${insertErr.message}`);

  // Audit log — mandatory per [[feedback_setnayan_document_changes_with_why]].
  // The metadata blob carries the scope shape so a future read of the
  // audit row alone tells the full story without joining comp_grants.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'issue_comp_grant',
    target_id: inserted.grant_id,
    actor_user_id: adminUserId,
    metadata: {
      grant_public_id: inserted.public_id,
      target_user_id: targetUserId,
      target_email: target.email ?? null,
      event_id: eventId,
      event_display_name: eventDisplayName,
      scope: scopeRaw,
      scoped_skus_count: scopedSkus?.length ?? 0,
      retail_value_centavos: retailValueCentavos,
      expiry,
      rationale_preview: rationale.slice(0, 120),
      requires_two_admin_review:
        (retailValueCentavos ?? 0) > 10_000 * 100,
    },
  });
  // Don't throw on audit failure — the grant itself succeeded and rolling
  // it back would be worse than missing an audit row. Log via console for
  // Sentry capture (matches the pattern in vendor verify/actions.ts).
  if (auditErr) {
    console.error('[issueCompGrant] audit log insert failed', auditErr.message);
  }

  // Re-render the page + expand the target user's panel so the new grant
  // shows up immediately.
  revalidatePath('/admin/users');

  // Surface large-grant warning in the success banner via the existing
  // transient-query-param pattern from resetUserPassword.
  const needsReview = (retailValueCentavos ?? 0) > 10_000 * 100;
  const scopeNote = scopeRaw === 'all_services' ? 'every Setnayan service' : `${scopedSkus?.length ?? 0} scoped services`;
  const eventNote = eventDisplayName ? ` on "${eventDisplayName}" only` : ' across every event they host';
  const banner = needsReview
    ? `Comp grant ${inserted.public_id} issued — flag for owner+spouse co-approval (exceeds ₱10,000 · two-admin primitive lands V1.x)`
    : `Comp grant ${inserted.public_id} issued — ${target.email ?? 'target user'} can now access ${scopeNote}${eventNote}`;
  redirect(
    `/admin/users?expand=${encodeURIComponent(targetUserId)}&grant_banner=${encodeURIComponent(banner)}`,
  );
}

/**
 * Revoke a comp grant. Idempotent — re-revoking a revoked grant is a
 * no-op on the row but still writes a separate audit-log entry for
 * traceability. The grant stays in the DB (soft-delete via revoked_at)
 * so the audit trail + downstream `orders.comp_grant_id` FKs survive.
 *
 * Safety guards
 * -------------
 *   - Admin role required.
 *   - Self-revoke check is moot — revoking your own past-issued grant
 *     against another user is allowed (audit captures who acted).
 *   - Revoking a grant on an active `orders.comp_grant_id` row does NOT
 *     refund or roll back the order — that's a separate refund flow per
 *     0034. Revocation only stops FUTURE uses of the grant.
 */
export async function revokeCompGrant(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const grantId = formData.get('grant_id');
  const reasonRaw = formData.get('reason');
  if (typeof grantId !== 'string' || grantId.length === 0) {
    throw new Error('Pick a grant to revoke.');
  }
  if (typeof reasonRaw !== 'string' || reasonRaw.trim().length < 10) {
    throw new Error(
      'Write a short reason (at least 10 characters) for the revoke.',
    );
  }
  const reason = reasonRaw.trim();

  const admin = createAdminClient();

  // Read the grant first to capture its current state for the audit row.
  // Use maybeSingle so a missing grant returns a polite error, not throw.
  const { data: existing, error: readErr } = await admin
    .from('comp_grants')
    .select('grant_id, public_id, user_id, revoked_at, scope')
    .eq('grant_id', grantId)
    .maybeSingle();
  if (readErr) throw new Error(`Grant lookup failed: ${readErr.message}`);
  if (!existing) {
    throw new Error('Grant not found.');
  }

  const now = new Date().toISOString();
  const wasAlreadyRevoked = existing.revoked_at !== null;

  if (!wasAlreadyRevoked) {
    const { error: updateErr } = await admin
      .from('comp_grants')
      .update({ revoked_at: now })
      .eq('grant_id', grantId);
    if (updateErr) throw new Error(`Revoke update failed: ${updateErr.message}`);
  }

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: wasAlreadyRevoked
      ? 'revoke_comp_grant_idempotent'
      : 'revoke_comp_grant',
    target_id: grantId,
    actor_user_id: adminUserId,
    metadata: {
      grant_public_id: existing.public_id,
      target_user_id: existing.user_id,
      reason,
      was_already_revoked: wasAlreadyRevoked,
    },
  });
  if (auditErr) {
    console.error('[revokeCompGrant] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/users');
}
