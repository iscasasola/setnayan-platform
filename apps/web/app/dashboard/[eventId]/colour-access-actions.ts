'use server';

/**
 * MB16 · the four acts of the standing colour grant.
 *
 *   setVendorColourAccess       the couple's ONE switch for one booked supplier
 *   setCoordinatorColourDomain  ONE domain of ONE coordinator, ticked or not
 *   applyColourChange           the holder changes a colour — and the couple is told
 *   rejectColourChange          the couple puts ONE change back
 *
 * ── THREE INDEPENDENT CONTROLS, AND THE INDEPENDENCE IS STRUCTURAL ─────────
 * The grant, the notification and the reject do not touch each other. That is
 * not a convention kept by these four functions — each one calls a single RPC,
 * and the RPCs themselves cannot reach each other's tables:
 * `reject_colour_change`'s body never names `event_colour_grants`, and
 * `set_vendor_colour_access`'s never names `event_colour_changes`.
 * `lib/colour-access-controls-are-independent.test.ts` reads those bodies out
 * of the migration and fails if either sentence stops being true.
 *
 * ── THE GATE IS NOT HERE ───────────────────────────────────────────────────
 * 🔑 EVERY CHECK THAT MATTERS IS IN SQL, ON PURPOSE. `apply_colour_change`
 * refuses without an active grant in the named domain and refuses a target
 * outside it; `set_*_colour_access` and `reject_colour_change` refuse anybody
 * who is not the couple. A caller who skips these actions entirely and hits
 * the RPC by hand is refused identically — `authenticated` holds no INSERT,
 * UPDATE or DELETE on any of the three MB16 tables, so a grant nobody gave and
 * a change nobody was permitted to make are unrepresentable rather than merely
 * unhandled. These functions exist to shape results and to send the mail.
 *
 * ── THE NOTIFICATION IS THE OVERSIGHT ──────────────────────────────────────
 * 🔑 THERE IS NO PER-CHANGE APPROVAL IN THIS MECHANISM — that is the owner's
 * ruling, and it is what makes the notice load-bearing rather than courteous.
 * `colour_changed_in_lane` is on `EMAIL_ENABLED_TYPES` and is NOT in
 * `MARKETING_GATED_EMAIL_TYPES`. A notification with no allowlist entry reaches
 * nobody, which is indistinguishable from having no notification at all — the
 * gap MB8 found on payments and the six `lock_request_*` types found before
 * that. `lib/colour-change-notifications.test.ts` is the other half.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import {
  COLOUR_DOMAIN_LABEL,
  describeColourChange,
  isColourDomain,
  type ColourDomain,
  type ColourTargetKind,
} from '@/lib/colour-access';

export type ColourAccessResult =
  | { status: 'ok' }
  | { status: 'not_booked' }
  | { status: 'no_lane' }
  | { status: 'not_a_coordinator' }
  | { status: 'error'; message: string };

/**
 * Turn one booked supplier's colour access on or off.
 *
 * ⚠ NO DOMAIN LIST CROSSES THIS BOUNDARY. The RPC resolves the lane from
 * `event_vendors.category` itself. Passing it from here would look equivalent
 * and be weaker: a caller who chooses the parameter could hand a florist the
 * couple's five main colours.
 */
export async function setVendorColourAccess(
  eventId: string,
  vendorId: string,
  active: boolean,
): Promise<ColourAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('set_vendor_colour_access', {
    p_event_id: eventId,
    p_vendor_id: vendorId,
    p_active: active,
  });
  if (error) return { status: 'error', message: error.message };
  const env = (data ?? {}) as { status?: string };
  if (env.status === 'not_booked') return { status: 'not_booked' };
  if (env.status === 'no_lane') return { status: 'no_lane' };
  if (env.status !== 'ok') return { status: 'error', message: env.status ?? 'unknown' };

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
  return { status: 'ok' };
}

/**
 * Tick or untick ONE colour domain for ONE coordinator.
 *
 * One call per checkbox, deliberately: a coordinator holds several independent
 * grants, and "reception decor but not the main colours" has to be a state the
 * couple can actually reach rather than an approximation of an all-or-nothing
 * switch.
 */
