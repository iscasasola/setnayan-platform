'use server';

import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { labelKey, toTemplate } from '@/lib/emcee-lines';

/**
 * SAVING A LINE — writes the event copy, and (silently, correctly) his library.
 *
 * Owner-locked 2026-08-01. Spec: `Emcee_Script_Layer_LOCKED_BUILD_SPEC_2026-08-01.md`.
 *
 * ── ONE ACTION, TWO WRITES, AND WHY ────────────────────────────────────────
 *
 * `vendor_block_scripts` is what he will say at THIS wedding. `vendor_lines` is
 * the same craft kept for the next forty. Save is AUTOMATIC (spec 3.1): an
 * explicit "save to my lines" button is curation homework skipped 40×/year, and
 * a library that never fills is not a library.
 *
 * ── THE PRIVACY RULE IS MECHANICAL, NOT DILIGENT ───────────────────────────
 *
 * Because the save is automatic, the host cannot be relied on to anonymize. So
 * the library copy is run through `toTemplate` first, which swaps this couple's
 * details back out for slots. A `vendor_lines` row therefore never carries a
 * real person — enforced here and by the table having no `event_id` at all.
 *
 * ── WHAT NEVER REACHES THE LIBRARY ─────────────────────────────────────────
 *
 *   · A PRIVATE moment's note. "Watch for Grace by the sound booth" is this
 *     wedding's coordinator, and reusing it would put a stranger's name in a
 *     host's mouth. Stored with `is_private_note = true` so the resolver
 *     refuses it, rather than silently dropped — he can still find it in My
 *     Lines and reuse it deliberately.
 *   · The couple's own note. It is theirs, not his craft.
 *
 * ── GATES ──────────────────────────────────────────────────────────────────
 *
 * Auth → own vendor profile → the caller is booked on THIS event. The write
 * itself rides the caller's own client, so `vendor_block_scripts`' and
 * `vendor_lines`' RLS is the final word; no admin client on this path.
 */

export type ScriptActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'saved'; message: string; savedToLibrary: boolean };

function err(message: string): ScriptActionState {
  return { status: 'error', message };
}

// The committed-booking set, exactly as the other 14 call sites spell it.
//
// ⚠ This line previously read ['contracted', 'booked', 'confirmed', 'completed'].
// Three of those four are NOT members of the `vendor_status` enum, which is
// (considering, shortlisted, contracted, deposit_paid, delivered, complete).
// Postgres rejects the WHOLE `.in()` predicate on an unknown enum label — 22P02,
// not a filter that quietly matches nothing — so `bookingError` was truthy on
// EVERY call and saveBlockScript() returned "Could not confirm your booking on
// this event" to every emcee, on every event, since the day it shipped. The
// docblock above claims this is "the same check the rest of the Customer Card
// uses"; it never was.
const BOOKED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'];

export async function saveBlockScript(
  _prev: ScriptActionState,
  formData: FormData,
): Promise<ScriptActionState> {
  const eventId = String(formData.get('eventId') ?? '').trim();
  const blockId = String(formData.get('blockId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  // The block's own facts, passed from the server-rendered card so this action
  // does not have to re-derive them. All three are re-validated below against
  // the block row itself — a form field is never trusted for a privacy decision.
  const coupleName = String(formData.get('coupleName') ?? '').trim();

  if (!eventId || !blockId) return err('Missing the moment this line belongs to.');
  if (body.length === 0) return err('Write something first.');
  if (body.length > 2000) return err('That is longer than a cue — keep it under 2,000 characters.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('Please sign in again.');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No vendor profile found for this account.');

  // Booked on THIS event — the same check the rest of the Customer Card uses.
  const { data: booking, error: bookingError } = await supabase
    .from('event_vendors')
    .select('vendor_id, status')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', profile.vendor_profile_id)
    .in('status', BOOKED_STATUSES)
    .maybeSingle();
  if (bookingError) return err('Could not confirm your booking on this event.');
  if (!booking) return err('You are not booked on this event.');

  // Re-read the block from the DB rather than trusting the form: `is_public`
  // decides whether this text may ever be reused, so it must come from the row.
  const { data: block, error: blockError } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, label, block_type, is_public')
    .eq('event_id', eventId)
    .eq('block_id', blockId)
    .maybeSingle();
  if (blockError || !block) return err('That moment is no longer on their timeline.');

  const row = block as { label: string | null; block_type: string | null; is_public: boolean | null };
  // Fails toward private: anything not strictly true is treated as private.
  const isPrivate = row.is_public !== true;

  // ── 1 · the event copy — what he says at THIS wedding ────────────────────
  const { error: upsertError } = await supabase
    .from('vendor_block_scripts')
    .upsert(
      {
        event_id: eventId,
        block_id: blockId,
        vendor_profile_id: profile.vendor_profile_id,
        body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'block_id,vendor_profile_id' },
    );
  if (upsertError) {
    return err('Could not save your line. Please try again.');
  }

  // ── 2 · the library copy — his craft, for the next forty weddings ────────
  // Best-effort by design: the event copy is what the wedding needs, and a
  // library hiccup must never cost him the line he just wrote. But it is
  // REPORTED, never silently discarded (the 2026-07-31 unchecked-error lesson).
  //
  // ⚠ NOT an upsert. `vendor_lines`' uniques are PARTIAL indexes (…WHERE
  // deleted_at IS NULL AND activity_id IS NULL…), and PostgREST's `onConflict`
  // cannot infer a partial index — it would fail at runtime, or worse, match the
  // wrong one. Read-then-write is explicit and correct.
  let savedToLibrary = false;
  const key = labelKey(row.label);
  const template = coupleName ? toTemplate(body, { 'the couple': coupleName }) : body;

  if (key) {
    const { data: existing, error: findError } = await supabase
      .from('vendor_lines')
      .select('line_id, use_count')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('label_key', key)
      .is('activity_id', null)
      .is('deleted_at', null)
      .maybeSingle();

    const now = new Date().toISOString();
    const libError = findError
      ? findError
      : existing
        ? (
            await supabase
              .from('vendor_lines')
              .update({
                // "cache, not log" — newest wins, the vendor_reply_templates
                // semantics. One line per key, or the library stops being one.
                body: template,
                block_type: row.block_type,
                is_private_note: isPrivate,
                last_used_at: now,
                use_count: ((existing as { use_count?: number }).use_count ?? 0) + 1,
                updated_at: now,
              })
              .eq('line_id', (existing as { line_id: string }).line_id)
          ).error
        : (
            await supabase.from('vendor_lines').insert({
              vendor_profile_id: profile.vendor_profile_id,
              label_key: key,
              block_type: row.block_type,
              body: template,
              is_private_note: isPrivate,
              last_used_at: now,
              use_count: 1,
            })
          ).error;

    if (libError) {
      Sentry.captureException(libError, {
        tags: { feature: 'emcee-lines-library-save' },
        extra: { eventId, vendorProfileId: profile.vendor_profile_id },
      });
    } else {
      savedToLibrary = !isPrivate;
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  return {
    status: 'saved',
    message: savedToLibrary ? 'Saved — and added to My Lines.' : 'Saved.',
    savedToLibrary,
  };
}
