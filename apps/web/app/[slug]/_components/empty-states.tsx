import Link from 'next/link';
import { CalendarClock, MapPin, ScanLine } from 'lucide-react';
import { VENUE_ROLE_LABEL, type EventVenue } from '@/lib/event-venues';
import { DetailsBigDate, DetailsCard } from './event-details-styles';

/**
 * Open-browse empty / find-mode plates (OPEN-BROWSE PR8 — council verdict
 * 2026-07-22 §1.1 degraded states, §1.3 identity-aware Home).
 *
 * Under open-browse every menu tab exists from day one, so a tab can point at a
 * section the couple has not filled yet. Rather than a dead anchor, the section
 * renders a quiet teaser plate — "being written", never an error. All of this
 * mounts ONLY on the open-browse path (`plan.openBrowse`), which is FALSE for
 * every production event today, so the flag-off site is unchanged.
 *
 * NOTE: copy here is a first pass in the Setnayan voice; the brand-voice pass is
 * an owner sign-off item (§5.9) — the strings are centralized here so a later
 * edit is a one-file change.
 */

/** Which browsable section an empty plate stands in for. */
export type EmptySectionKind = 'details' | 'story';

const PRESENT_COPY: Record<EmptySectionKind, string> = {
  details: 'The program is being written.',
  story: 'Their story is being written.',
  // 🗑 A `photos` PLATE USED TO LIVE HERE AND NO GUEST COULD EVER REACH IT.
  // `SectionEmptyPlate` has exactly two call sites — site-body's `details` and
  // `story` plates — and nothing anywhere passed kind="photos". It had been
  // carried since 2026-08-17 with a note saying so, and it still said "the
  // couple's photos", which would have been wrong at a birthday or a wake the
  // day anybody wired it up. A plate nobody can reach is not an empty state, so
  // it is deleted rather than reworded. WHOEVER ADDS A PHOTOS PLATE must take
  // the organiser's word from `_lib/event-words.ts`, as every other room does.
};

// "for this ___" — filled from EventWords.occasion. 'celebration' for every
// pre-existing type (the default keeps an unwired call site byte-identical);
// 'gathering' for the funeral, where "celebration" is the defect.
const PAST_COPY: Record<EmptySectionKind, (occasion: string) => string> = {
  details: (o) => `No program was published for this ${o}.`,
  story: (o) => `No story was shared for this ${o}.`,
};

/**
 * A quiet placeholder for an empty browsable section. `pastTense` swaps to a
 * post-event variant so the archive never reads future-tense (§1.3). Uses the
 * couple's accent only through the surrounding palette classes (no per-event
 * hex needed — kept brand-neutral cream/ink).
 */
export function SectionEmptyPlate({
  kind,
  pastTense = false,
  occasion = 'celebration',
}: {
  kind: EmptySectionKind;
  pastTense?: boolean;
  /** EventWords.occasion — 'celebration' (default) or the funeral's 'gathering'. */
  occasion?: string;
}) {
  const copy = pastTense ? PAST_COPY[kind](occasion) : PRESENT_COPY[kind];
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-cream/40 px-6 py-10 text-center">
      <p className="font-serif text-base italic text-ink/55">{copy}</p>
    </div>
  );
}

/**
 * The anonymous "Me" tab under open-browse — designed find-mode (§1.1). A
 * cookie-less visitor has no greeting / RSVP / QR; instead they get a way IN:
 * scan the QR or open the invite link. Reason-aware so we never tell a guest to
 * "scan your QR" right after she scanned one that didn't match (§1.1 graft).
 * `pastTense` (post-editorial) demotes the join doorway to a claim prompt
 * rather than funnelling a stranger into a finished wedding (§1.1 phase ceiling).
 */
