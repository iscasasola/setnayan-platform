import Link from 'next/link';
import { CalendarClock, MapPin, ScanLine } from 'lucide-react';

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
export type EmptySectionKind = 'details' | 'story' | 'photos';

const PRESENT_COPY: Record<EmptySectionKind, string> = {
  details: 'The program is being written.',
  story: 'Their story is being written.',
  photos: 'The couple’s photos will appear here.',
};

const PAST_COPY: Record<EmptySectionKind, string> = {
  details: 'No program was published for this celebration.',
  story: 'No story was shared for this celebration.',
  photos: 'No photos were shared for this celebration.',
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
}: {
  kind: EmptySectionKind;
  pastTense?: boolean;
}) {
  const copy = (pastTense ? PAST_COPY : PRESENT_COPY)[kind];
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
}: {
  slug: string;
  reason?: 'wrong_event' | 'invalid_invite' | null;
  pastTense?: boolean;
}) {
  const heading = pastTense
    ? 'Were you a guest?'
    : reason === 'wrong_event'
      ? 'That invite is for a different celebration'
      : reason === 'invalid_invite'
        ? 'We couldn’t find that invitation'
        : 'Have an invitation?';
  const body = pastTense
    ? 'Claim your photos from this celebration.'
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
}: {
  dateLabel: string | null;
  venueName: string | null;
  venueAddress: string | null;
}) {
  if (!dateLabel && !venueName && !venueAddress) return null;
  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream/50 px-6 py-6">
      {dateLabel ? (
        <div className="flex items-start gap-3">
          <CalendarClock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink/50">When</p>
            <p className="text-ink">{dateLabel}</p>
          </div>
        </div>
      ) : null}
      {venueName || venueAddress ? (
        <div className="flex items-start gap-3">
          <MapPin aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink/50">Where</p>
            {venueName ? <p className="text-ink">{venueName}</p> : null}
            {venueAddress ? <p className="text-sm text-ink/60">{venueAddress}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
