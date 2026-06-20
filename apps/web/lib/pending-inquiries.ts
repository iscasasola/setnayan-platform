import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { unlockCategoryWithInquiry } from '@/app/dashboard/[eventId]/vendors/_actions/unlock-category';
import { PICK_TO_GROUP } from '@/lib/onboarding-availability';

/**
 * dispatchPendingInquiries — auto-send the inquiries an anonymous couple HELD
 * during onboarding, the moment they secure their account.
 *
 * Anon-draft model: an account-less couple finishes onboarding and picks
 * vendors, but the inquiry fan-out is SKIPPED at commit (a vendor reply would
 * bounce to their placeholder email, and a vendor could burn a token answering
 * a ghost). The intent is stashed in events.style_preferences.pending_inquiry_dispatch
 * ({ perCategory }); the picks themselves live in .interested_categories. Once
 * the couple converts (signup attaches an email to the SAME uid) and lands on
 * the dashboard authenticated + non-anonymous, this replays the fan-out.
 *
 * Called from the dashboard layout's `after()` (post-response, so it never
 * blocks the render) ONLY when the principal is NOT anonymous. Idempotent: it
 * reuses unlockCategoryWithInquiry, whose `already_active` check + the
 * chat_threads UNIQUE(event_id, vendor_profile_id) constraint dedupe any
 * re-run, so a partial failure simply completes on the next load. Best-effort
 * throughout — a couple can always inquire from the dashboard by hand, so this
 * never throws into the caller.
 */
export async function dispatchPendingInquiries(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    // Events this user co-owns as a couple. Most couples have one; we filter for
    // the pending flag in JS rather than a JSONB predicate for clarity.
    const { data: memberships } = await admin
      .from('event_members')
      .select('event_id, events!inner(event_id, style_preferences)')
      .eq('user_id', userId)
      .eq('member_type', 'couple');

    for (const row of memberships ?? []) {
      const event = (row as { events?: { event_id?: string; style_preferences?: unknown } }).events;
      const eventId = event?.event_id;
      const prefs = (event?.style_preferences ?? {}) as Record<string, unknown>;
      const pending = prefs.pending_inquiry_dispatch as { perCategory?: number } | undefined;
      if (!eventId || !pending) continue;

      const perCategory = Math.max(1, Math.min(5, Math.round(pending.perCategory ?? 3)));
      const picks = Array.isArray(prefs.interested_categories)
        ? (prefs.interested_categories as string[])
        : [];
      const groupIds = Array.from(
        new Set(
          picks
            .map((p) => PICK_TO_GROUP[p])
            .filter((g): g is string => Boolean(g)),
        ),
      );

      // Fan out FIRST (idempotent), then clear the flag so a transient failure
      // is retried on the next dashboard load rather than silently lost.
      if (groupIds.length > 0) {
        await Promise.allSettled(
          groupIds.map((groupId) =>
            unlockCategoryWithInquiry({ eventId, groupId, count: perCategory }),
          ),
        );
      }

      // Clear the flag (read-modify-write so we don't clobber the rest of the
      // blob). Done after dispatch; the idempotent fan-out makes a re-run safe.
      const { pending_inquiry_dispatch: _drop, ...rest } = prefs;
      void _drop;
      await admin
        .from('events')
        .update({ style_preferences: rest })
        .eq('event_id', eventId);
    }
  } catch (err) {
    console.error('[dispatchPendingInquiries] failed (non-fatal):', err);
  }
}
