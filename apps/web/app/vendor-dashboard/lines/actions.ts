'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * MY LINES — editing the library itself.
 *
 * Owner-locked 2026-08-01, spec item 5. Sibling of
 * `/vendor-dashboard/activities/actions.ts`: plain form posts, no client state
 * machine, every write scoped by `vendor_lines`' own RLS under the caller's
 * client. No admin client anywhere on this path.
 *
 * ── THE RULE THAT SHAPES ALL THREE ACTIONS ─────────────────────────────────
 *
 * The library is UPSTREAM of every wedding, never retroactive. Editing a line
 * here must not touch a single `vendor_block_scripts` row — those are what he
 * already said yes to for a specific couple, and silently rewriting a script he
 * has already rehearsed would be the worst thing this screen could do.
 *
 * ── DELETE IS SOFT, AND THAT IS LOAD-BEARING ───────────────────────────────
 *
 * `deleted_at` rather than a real delete: the partial unique indexes all carry
 * `WHERE deleted_at IS NULL`, so soft-deleting frees the key immediately and he
 * can write a fresh line for the same moment straight away. A hard delete would
 * also be indistinguishable from "never written", losing the fact that he
 * deliberately retired a phrasing.
 */

const BACK = '/vendor-dashboard/lines';

async function ownProfileOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${BACK}`);
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard/verify');
  return { supabase, profile };
}

function back(error?: string): never {
  redirect(error ? `${BACK}?error=${encodeURIComponent(error)}` : `${BACK}?saved=1`);
}

/** Rewrite a line's text. Slots are preserved verbatim — he is editing the
 *  TEMPLATE, which is why the field shows `⟨the couple⟩` rather than a name. */
export async function updateLine(formData: FormData): Promise<void> {
  const lineId = String(formData.get('line_id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!lineId) back('That line no longer exists.');
  if (body.length === 0) back('A line cannot be empty — delete it instead.');
  if (body.length > 2000) back('Keep a line under 2,000 characters.');

  const { supabase, profile } = await ownProfileOrRedirect();
  const { error } = await supabase
    .from('vendor_lines')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('line_id', lineId)
    // Belt as well as braces: RLS already scopes this, but naming the owner
    // means a wrong id can never touch someone else's craft.
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .is('deleted_at', null);

  if (error) back('Could not save that line. Please try again.');
  revalidatePath(BACK);
  back();
}

/** Retire a line. Soft — see the module note. */
export async function deleteLine(formData: FormData): Promise<void> {
  const lineId = String(formData.get('line_id') ?? '').trim();
  if (!lineId) back('That line no longer exists.');

  const { supabase, profile } = await ownProfileOrRedirect();
  const { error } = await supabase
    .from('vendor_lines')
    .update({ deleted_at: new Date().toISOString() })
    .eq('line_id', lineId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .is('deleted_at', null);

  if (error) back('Could not remove that line.');
  revalidatePath(BACK);
  back();
}

/**
 * Promote a line to one of his named segments — the rung-2 → rung-1 upgrade.
 *
 * A line matched only by NAME is a guess ("two weddings can use one word for
 * two things"). Attaching it to a `vendor_activities` row makes the match exact
 * and stable forever, because the same UUID travels to every wedding.
 */
export async function attachLineToActivity(formData: FormData): Promise<void> {
  const lineId = String(formData.get('line_id') ?? '').trim();
  const activityId = String(formData.get('activity_id') ?? '').trim();
  if (!lineId) back('That line no longer exists.');

  const { supabase, profile } = await ownProfileOrRedirect();

  // Detach is always allowed; attach must prove the segment is HIS, or a
  // stray id could bind his line to someone else's segment.
  if (activityId) {
    const { data: owned } = await supabase
      .from('vendor_activities')
      .select('activity_id')
      .eq('activity_id', activityId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    if (!owned) back('That segment is not one of yours.');
  }

  const { error } = await supabase
    .from('vendor_lines')
    .update({
      activity_id: activityId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('line_id', lineId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .is('deleted_at', null);

  // The partial uniques mean one line per (vendor, activity): attaching a
  // second line to a segment that already has one collides rather than
  // silently replacing his earlier words.
  if (error) {
    back('You already have a line on that segment — edit that one instead.');
  }
  revalidatePath(BACK);
  back();
}
