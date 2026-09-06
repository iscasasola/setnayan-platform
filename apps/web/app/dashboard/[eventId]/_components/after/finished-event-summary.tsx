import Link from 'next/link';
import { ArrowRight, Users, Compass, Sparkles, Newspaper, Images } from 'lucide-react';
import type { AfterSummary } from '@/lib/after-summary';

/**
 * finished-event-summary.tsx — what the Overview says once the day is over.
 *
 * Owner, 2026-08-21, on a Movie Night that had already happened: *"why can i
 * still plan and build and create guest list as if it hasn't ended. what we
 * want is to show the summary of the overview, guest, marketplace, suite, and
 * the editorial maker."*
 *
 * ─── THIS IS THE DAY-OF TAKEOVER'S TWIN, ON PURPOSE ──────────────────────
 * The shape is not new. On the day itself the planning stack already RECEDES
 * behind "Planning tools — still here if you need them" while a grid of what
 * matters right now leads the page (`day-of-mode/grid.tsx`, council verdict
 * Phase 6). After the day the same move is right for a different reason, so
 * it is the same move: five summary cards lead, the planning stack is one
 * click away, and nothing is deleted.
 *
 * 🔒 RECEDED, NOT REMOVED. A host still adding the cousin who turned up
 * unannounced, or still settling a supplier's balance, must not find the
 * guest list gone because the app decided the party was over. Every planning
 * route stays live and every rail row stays where it was; two rows JOIN them
 * (Editorial · Galleries — see `customer-nav-config.ts`).
 *
 * ─── A NUMBER WE COULD NOT READ IS NOT ZERO ──────────────────────────────
 * Each figure is `number | null` and `null` means NOT MEASURED. A card whose
 * count is null shows its words and its door and NO figure — printing "0
 * guests" because a read was refused is how a summary quietly lies. See
 * `lib/after-summary.ts`.
 *
 * ⚠ ZERO ITSELF IS HONEST AND IS SHOWN. Prod is pre-launch: this very event
 * has 0 guests and 0 suppliers, and that is the plan, not a defect. The card
 * says so in words a person can act on rather than hiding.
 */

type Props = {
  eventId: string;
  /** "wedding" | "event" — from `eventNoun`, so a Movie Night is never told
   *  its wedding is wrapped. */
  noun: 'wedding' | 'event';
  /** Already formatted for the venue's own clock by the caller. Null when the
   *  event has no date (which cannot reach this component today, but a card
   *  that assumes a date and gets none renders "Invalid Date"). */
  dateLabel: string | null;
  /** The event's public address, when it has one. */
  slug: string | null;
  summary: AfterSummary;
};

/** A figure, or nothing at all when it was never measured. */
function Figure({ value, unit }: { value: number | null; unit: string }) {
  if (value === null) return null;
  return (
    <span className="block text-[15px] font-semibold text-ink">
      {value} {value === 1 ? unit : `${unit}s`}
    </span>
  );
}

function Card({
  href,
  Icon,
  title,
  children,
  cta,
}: {
  href: string;
  Icon: typeof Users;
  title: string;
  children: React.ReactNode;
  cta: string;
}) {
  return (
    <Link href={href} className="sn-tile sn-press group flex flex-col gap-2 text-left">
      <span className="flex items-center gap-2">
        <Icon aria-hidden className="h-4 w-4 flex-none text-terracotta" strokeWidth={1.75} />
        <span className="text-[13px] font-semibold uppercase tracking-wide text-ink/55">
          {title}
        </span>
      </span>
      <span className="min-w-0">{children}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[13px] font-medium text-mulberry">
        {cta}
        <ArrowRight
          aria-hidden
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </span>
    </Link>
  );
}

