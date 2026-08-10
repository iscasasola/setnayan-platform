// Papic Games — couple challenge manager (spec §5 / gap #1 + #8). Lets the couple
// AUTHOR their own generic challenges (so every event has a real game, not just
// booth missions for booked vendors) and CURATE the live set — hide/show any
// mission, delete their own. Async SERVER component: self-fetches the event's
// APPROVED missions (RLS-scoped authenticated client) — pending vendor challenges
// stay in the separate approval panel. Self-gates on papicGamesEnabled().

import { Trophy, Eye, EyeOff, Trash2, Plus, MessageSquareQuote } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { displayChallengePrompt, type PapicMissionSource } from '@/lib/papic-missions';
import {
  createCoupleChallengeAction,
  addLibraryChallengeAction,
  setCoupleChallengeActiveAction,
  deleteCoupleChallengeAction,
} from './actions';

/** A story question the couple has not added yet. */
type StoryRow = {
  library_id: number;
  category: string;
  title: string;
  prompt: string;
};

/** The two story groups, in the order the couple reads them. `stories` carries
 *  the {who} side token — each guest is asked about the half they know — while
 *  `stories_couple` is always about the pair. The copy has to say which,
 *  because "Share a story about the couple" and "…about the bride" look like
 *  the same question on this screen and are not. */
const STORY_GROUPS = [
  {
    category: 'stories',
    heading: 'About whichever of you they know',
    line: 'Their side decides the wording — your guests get asked about you, yours about you.',
  },
  {
    category: 'stories_couple',
    heading: 'About the two of you together',
    line: 'Everyone gets the same question, whichever side they came from.',
  },
] as const;

type MissionRow = {
  mission_id: string;
  // ⚠ Reuse the shared union — do NOT restate it. This file used to declare its
  // own ('auto' | 'couple' | 'vendor'). When the §9 library added a fourth
  // source the database learned it and this screen did not, so every Setnayan
  // recommendation rendered under the fallback badge and told the couple a
  // vendor had written it. Keyed off the shared type, adding a source now fails
  // the build here until it gets a badge.
  source: PapicMissionSource;
  prompt: string;
  is_active: boolean;
};

const SOURCE_BADGE: Record<PapicMissionSource, { label: string; cls: string }> = {
  couple: { label: 'Yours', cls: 'bg-mulberry/15 text-mulberry' },
  auto: { label: 'Booth', cls: 'bg-terracotta/15 text-terracotta' },
  vendor: { label: 'Vendor', cls: 'bg-ink/10 text-ink/60' },
  setnayan: { label: 'Recommended', cls: 'bg-gold/15 text-gold-700' },
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

  // ── The story picker ──────────────────────────────────────────────────────
  // Every story question Setnayan supplies, minus the ones this event already
  // carries. Two reads, not a join: `papic_challenge_library` is a global
  // catalogue and `papic_missions` is event-scoped under RLS, so the exclusion
  // happens here.
  //
  // ⚠ The taken-set is read WITHOUT an is_active filter on purpose. A question
  // the couple has hidden is still THEIRS — re-offering it in the picker would
  // read as "add this" while their own list a few centimetres below says
  // "Hidden from guests", and tapping it would do nothing visible. Hidden means
  // taken; un-hiding is the Show button, not a second Add.
  const { data: takenRows, error: takenErr } = await supabase
    .from('papic_missions')
    .select('library_id')
    .eq('event_id', eventId)
    .not('library_id', 'is', null);
  const { data: storyRows, error: storyErr } = await supabase
    .from('papic_challenge_library')
    .select('library_id,category,title,prompt')
    .in('category', ['stories', 'stories_couple'])
    .eq('is_active', true)
    .order('library_id', { ascending: true });

  // 🔑 A REJECTED READ RESOLVES WITH `{ error }` AND A NULL ROW — IT DOES NOT
  // THROW. `?? []` on a failed read renders an empty picker that is
  // indistinguishable from "you have added them all", which is the most
  // reassuring possible way to show a broken screen. Suppress the whole section
  // instead, and only when BOTH reads are good is the list trustworthy: a
  // failed taken-read with a good story-read would offer questions they already
  // have.
  const pickerReadable = !takenErr && !storyErr;
  const taken = new Set((takenRows ?? []).map((r) => r.library_id as number));
  const availableStories = pickerReadable
    ? ((storyRows ?? []) as StoryRow[]).filter((s) => !taken.has(s.library_id))
    : [];

  // The board shows at most 10 of the couple's own picks. Past that an added
  // question is real but waits its turn, and saying so beats a guest board that
  // quietly does not match what this screen lists.
  const couplePicked = missions.filter((m) => m.source === 'couple').length;

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
        Papic Challenges
      </h3>
      <p className="mt-1 text-xs text-ink/60">
        Little photo missions for your guests. We add a set of recommended ones;
        write your own, and hide any you don&rsquo;t want — booth challenges
        appear here as you book vendors.
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

      {/* Story questions — pick from Setnayan's set.
          These are the only challenges that ask a guest to SAY something
          rather than photograph something, so they get their own block
          instead of being buried in the list below. */}
      {availableStories.length > 0 ? (
        <div className="mt-5 rounded-xl border border-gold/25 bg-gold/[0.04] p-4">
          <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <MessageSquareQuote aria-hidden className="h-4 w-4 text-gold-700" strokeWidth={1.75} />
            Ask your guests for a story
          </h4>
          <p className="mt-1 text-xs text-ink/60">
            Ten seconds to camera each. A few are already on your guests&rsquo;
            board &mdash; add any of these and they&rsquo;ll be asked those too.
          </p>
          {couplePicked >= 10 ? (
            <p className="mt-2 rounded-lg bg-ink/5 px-3 py-2 text-[11px] text-ink/70">
              Your guests see up to 10 of your own picks at once. Anything you add
              now waits until you hide one of yours.
            </p>
          ) : null}

          {STORY_GROUPS.map((group) => {
            const rows = availableStories.filter((s) => s.category === group.category);
            if (rows.length === 0) return null;
            return (
              <div key={group.category} className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">
                  {group.heading}
                </p>
                <p className="mt-0.5 text-[11px] text-ink/55">{group.line}</p>
                <ul className="mt-2 space-y-1.5">
                  {rows.map((s) => (
                    <li
                      key={s.library_id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-ink/10 bg-cream/70 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink">{s.title}</p>
                        {/* Neutral wording — the raw {who} token never shown. */}
                        <p className="mt-0.5 text-sm text-ink/80">
                          {displayChallengePrompt(s.prompt)}
                        </p>
                      </div>
                      <form action={addLibraryChallengeAction} className="shrink-0">
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="library_id" value={s.library_id} />
                        <SubmitButton
                          pendingLabel="Adding"
                          className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
                        >
                          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          Add
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Curate the live set */}
      {missions.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {missions.map((m) => {
            // The Record above is exhaustive over PapicMissionSource, so this
            // only fires on a value the database allows and TypeScript has not
            // heard of. It must NOT fall back to another source's badge —
            // defaulting to `vendor` is exactly how Setnayan's own
            // recommendations came to be labelled as a vendor's.
            const badge =
              SOURCE_BADGE[m.source] ?? { label: 'Challenge', cls: 'bg-ink/10 text-ink/60' };
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
                    {/* The story challenges store a {who} side token that the
                        guest reader swaps per guest. The couple is not a side,
                        so they see the neutral wording — never the raw token. */}
                    <p className="mt-1 text-sm text-ink/90">{displayChallengePrompt(m.prompt)}</p>
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
                          className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-ink/50 transition-colors hover:border-terracotta/40 hover:text-terracotta-700"
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
