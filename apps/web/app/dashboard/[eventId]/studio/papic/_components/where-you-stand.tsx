import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readEventPoolStatus } from '@/lib/papic-event-pool';
import { Images, Camera, Clock, Coins } from 'lucide-react';

/**
 * WHERE YOU STAND — four facts, above every Papic room.
 *
 * Owner, opening his own wedding's Papic page: *"entering papic inside an event
 * needs to me simpler and better to manage. if I am a customer and I see this,
 * I will be confused."*
 *
 * The screen could not answer the first question a person asks — **where do I
 * stand?** It opened on a look picker and three photo-quality cards. Everything
 * that told you anything about your own celebration was inside a card further
 * down, or in a room you were not in. This is the Detail archetype's key-facts
 * treatment: the state of ONE entity, in mono, before anything asks you to
 * decide something.
 *
 * ⚠ AN UNREAD COUNT IS NOT ZERO. Every read here checks its own error and falls
 * back to an em dash, never to `0`. A failed read that renders "0 photos" tells
 * a couple their gallery is empty — the single most alarming thing this strip
 * could say, produced by a network blip. Supabase does not throw on a failed
 * read; it resolves with `{ error }`, so a `try/catch` around one is decoration.
 *
 * ⚠ It is a SERVER COMPONENT with its own reads on purpose. The page already
 * carries a long body; colocating these three counts with the thing that
 * renders them keeps them from becoming another set of values threaded through
 * props that nobody can trace back to a query.
 */
export async function WhereYouStand({
  eventId,
  windowIsSet,
  windowSummary,
}: {
  eventId: string;
  windowIsSet: boolean;
  windowSummary: string;
}) {
  const admin = createAdminClient();

  const [seatRes, photoRes, guestRes, pool] = await Promise.all([
    admin
      .from('paparazzi_seats')
      .select('seat_index', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('revoked_at', null),
    admin
      .from('papic_photos')
      .select('photo_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('hidden_at', null),
    admin
      .from('papic_guest_captures')
      .select('event_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('hidden_at', null),
    readEventPoolStatus(admin, eventId),
  ]);

  // ⚠ `{ count }` is a DIFFERENT SHAPE from `{ data }` — a guard written for
  // `data` cannot see a count read fail, and an invented zero has triggered a
  // write in this repo before. Each is checked on its own terms.
  if (seatRes.error) logQueryError('WhereYouStand.seats', seatRes.error, { eventId }, 'graceful_degrade');
  if (photoRes.error) logQueryError('WhereYouStand.photos', photoRes.error, { eventId }, 'graceful_degrade');
  if (guestRes.error) logQueryError('WhereYouStand.guestCaptures', guestRes.error, { eventId }, 'graceful_degrade');

  const cameras = seatRes.error ? null : (seatRes.count ?? 0);
  const inLibrary =
    photoRes.error || guestRes.error ? null : (photoRes.count ?? 0) + (guestRes.count ?? 0);
  const credits = pool.ok && pool.status.applies ? pool.status.remainingPoints : null;

  // ⚠ ONE SOURCE FOR THE CAMERA COUNT, DELIBERATELY. The page separately
  // counts GUEST cameras, and a guest camera is also a `paparazzi_seats` row —
  // adding the two would double-count every guest who has one. Counting the
  // seats once is the honest number: how many cameras exist for this event.
  const waysIn =
    cameras !== null && cameras > 0
      ? `${cameras} camera${cameras === 1 ? '' : 's'}`
      : null;

  return (
    <section
      aria-label="Where you stand"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-4"
    >
      <Fact icon={<Images aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label="In your library">
        {inLibrary === null ? (
          <Unmeasured />
        ) : inLibrary === 0 ? (
          <span className="text-ink/70">Empty — yours to start</span>
        ) : (
          <>{inLibrary.toLocaleString('en-PH')} so far</>
        )}
      </Fact>

      <Fact icon={<Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Ways in">
        {cameras === null ? <Unmeasured /> : (waysIn ?? <span className="text-ink/70">Just you, for now</span>)}
      </Fact>

      <Fact icon={<Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Still coming">
        {windowIsSet ? (
          windowSummary
        ) : (
          /* The one required act. mulberry-600, not -700: the 700 slot flips to
             the light theme's #C24E25 on a dark panel and measures 3.05:1
             there — a fail that a light-only check waves straight through. */
          <span className="text-mulberry-600">Cameras — set the dates</span>
        )}
      </Fact>

      <Fact icon={<Coins aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Credits">
        {credits === null ? <Unmeasured /> : <>{credits.toLocaleString('en-PH')} left</>}
      </Fact>
    </section>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface p-3.5">
      <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink/55">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-mono text-[12.5px] leading-snug text-ink">{children}</p>
    </div>
  );
}

/** A read that did not answer. NEVER rendered as 0 — see the docblock. */
function Unmeasured() {
  return (
    <span className="text-ink/45" title="We couldn’t read this just now">
      —
    </span>
  );
}