export function FinishedEventSummary({ eventId, noun, dateLabel, slug, summary }: Props) {
  const base = `/dashboard/${eventId}`;

  const editorialLine =
    summary.editorial === 'published'
      ? 'Your story is published on your page.'
      : summary.editorial === 'draft'
        ? 'You have a draft going. Finish it and publish.'
        : 'Not written yet. Words, photos, and a front page — this is the last thing left to do.';

  return (
    <section
      aria-label={`Your ${noun}, looking back`}
      className="space-y-4 rounded-2xl border border-terracotta/20 bg-terracotta/[0.03] p-4 sm:p-5"
    >
      {/* ONE LINE (page-header lock, owner 2026-07-19). The date carries the
          fact that it has happened; no eyebrow, no sub-heading. */}
      <h2 className="text-[17px] font-semibold text-ink">
        {dateLabel ? `That's a wrap — ${dateLabel}` : "That's a wrap"}
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card href={base} Icon={Sparkles} title="Overview" cta="Open your page">
          <Figure value={summary.photos} unit="photo" />
          <span className="mt-0.5 block text-[12.5px] text-ink/55">
            {slug
              ? `Your ${noun} lives at /${slug} — it keeps working, and the story goes on it.`
              : `Everything from your ${noun} stays here.`}
          </span>
        </Card>

        <Card href={`${base}/guests`} Icon={Users} title="Guests" cta="Open the guest list">
          <Figure value={summary.guests} unit="guest" />
          <span className="mt-0.5 block text-[12.5px] text-ink/55">
            {summary.guests === 0
              ? 'Nobody was added to this one.'
              : summary.checkedIn !== null && summary.checkedIn > 0
                ? `${summary.checkedIn} checked in on the day.`
                : summary.guestsAttending !== null
                  ? `${summary.guestsAttending} said they were coming.`
                  : 'Who you invited, and who came.'}
          </span>
        </Card>

        <Card
          // With suppliers, land on "Your team" (the shipped ?tab=build deep
          // link) — the names who worked the day, each with its review chip.
          // With none, the plain bench is the honest destination.
          href={summary.suppliers === 0 ? `${base}/vendors` : `${base}/vendors?tab=build`}
          Icon={Compass}
          title="Your Team"
          cta={summary.suppliers === 0 ? 'Open the marketplace' : 'Open your suppliers'}
        >
          <Figure value={summary.suppliers} unit="supplier" />
          {/* ⚠ NO "N STILL NEED A REVIEW" NUMBER, ON PURPOSE.
              The first cut subtracted reviews-written from suppliers-on-the-list
              and called the remainder "still waiting on a word from you" — two
              inventions in one line. The list included every name the couple had
              only shortlisted, and a review is not even OPEN until the supplier
              marks the job done or a month has passed (`reviewState`, the gate
              the review page and RLS both enforce). A prompt to do something the
              product would then refuse is worse than no prompt.

              One place decides whose window is open, and this card points at it.

              ⚠ CORRECTED 2026-08-23. This paragraph used to state that the
              supplier list "already shows Leave a review beside exactly the ones
              whose window is open". It did not. That chip lived only on
              `plan-budget-accordion.tsx`, which renders solely when
              BUDGET_BUILD_ENABLED=false — the kill switch, never thrown in
              production. So this card sent the couple to a list of plain rows
              with nothing to press. The chip now ships on "Your team"
              (`build-locked.tsx`), which is the surface that actually renders,
              and this link lands on it. A sentence is not a mechanism. */}
          <span className="mt-0.5 block text-[12.5px] text-ink/55">
            {summary.suppliers === 0
              ? 'You booked nobody through Setnayan for this one.'
              : 'Everyone who worked your day — leave each of them a review.'}
          </span>
        </Card>

        <Card href={`${base}/suite`} Icon={Sparkles} title="Suite" cta="Open the Suite">
          <Figure value={summary.services} unit="service" />
          <span className="mt-0.5 block text-[12.5px] text-ink/55">
            What you had switched on for this one.
          </span>
        </Card>

        <Card href={`${base}/galleries`} Icon={Images} title="Galleries" cta="Open the photos">
          <Figure value={summary.photos} unit="photo" />
          <span className="mt-0.5 block text-[12.5px] text-ink/55">
            {summary.photos === 0
              ? 'No photos came in.'
              : 'Everything your cameras and your guests shot.'}
          </span>
        </Card>

        {/* THE EDITORIAL MAKER — the owner asked how to reach it, and until now
            the answer on a laptop was "through the Suite, through the website
            card, through a chip". It is the one thing here that is WORK still
            waiting, so it is the one card that carries the accent. */}
        <Link
          href={`${base}/website/editorial`}
          className="sn-tile sn-press group flex flex-col gap-2 border-mulberry/30 bg-mulberry/[0.05] text-left"
        >
          <span className="flex items-center gap-2">
            <Newspaper aria-hidden className="h-4 w-4 flex-none text-mulberry" strokeWidth={1.75} />
            <span className="text-[13px] font-semibold uppercase tracking-wide text-mulberry">
              Editorial maker
            </span>
          </span>
          <span className="block text-[15px] font-semibold text-ink">
            {summary.editorial === 'published'
              ? 'Your story is live'
              : summary.editorial === 'draft'
                ? 'Finish your story'
                : 'Write your story'}
          </span>
          <span className="block text-[12.5px] text-ink/60">{editorialLine}</span>
          <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[13px] font-semibold text-mulberry">
            Open the editorial maker
            <ArrowRight
              aria-hidden
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </span>
        </Link>
      </div>
    </section>
  );
}
