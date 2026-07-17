'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/email-template';
import {
  isFenceEligible,
  isClaimEligible,
  isDependentSex,
  isDependentRelationship,
  isDependentKind,
  isReligion,
} from '@/lib/dependent-people';

/**
 * Add a dependent — a person, a pet, or anything you care for (COUNSEL-GATED ·
 * flag-off). Only the PERSON case carries sensitive PI + the age fence:
 *  - kind = 'person': birthdate optional; when given it is fence-checked (18–50
 *    refused — invite, never register) since a DB CHECK can't reference now();
 *    sex/religion + guardian-consent stamps apply.
 *  - kind = 'pet' | 'other': no fence, any/no birthday, no sex/religion — a pet
 *    has none. Sensitive human fields are dropped even if posted.
 * Writes under the user's own session → RLS (dependents_owner_all) scopes it to
 * this owner.
 */
export async function addDependent(formData: FormData): Promise<void> {
  // Hard gate: inert until the DPO clears the counsel review + flips the flag.
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const kind = isDependentKind(formData.get('dependent_kind'))
    ? String(formData.get('dependent_kind'))
    : 'person';
  const isPerson = kind === 'person';

  const name = String(formData.get('name') ?? '').trim().slice(0, 128);
  const birthRaw = String(formData.get('birth_date') ?? '').trim();
  const hasBirth = /^\d{4}-\d{2}-\d{2}$/.test(birthRaw);
  const birth = hasBirth ? birthRaw : null;
  const relationship = isDependentRelationship(formData.get('relationship'))
    ? String(formData.get('relationship'))
    : null;
  // Sensitive human-only fields — kept for a person, dropped for a pet/other.
  const sex = isPerson && isDependentSex(formData.get('sex')) ? String(formData.get('sex')) : null;
  const religion = isPerson && isReligion(formData.get('religion')) ? String(formData.get('religion')) : null;

  if (!name) redirect('/dashboard/people?error=name');

  // AGE FENCE (owner rule) — the authoritative gate, PERSON records only. A
  // person's stored birthdate must be <18 (a child a guardian plans for) or >50
  // (an elder). 18–50 → they own their own dates; invite, never register. Pets /
  // other have no fence and may have any birthday, or none.
  if (isPerson && birth && !isFenceEligible(birth, manilaToday())) {
    redirect('/dashboard/people?error=fence');
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('dependents').insert({
    owner_user_id: user.id,
    dependent_kind: kind,
    name,
    birth_date: birth,
    sex,
    religion,
    relationship,
    // Household consent asymmetry (B6): a JOINT child is shared with the spouse by
    // default; every other relation stays private until the guardian opts in.
    shared_with_spouse: isPerson && relationship === 'child',
    // Guardian-consented on the dependent's behalf (RA 10173 durable proof) —
    // stamped only when the corresponding sensitive field is actually stored.
    birth_date_consent_at: isPerson && birth ? now : null,
    religion_consent_at: religion ? now : null,
  });
  if (error) redirect(`/dashboard/people?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?saved=1');
}

/** Remove a dependent record (RA 10173 erasure). Owner-scoped via RLS. */
export async function deleteDependent(formData: FormData): Promise<void> {
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');
  const dependentId = String(formData.get('dependent_id') ?? '').trim();
  if (!dependentId) redirect('/dashboard/people');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS restricts the delete to the owner's own rows; the eq is defense-in-depth.
  await supabase.from('dependents').delete().eq('dependent_id', dependentId).eq('owner_user_id', user.id);
  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?removed=1');
}

/**
 * Toggle whether a dependent is shared with the guardian's spouse (household
 * consent asymmetry, B6). Owner-only: the `.eq('owner_user_id')` + RLS ensure a
 * spouse (who can READ shared rows) can never flip another person's sharing.
 */
export async function setDependentSharing(formData: FormData): Promise<void> {
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');
  const dependentId = String(formData.get('dependent_id') ?? '').trim();
  const share = String(formData.get('share') ?? '') === '1';
  if (!dependentId) redirect('/dashboard/people');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('dependents')
    .update({ shared_with_spouse: share })
    .eq('dependent_id', dependentId)
    .eq('owner_user_id', user.id);
  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?saved=1');
}

// ── Godparents (ninong / ninang) ─────────────────────────────────────────────

/**
 * Add a godparent to a dependent. Verifies the dependent is the caller's own
 * (belt-and-suspenders beyond RLS, since a crafted dependent_id could otherwise
 * reference another guardian's child). Flag-gated.
 */
export async function addGodparent(formData: FormData): Promise<void> {
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const dependentId = String(formData.get('dependent_id') ?? '').trim();
  const name = String(formData.get('godparent_name') ?? '').trim().slice(0, 128);
  const email = String(formData.get('godparent_email') ?? '').trim().slice(0, 254) || null;
  const roleRaw = String(formData.get('role') ?? '').trim();
  const role = roleRaw === 'ninong' || roleRaw === 'ninang' ? roleRaw : null;

  if (!dependentId || !name) redirect('/dashboard/people?error=name');

  const { data: dep } = await supabase
    .from('dependents')
    .select('dependent_id')
    .eq('dependent_id', dependentId)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (!dep) redirect('/dashboard/people');

  const { error } = await supabase.from('godparents').insert({
    dependent_id: dependentId,
    owner_user_id: user.id,
    godparent_name: name,
    godparent_email: email,
    role,
  });
  if (error) redirect(`/dashboard/people?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?saved=1');
}

/** Remove a godparent edge. Owner-scoped via RLS. */
export async function deleteGodparent(formData: FormData): Promise<void> {
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');
  const godparentId = String(formData.get('godparent_id') ?? '').trim();
  if (!godparentId) redirect('/dashboard/people');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.from('godparents').delete().eq('godparent_id', godparentId).eq('owner_user_id', user.id);
  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?removed=1');
}

/**
 * Mint (or refresh) the single-use hand-over link for an alaga (owner-locked
 * 2026-07-16 ownership rule). Purpose derives from the record, never the form:
 *  - kind = 'person'  → 'claim': the person takes ownership of their own
 *    profile. Gate: stored birth_date proves age ≥ 18 (isClaimEligible) — the
 *    RA 6809 majority lock. No birthday on file → no link.
 *  - kind = 'pet'|'other' → 'rehome': care transfers to another guardian.
 * One active link per alaga (re-minting replaces it), 7-day expiry. Writes
 * under the owner's session → RLS dependents_owner_update blocks non-owners
 * AND already-handed-over rows.
 */
export async function createHandoverLink(formData: FormData): Promise<void> {
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');
  const dependentId = String(formData.get('dependent_id') ?? '').trim();
  if (!dependentId) redirect('/dashboard/people');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('dependents')
    .select('dependent_kind, birth_date, handed_over_at')
    .eq('dependent_id', dependentId)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (!row || row.handed_over_at) redirect('/dashboard/people');

  const isPerson = (row.dependent_kind ?? 'person') === 'person';
  if (isPerson && !isClaimEligible(row.birth_date, manilaToday())) {
    // Not 18 yet (or no birthday on file) — the majority lock, server-side.
    redirect('/dashboard/people?error=not_of_age');
  }

  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('dependents')
    .update({
      claim_token: token,
      claim_token_purpose: isPerson ? 'claim' : 'rehome',
      claim_token_expires_at: expires,
    })
    .eq('dependent_id', dependentId)
    .eq('owner_user_id', user.id);
  if (error) redirect(`/dashboard/people?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?saved=1');
}

/** Revoke an alaga's active hand-over link. Owner-scoped via RLS. */
export async function revokeHandoverLink(formData: FormData): Promise<void> {
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');
  const dependentId = String(formData.get('dependent_id') ?? '').trim();
  if (!dependentId) redirect('/dashboard/people');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('dependents')
    .update({ claim_token: null, claim_token_purpose: null, claim_token_expires_at: null })
    .eq('dependent_id', dependentId)
    .eq('owner_user_id', user.id);
  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?saved=1');
}

/**
 * Email an alaga's ACTIVE hand-over/transfer link to a recipient the guardian
 * names (owner request 2026-07-17 — copy-paste works, email is kinder). Guards:
 * flag + owner via RLS-scoped read; requires a live token (mint first — this
 * never mints). The recipient address is used once for the send and stored
 * nowhere.
 */
export async function emailHandoverLink(formData: FormData): Promise<void> {
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');
  const dependentId = String(formData.get('dependent_id') ?? '').trim();
  const recipient = String(formData.get('recipient') ?? '').trim().toLowerCase();
  if (!dependentId) redirect('/dashboard/people');
  if (!recipient || !recipient.includes('@')) redirect('/dashboard/people?error=email');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('dependents')
    .select('name, dependent_kind, claim_token, claim_token_purpose, claim_token_expires_at, handed_over_at')
    .eq('dependent_id', dependentId)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  const live =
    !!row &&
    !row.handed_over_at &&
    !!row.claim_token &&
    !!row.claim_token_expires_at &&
    new Date(row.claim_token_expires_at) > new Date();
  if (!live) redirect('/dashboard/people?error=no_active_link');

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const claimUrl = `${proto}://${host}/claim/${row.claim_token}`;
  const isClaim = row.claim_token_purpose === 'claim';

  const html = renderBrandedEmail({
    heading: isClaim ? `Claim your profile, ${row.name}` : `Take over ${row.name}'s care`,
    paragraphs: isClaim
      ? [
          `A guardian has kept your profile — your dates and milestones — inside their Setnayan account while you grew up.`,
          `You're of age now: claiming it makes it yours. They'll keep the memories, read-only.`,
        ]
      : [
          `A guardian on Setnayan wants to hand ${row.name}'s profile over to you.`,
          `Accepting moves it into your account — their dates and celebrations become yours to keep.`,
        ],
    ctaLabel: isClaim ? 'Claim my profile' : `Take over ${row.name}'s care`,
    ctaHref: claimUrl,
    footnote: 'This link works once and expires in 7 days. If you weren’t expecting it, you can ignore this email.',
  });
  const sent = await sendEmail({
    to: recipient,
    subject: isClaim ? `${row.name}, your Setnayan profile is ready to claim` : `Take over ${row.name}'s care on Setnayan`,
    text: isClaim
      ? `A guardian has kept your profile inside their Setnayan account while you grew up. You're of age now — claiming it makes it yours.\n\nClaim it here (works once, expires in 7 days): ${claimUrl}`
      : `A guardian on Setnayan wants to hand ${row.name}'s profile over to you. Accepting moves it into your account.\n\nAccept here (works once, expires in 7 days): ${claimUrl}`,
    html,
  });
  // Surface a real outcome — a missing Resend key or a provider error must not
  // read as "sent" (the guardian would wait on an email that never left).
  if (!sent.ok) {
    redirect(
      `/dashboard/people?error=${sent.reason === 'not_configured' ? 'email_not_configured' : 'email_send_failed'}`,
    );
  }

  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?saved=1');
}
