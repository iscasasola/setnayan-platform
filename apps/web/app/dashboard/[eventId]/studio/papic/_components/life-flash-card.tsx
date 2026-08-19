import { Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { countEventMoments, SCOPE_MIN_MOMENTS } from '@/lib/life-story-moment-graph';
import { viewerSeesCoupleScopedPapic } from '@/lib/papic-gallery-scope';

/**
 * This day's own Life-Flash — the film of one event, on the event's own surface.
 *
 * Owner 2026-08-19, completing the Alaala design: the whole-life flash sits at
 * the top of Alaala; opening an album should offer that same film pointed at the
 * one day. Life-Flash has supported a per-event scope since it shipped — the
 * scope type, the `e<eventId>` key, the parser and the slice all exist. What did
 * not exist was any way in from the event. This is the doorway, not the engine.
 *
 * ── THREE GATES, AND THEY ARE NOT THE SAME GATE ────────────────────────────
 * 1 · THE FLAG. Life-Flash's route calls `notFound()` when the flag is off, so
 *     an ungated card is a door onto a 404. Unlike the Alaala tile, this card
 *     says NOTHING when the flag is off — that tile has a story to tell about
 *     the feature; a keepsake card on a gallery page does not.
 * 2 · THE VIEWER. The moment graph only ever contains events where the viewer
 *     is a COUPLE member. This page deliberately admits more than that — a
 *     promoted coordinator sees a partial album — so a coordinator following
 *     this link would reach a page showing them nothing. The caller passes
 *     card asks for itself, exactly as its sibling cards self-gate — the
 *     resolved boolean lives in a different component further down this page,
 *     and threading it up would have meant passing a value that is not in
 *     scope. (The first cut passed the FUNCTION by mistake; `tsc` caught it,
 *     but a truthy function reference would have opened this door to everyone.)
 * 3 · THE COUNT ≥ 3 (`SCOPE_MIN_MOMENTS.event`). ⚠ That constant gates the
 *     SCOPE CHIP on the Life-Flash page, not the URL — the link works below the
 *     threshold and renders a thin flash, and at ZERO moments the page shows
 *     "Nothing gathered in this stretch yet" with NO chip for this event, which
 *     is a dead end with no way back. Gating the card at the same number is what
 *     makes the card and the chip agree.
 *
 * ⚠ FAILS CLOSED ON AN UNMEASURED COUNT. `countEventMoments` returns null when
 * the read was refused — a rejected Supabase query resolves with `{ error }`
 * rather than throwing — and null means "not measured", never "zero". A card
 * offered on an unmeasured count is a door that may open onto nothing.
 *
 * COLOUR: the CTA is `bg-mulberry`, matching RecapCard. The icon may wear gold
 * (`text-terracotta` is the atelier gold in this repo, 3.37:1 on cream — fine
 * for an icon at the 3:1 non-text bar, never for text).
 */
export async function LifeFlashCard({ eventId }: { eventId: string }) {
  if (!lifeStoryEnabled()) return null;

  const supabase = await createClient();
  let moments: number | null = null;
  try {
    // The moment graph is COUPLE-scoped; anyone else this page admits would
    // land on a page showing them nothing.
    if (!(await viewerSeesCoupleScopedPapic(supabase, eventId))) return null;
    moments = await countEventMoments(supabase, eventId);
  } catch {
    return null;
  }
  // null = not measured. Fail closed.
  if (moments === null || moments < SCOPE_MIN_MOMENTS.event) return null;

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <Zap aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
        This day, as a flash
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        {moments} {moments === 1 ? 'moment' : 'moments'} from this day, played back through
        every camera that was there.
      </p>
      {/* The event id is the events.event_id UUID the route param carries — the
          same id space the moment graph keys on. NEVER the S89E public id. */}
      <a
        href={`/dashboard/life-flash?scope=e${eventId}`}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
      >
        <Zap aria-hidden className="h-4 w-4" strokeWidth={2} />
        Play this day
      </a>
    </section>
  );
}
