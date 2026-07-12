'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import {
  isFenceEligible,
  isDependentSex,
  isDependentRelationship,
  isReligion,
} from '@/lib/dependent-people';

/**
 * Add a guardian-held dependent (COUNSEL-GATED · flag-off). Enforces the age
 * fence AUTHORITATIVELY here (18–50 refused — invite, never register) since a DB
 * CHECK can't reference now(). Birthdate is required (a dependent is defined by
 * the milestones its birthdate derives). Consent is stamped per sensitive field.
 * Writes under the user's own session → RLS (dependents_owner_all) scopes it to
 * this guardian.
 */
export async function addDependent(formData: FormData): Promise<void> {
  // Hard gate: inert until the DPO clears the counsel review + flips the flag.
  if (!dependentPeopleEnabled()) redirect('/dashboard/people');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const name = String(formData.get('name') ?? '').trim().slice(0, 128);
  const birth = String(formData.get('birth_date') ?? '').trim();
  const relationship = isDependentRelationship(formData.get('relationship'))
    ? String(formData.get('relationship'))
    : null;
  const sex = isDependentSex(formData.get('sex')) ? String(formData.get('sex')) : null;
  const religion = isReligion(formData.get('religion')) ? String(formData.get('religion')) : null;

  if (!name) redirect('/dashboard/people?error=name');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) redirect('/dashboard/people?error=birthdate');

  // AGE FENCE (owner rule) — the authoritative gate. 18–50 → they own their own
  // dates; guardians invite, never register.
  if (!isFenceEligible(birth, manilaToday())) {
    redirect('/dashboard/people?error=fence');
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('dependents').insert({
    owner_user_id: user.id,
    name,
    birth_date: birth,
    sex,
    religion,
    relationship,
    // Household consent asymmetry (B6): a JOINT child is shared with the spouse by
    // default; every other relation stays private until the guardian opts in.
    shared_with_spouse: relationship === 'child',
    // Guardian-consented on the dependent's behalf (RA 10173 durable proof).
    birth_date_consent_at: now,
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
