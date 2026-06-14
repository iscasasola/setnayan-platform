'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * Portion-rule CRUD — Vendor Portal data-link program ② (corpus
 * 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 2.3). Rules are
 * per vendor ORG (reused across every booked event); RLS scopes all writes
 * to the caller's own org via current_vendor_profile_ids().
 */

const MEAL_PREFS = ['beef', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids', 'no_preference'];
const BLOCKS = ['ceremony', 'reception', 'cocktails', 'after_party', 'rehearsal_dinner'];
const BASES = ['confirmed', 'expected', 'ceiling'];

export async function addPortionRule(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '');
  const back = `/vendor-dashboard/clients/${eventId}/production-sheet`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const label = String(formData.get('label') ?? '').trim().slice(0, 120);
  const unit = String(formData.get('unit') ?? '').trim().slice(0, 30);
  const qty = Number(formData.get('qty_per_guest'));
  const waste = Number(formData.get('waste_factor_pct') || 0);
  const basisRaw = String(formData.get('headcount_basis') ?? 'confirmed');
  const blockRaw = String(formData.get('applies_to_block') ?? '');
  const meals = MEAL_PREFS.filter((m) => formData.get(`meal_${m}`) === 'on');

  if (!label || !unit || !Number.isFinite(qty) || qty <= 0) {
    redirect(`${back}?rule=invalid`);
  }

  const { error } = await supabase.from('vendor_portion_rules').insert({
    vendor_profile_id: profile.vendor_profile_id,
    label,
    unit,
    qty_per_guest: qty,
    applies_to_meals: meals.length > 0 ? meals : null,
    applies_to_block: BLOCKS.includes(blockRaw) ? blockRaw : null,
    headcount_basis: BASES.includes(basisRaw) ? basisRaw : 'confirmed',
    waste_factor_pct: Number.isFinite(waste) ? Math.min(Math.max(waste, 0), 100) : 0,
  });

  revalidatePath(back);
  redirect(`${back}?rule=${error ? 'error' : 'added'}`);
}

export async function deletePortionRule(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '');
  const ruleId = String(formData.get('rule_id') ?? '');
  const back = `/vendor-dashboard/clients/${eventId}/production-sheet`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS limits the delete to the caller's own org rows.
  await supabase.from('vendor_portion_rules').delete().eq('rule_id', ruleId);

  revalidatePath(back);
  redirect(back);
}