export function FindModeCard({
  slug,
  reason,
  pastTense = false,
  occasion = 'celebration',
}: {
  slug: string;
  reason?: 'wrong_event' | 'invalid_invite' | null;
  pastTense?: boolean;
  /** EventWords.occasion — 'celebration' (default) or the funeral's 'gathering'. */
  occasion?: string;
}) {
  const heading = pastTense
    ? 'Were you a guest?'
    : reason === 'wrong_event'
      ? 'That invite is for a different event'
      : reason === 'invalid_invite'
        ? 'We couldn’t find that invitation'
        : 'Have an invitation?';
  const body = pastTense
    ? `Claim your photos from this ${occasion}.`
    : reason
      ? 'Double-check your link, or open your personal invite again.'
      : 'Open your invite link, or scan your personal QR to see your greeting, seat, and RSVP.';
  const ctaLabel = pastTense ? 'Claim your photos' : 'Open my invitation';

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 px-6 py-8 text-center shadow-sm">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        <ScanLine aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-serif text-lg text-ink">{heading}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">{body}</p>
      <Link
        href={`/${slug}/invite`}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-ink/90"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

/**
 * The anonymous public event_details variant (OPEN-BROWSE PR8 · §5.10). The
 * live `event_details` widget renders the guest's role + side, which are
 * per-guest fields — so it is firewalled from the anonymous tier. This variant
 * shows only EVENT-LEVEL facts (date + venue) so a cookie-less visitor still
 * gets the "when + where" without any guest-derived data. Date/venue may be
 * absent (null-date-safe) — the plate renders only the facts that exist.
 */
export function PublicEventDetails({
  dateLabel,
  venueName,
  venueAddress,
  venues,
  dateIso = null,
  sceneStyle = null,
}: {
  dateLabel: string | null;
  /** `events.event_date` — the date the label is formatted from. Read by the
   *  `big-date` and `card` styles, which write it their own way. */
  dateIso?: string | null;
  /** 🎨 `plate` (this, the default) · `big-date` · `card` — `event-details-styles.tsx`. */
  sceneStyle?: string | null;
  venueName: string | null;
  venueAddress: string | null;
  /** 🏛💒 Ceremony + reception (`lib/event-venues.ts`, already withheld by the
   *  page). When present they REPLACE the single Where row: one row each,
   *  keyed "Ceremony" / "Reception". */
  venues?: readonly EventVenue[];
}) {
  // One list, one row shape: the resolved venues when the page loaded them,
  // else the single venue the event row names (labelled "Where", as before).
  const resolved = (venues ?? []).filter((v) => v.name || v.address);
  const places: EventVenue[] = resolved.length
    ? resolved
    : venueName || venueAddress
      ? [{ role: 'both', name: venueName, address: venueAddress, latitude: null, longitude: null }]
      : [];
  if (!dateLabel && places.length === 0) return null;
  if (sceneStyle === 'big-date') return <DetailsBigDate dateIso={dateIso} dateLabel={dateLabel} places={places} />;
  if (sceneStyle === 'card') return <DetailsCard dateIso={dateIso} dateLabel={dateLabel} places={places} />;
  // Pahina (design 2026-07-25 §7): over a recessed paper-deep plate with the
  // printed inner hairline frame; WHEN / WHERE read as gild mono keys and the
  // venue name is set in the display face. Facts and gating unchanged — still
  // event-level only, no guest-derived data on the anonymous tier.
  // ⚠ owner 2026-09-25 "drop the numbers": no chapter numeral — title only.
  return (
    <section className="space-y-4">
      <p className="pahina-eyebrow">
        <span>The details</span>
      </p>
      <div className="pahina-plate space-y-5">
        {dateLabel ? (
          <div className="flex items-start gap-3">
            <CalendarClock aria-hidden className="mt-1 h-4 w-4 shrink-0 text-gild" strokeWidth={1.5} />
            <div>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">When</p>
              <p className="mt-1 font-pahina text-xl font-light leading-snug text-ink">
                {dateLabel}
              </p>
            </div>
          </div>
        ) : null}
        {places.map((v) => (
          <div key={v.role} className="flex items-start gap-3" data-venue-role={v.role}>
            <MapPin aria-hidden className="mt-1 h-4 w-4 shrink-0 text-gild" strokeWidth={1.5} />
            <div>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
                {places.length > 1 || v.role !== 'both' ? VENUE_ROLE_LABEL[v.role] : 'Where'}
              </p>
              {v.name ? (
                <p className="mt-1 font-pahina text-xl font-light leading-snug text-ink">{v.name}</p>
              ) : null}
              {v.address ? <p className="mt-1 text-sm leading-relaxed text-ink/60">{v.address}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