export async function setCoordinatorColourDomain(
  eventId: string,
  userId: string,
  domain: string,
  active: boolean,
): Promise<ColourAccessResult> {
  if (!isColourDomain(domain)) return { status: 'error', message: 'unknown_domain' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('set_host_colour_access', {
    p_event_id: eventId,
    p_user_id: userId,
    p_domain: domain,
    p_active: active,
  });
  if (error) return { status: 'error', message: error.message };
  const env = (data ?? {}) as { status?: string };
  if (env.status === 'not_a_coordinator') return { status: 'not_a_coordinator' };
  if (env.status !== 'ok') return { status: 'error', message: env.status ?? 'unknown' };

  revalidatePath(`/dashboard/${eventId}/hosts`);
  return { status: 'ok' };
}

export type ApplyColourResult =
  | { status: 'ok'; changeId: string }
  /** MB12's freeze won: a supplier has already signed off on this part and the
   *  write was reverted inside the same statement. Nothing was logged. */
  | { status: 'frozen' }
  | { status: 'refused' }
  | { status: 'unchanged' }
  | { status: 'error'; message: string };

/**
 * A granted vendor or coordinator changes ONE colour inside their lane.
 *
 * 🔑 THE ONLY DOOR. It writes nothing itself — `apply_colour_change` performs
 * the write internally as the table owner, so no vendor and no coordinator ever
 * holds raw UPDATE on `public.events`. `couple_can_update_event` is byte-for-
 * byte what it was on 2026-05-13, and
 * `tests/db/the-events-update-policy-does-not-move.db.test.ts` fails on any
 * diff.
 */
export async function applyColourChange(
  eventId: string,
  domain: ColourDomain,
  targetKind: ColourTargetKind,
  targetKey: string,
  targetIndex: number | null,
  newValue: string,
): Promise<ApplyColourResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('apply_colour_change', {
    p_event_id: eventId,
    p_domain: domain,
    p_target_kind: targetKind,
    p_target_key: targetKey,
    p_target_index: targetIndex,
    p_new_value: newValue,
  });
  if (error) {
    // 42501 is the function's own refusal — no active grant in this domain, or
    // a target outside it. Reported as `refused` rather than as an error
    // string: it is an answer, not a fault.
    if (error.code === '42501') return { status: 'refused' };
    return { status: 'error', message: error.message };
  }
  const env = (data ?? {}) as {
    status?: string;
    change_id?: string;
    old_value?: string | null;
    new_value?: string;
    actor_label?: string | null;
  };
  if (env.status === 'frozen') return { status: 'frozen' };
  if (env.status === 'unchanged') return { status: 'unchanged' };
  if (env.status !== 'ok' || !env.change_id) {
    return { status: 'error', message: env.status ?? 'unknown' };
  }

  await notifyCoupleOfColourChange(eventId, {
    domain,
    targetKind,
    targetKey,
    targetIndex,
    oldValue: env.old_value ?? null,
    newValue: env.new_value ?? newValue,
    actorLabel: env.actor_label ?? null,
  });

  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  revalidatePath(`/vendor-dashboard/clients/${eventId}/mood-board`);
  return { status: 'ok', changeId: env.change_id };
}

/**
 * Put ONE logged change back to its prior value.
 *
 * 🔑 IT DOES NOT REVOKE ANYTHING, AND CANNOT. `reject_colour_change` never
 * names either grant table, so the person whose change was rejected keeps their
 * standing access and can make the next change immediately — which is the
 * owner's ruling, and the reason the couple gets a Reject button instead of
 * being pushed toward switching somebody off over one colour.
 */
export async function rejectColourChange(
  eventId: string,
  changeId: string,
): Promise<{ status: 'ok' | 'already' | 'frozen' | 'slot_gone' | 'error'; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('reject_colour_change', {
    p_change_id: changeId,
  });
  if (error) return { status: 'error', message: error.message };
  const env = (data ?? {}) as { status?: string };
  if (env.status === 'already') return { status: 'already' };
  if (env.status === 'frozen') return { status: 'frozen' };
  if (env.status === 'slot_gone') return { status: 'slot_gone' };
  if (env.status !== 'ok') return { status: 'error', message: env.status ?? 'unknown' };

  revalidatePath(`/dashboard/${eventId}/hosts`);
  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  return { status: 'ok' };
}

/**
 * Tell the couple, every single time.
 *
 * Fail-soft and best-effort per member: the change is already committed and a
 * Resend hiccup must never roll it back. But it is not in-app-only — see the
 * header, and `lib/colour-change-notifications.test.ts`, which asserts the type
 * is on the email allowlist AND is emitted from this file. A perfectly
 * configured type nobody sends reaches nobody; so does a type sent on a channel
 * that is switched off.
 */
async function notifyCoupleOfColourChange(
  eventId: string,
  change: {
    domain: ColourDomain;
    targetKind: ColourTargetKind;
    targetKey: string;
    targetIndex: number | null;
    oldValue: string | null;
    newValue: string;
    actorLabel: string | null;
  },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');

    const said = describeColourChange({
      target_kind: change.targetKind,
      target_key: change.targetKey,
      target_index: change.targetIndex,
      old_value: change.oldValue,
      new_value: change.newValue,
    });
    const who = (change.actorLabel ?? '').trim() || 'Someone you gave colour access';
    const from = said.from ? `${said.from} → ` : '';

    for (const m of members ?? []) {
      const userId = (m as { user_id: string | null }).user_id;
      if (!userId) continue;
      await emitNotification({
        userId,
        type: 'colour_changed_in_lane',
        title: `${who} changed a colour`,
        body:
          `${said.what} — ${from}${said.to} (${COLOUR_DOMAIN_LABEL[change.domain]}). ` +
          'You can put this one change back without touching their access.',
        relatedUrl: `/dashboard/${eventId}/studio/mood-board#palette`,
      });
    }
  } catch (e) {
    console.error(
      `[applyColourChange] colour_changed_in_lane notify failed for event_id=${eventId}:`,
      e,
    );
  }
}
