import type { HomeGuide } from '@/lib/home-first-screen';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { makerHasWork } from '@/lib/maker-details-items';
import { homeProgress, stepTitleOf } from '@/lib/details-guided-flow';
import { HUB_SETUP_OFFER_TOUR } from '@/lib/tours';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readGuidedPlan } from '../launch/_components/details-guided-progress';

/**
 * 🪜 HOME'S READ OF THE GUIDED FLOW — "Round N · x of y · Continue"
 * (DECISION_LOG 2026-09-29 "THE GUIDED FLOW IS APPROVED — AND ANY STEP CAN BE
 * PICKED ANY TIME": *"Home shows 'Round N · x of y · Continue'"*; Details part 5).
 *
 * The same plan the Maker's Details draws (`readGuidedPlan` — the same columns,
 * the same helpers, the same "done"), so Home and the flow can never count a
 * different round. Continue opens the Maker on What's left, at the step still
 * to do (`?guide=1`).
 *
 * Drawn only for whom Details is (`makerHasWork`: the host of an event whose
 * type has an Event Hub), and only while something is left. A plan that could
 * not be read draws NOTHING — never a "0 of 7" nobody measured.
 *
 * 📱 2026-10-01 ("THE SIMPLE PHONE APP — APPROVED"): this used to draw its own
 * tile under the bento. It is now the FIRST candidate for Home's one Next card
 * (`lib/home-first-screen.ts` `pickHomeNext`) — the same read, the same link
 * (`?tool=details&guide=1`), one card instead of a stack. Started beside Home's
 * other reads in its one wait, never after them.
 */
export async function readHomeGuide({ eventId, memberType }: { eventId: string; memberType: string | null }): Promise<HomeGuide> {
  // Who Details is for, first — nobody else pays for the reads below.
  if (memberType !== 'couple') return null;
  const profile = await resolveProfileByEvent(eventId).catch(() => null);
  if (!profile || !makerHasWork(memberType, surfaceEnabled(profile, 'website'))) return null;
  const supabase = await createClient();
  const read = await readGuidedPlan({ supabase, admin: createAdminClient(), eventId }).catch((e: unknown) => {
    console.error('[home] the guided flow could not be read:', e instanceof Error ? e.message : e);
    return null;
  });
  if (!read) return null;
  const { plan } = read;
  const at = homeProgress(plan);
  if (!at) return null;
  /* 🧭 "Finish your Event Hub" (the setup, B) — offered ONCE right after the
     onboarding that made this event (Start / Later): until the couple answers
     it (Later, here; Start, by the setup's own first screen in the Maker —
     both mark the one key seen), the card is the offer. Older events: the
     slim card. */
  let offer = false;
  if (at.round === 0 && read.setupOffered) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: row, error } = await supabase.from('users').select('tour_seen_keys').eq('user_id', user.id).maybeSingle();
      if (error) {
        // Unread → no offer (the slim card still shows): never an offer the couple already answered.
        logQueryError('HomeGuide.setupOffer', error, { event_id: eventId }, 'graceful_degrade');
      } else {
        const seen = ((row as { tour_seen_keys?: unknown } | null)?.tour_seen_keys ?? []) as unknown;
        offer = !(Array.isArray(seen) && seen.includes(HUB_SETUP_OFFER_TOUR));
      }
    }
  }
  return {
    round: at.round,
    roundTitle: at.title,
    done: at.done,
    total: at.total,
    nextTitle: stepTitleOf(plan, at.next),
    thenTitle: at.then ? stepTitleOf(plan, at.then) : null,
    setup: at.round === 0,
    offer,
  };
}
