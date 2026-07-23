// Papic Games — couple challenge manager (spec §5 / gap #1 + #8). Lets the couple
// AUTHOR their own generic challenges (so every event has a real game, not just
// booth missions for booked vendors) and CURATE the live set — hide/show any
// mission, delete their own. Async SERVER component: self-fetches the event's
// APPROVED missions (RLS-scoped authenticated client) — pending vendor challenges
// stay in the separate approval panel. Self-gates on papicGamesEnabled().

import { Trophy, Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createCoupleChallengeAction,
  setCoupleChallengeActiveAction,
  deleteCoupleChallengeAction,
} from './actions';

type MissionRow = {
  mission_id: string;
  source: 'auto' | 'couple' | 'vendor';
  prompt: string;
  is_active: boolean;
};

const SOURCE_BADGE: Record<MissionRow['source'], { label: string; cls: string }> = {
  couple: { label: 'Yours', cls: 'bg-mulberry/15 text-mulberry' },
  auto: { label: 'Booth', cls: 'bg-terracotta/15 text-terracotta' },
  vendor: { label: 'Vendor', cls: 'bg-ink/10 text-ink/60' },
};

export async function CoupleChallengesManager({ eventId }: { eventId: string }) {
  if (!papicGamesEnabled()) return null;

  const supabase = await createClient();
  // Approved missions only — live or hidden. Pending vendor challenges
  // (approved=false) belong to the approval panel, not the curation list.
  const { data } = await supabase
    .from('papic_missions')
    .select('mission_id,source,prompt,is_active')
    .eq('event_id', eventId)
    .eq('approved', true)
    .order('created_at', { ascending: true });

  const missions = (data ?? []) as MissionRow[];

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
        Papic Challenges
      </h3>
      <p className="mt-1 text-xs text-ink/60">
        Little photo missions for your guests. Write your own, and hide any you
        don&rsquo;t want — booth challenges appear here as you book vendors.
      </p>

      {/* Author your own */}
      <form action={createCoupleChallengeAction} className="mt-4 space-y-2">
        <input type="hidden" name="event_id" value={eventId} />
        <textarea
          name="prompt"
          required
          maxLength={280}
          rows={2}
          aria-label="Write a Papic Challenge for your guests"
          placeholder="Get a photo with the newlyweds on the dance floor"
          className="w-full resize-none rounded-xl border border-ink/10 bg-cream/70 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-mulberry/40 focus:outline-none"
        />
        <SubmitButton
          pendingLabel="Adding"
          className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add challenge
        </SubmitButton>
      </form>

      {/* Curate the live set */}
      {missions.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {missions.map((m) => {
            const badge = SOURCE_BADGE[m.source] ?? SOURCE_BADGE.vendor;
            return (
              <li
                key={m.mission_id}
                className={`rounded-xl border border-ink/10 bg-cream/70 p-3 ${
                  m.is_active ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <p className="mt-1 text-sm text-ink/90">{m.prompt}</p>
                    {!m.is_active ? (
                      <p className="mt-0.5 text-[11px] text-ink/45">Hidden from guests</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Hide / show — curation for every source. */}
                    <form action={setCoupleChallengeActiveAction}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="mission_id" value={m.mission_id} />
                      <input
                        type="hidden"
                        name="active"
                        value={m.is_active ? 'false' : 'true'}
                      />
                      <button
                        type="submit"
                        title={m.is_active ? 'Hide from guests' : 'Show to guests'}
                        aria-label={m.is_active ? 'Hide from guests' : 'Show to guests'}
                        className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
                      >
                        {m.is_active ? (
                          <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />
                        ) : (
                          <Eye aria-hidden className="h-4 w-4" strokeWidth={2} />
                        )}
                      </button>
                    </form>
                    {/* Delete — only the couple's own. */}
                    {m.source === 'couple' ? (
                      <form action={deleteCoupleChallengeAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="mission_id" value={m.mission_id} />
                        <button
                          type="submit"
                          title="Delete"
                          aria-label="Delete challenge"
                          className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-ink/50 transition-colors hover:border-terracotta/40 hover:text-terracotta"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink/45">
          No challenges yet — add one above, or they&rsquo;ll appear as you book vendors.
        </p>
      )}
    </section>
  );
}
