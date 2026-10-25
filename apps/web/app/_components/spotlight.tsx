import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { TOURS, type TourKey } from '@/lib/tours';
import { completeTour } from '@/lib/tour-actions';
import { SpotlightMount } from './spotlight-mount';

/**
 * 🔦 A SERVER COMPONENT, like `GuidedTour`: it reads `lib/tours.ts` here and hands the client mount
 * just this one tour's words, so every other tour stays off the browser
 * (`lib/tours-stay-on-the-server.test.ts`). `seen` comes from the `tour_seen_keys` the caller has
 * already read (the role layouts read it in their batched `users` select — never a second read).
 *
 * The OLD carousel stays off (`lib/tip-popups.ts`); this is what replaces it (owner 2026-10-03:
 * "remove these since we will place the spotlight tour soon").
 */
export async function Spotlight({
  tourKey,
  seenKeys,
  after,
  replay = false,
  name = null,
  inMaker = false,
}: {
  tourKey: TourKey;
  /** The person's display name — a welcome step says "Welcome, {name}". */
  name?: string | null;
  /**
   * Already read by the caller (the role layouts). Left out → read here, once, as `MiniTour` does.
   * NULL = the read did not come back: draw nothing rather than replay a tour the person finished.
   */
  seenKeys?: ReadonlyArray<string> | null;
  /** Another spotlight that goes first — this one waits until that one is seen, so two never stack. */
  after?: TourKey;
  /** This mount answers the account menu's "Show me around"; `'page'`: in place of the layout's, on its page. */
  replay?: boolean | 'page';
  /** Drawn inside the Maker — the engine's Maker pause is not for this one (`lib/host-page-tours.ts`). */
  inMaker?: boolean;
}) {
  const script = TOURS[tourKey]?.spotlight;
  if (!script) return null;
  const seen = seenKeys !== undefined ? seenKeys : await readSeenKeys();
  if (seen === null) return null; // signed out, or the read failed — never block the page
  if (after && !seen.includes(after)) return null;
  // Done, and nothing here can replay it: draw nothing, so the page carries none of its words.
  if (seen.includes(tourKey) && !replay) return null;
  return (
    <SpotlightMount
      tourKey={tourKey}
      script={script}
      seen={seen.includes(tourKey)}
      replay={replay}
      name={name}
      inMaker={inMaker}
      after={after}
      completeAction={completeTour}
    />
  );
}

/** `users.tour_seen_keys` for the signed-in person; null when there is nobody or the read fails. */
async function readSeenKeys(): Promise<ReadonlyArray<string> | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: row, error } = await supabase.from('users').select('tour_seen_keys').eq('user_id', user.id).maybeSingle();
    if (error) {
      // Unknown, so the tour is not shown (never replayed to someone who finished it) — and said.
      logQueryError('Spotlight.readSeenKeys', error, { user_id: user.id }, 'graceful_degrade');
      return null;
    }
    return (row?.tour_seen_keys ?? []) as string[];
  } catch (err) {
    logQueryError('Spotlight.readSeenKeys (threw)', err instanceof Error ? err : new Error(String(err)), {}, 'graceful_degrade');
    return null;
  }
}
