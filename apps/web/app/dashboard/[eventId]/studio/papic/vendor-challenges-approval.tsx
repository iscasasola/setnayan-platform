// Papic Games — Phase 4b: the COUPLE approval panel (spec §3.6). A vendor writing
// on the couple's surface needs one tap of approval, so pending vendor challenges
// land here for Approve / Decline. Async SERVER component — self-fetches the
// event's pending vendor missions (the couple can read papic_missions via the
// Phase-1 couple/coordinator RLS policy). Self-gates on papicGamesEnabled() and
// hides entirely when there's nothing to review.

import { Trophy, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { reviewVendorChallengeAction } from './actions';

type PendingRow = { mission_id: string; prompt: string };

export async function VendorChallengesApproval({ eventId }: { eventId: string }) {
  if (!papicGamesEnabled()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('papic_missions')
    .select('mission_id,prompt')
    .eq('event_id', eventId)
    .eq('source', 'vendor')
    .eq('approved', false)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const pending = (data ?? []) as PendingRow[];
  if (pending.length === 0) return null; // nothing to review → no empty shell

  return (
    <section className="rounded-2xl border border-mulberry/30 bg-mulberry/[0.05] p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
        Vendor Photo Challenges — your okay
      </h3>
      <p className="mt-1 text-xs text-ink/60">
        A booked vendor wrote a photo challenge for your guests. Approve the ones
        you like; they only go live once you do.
      </p>

      <ul className="mt-4 space-y-3">
        {pending.map((m) => (
          <li
            key={m.mission_id}
            className="rounded-xl border border-ink/10 bg-cream/70 p-4"
          >
            <p className="text-sm text-ink/90">{m.prompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={reviewVendorChallengeAction}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="mission_id" value={m.mission_id} />
                <input type="hidden" name="decision" value="approve" />
                <SubmitButton
                  pendingLabel="Approving"
                  className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
                >
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Approve
                </SubmitButton>
              </form>
              <form action={reviewVendorChallengeAction}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="mission_id" value={m.mission_id} />
                <input type="hidden" name="decision" value="reject" />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <X aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Decline
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
