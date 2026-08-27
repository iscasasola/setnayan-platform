import Link from 'next/link';
import { ArrowUpRight, MapPin, MessageSquare, Users } from 'lucide-react';

import { formatBlockTimeRange } from '@/lib/schedule';
import { SUPPLIER_DESK_ANCHOR } from './supplier-ribbon';
import { PRIVATE_LINE_NOTE, type SupplierDeskStage } from '@/lib/supplier-desk-rule';
import {
  ConsoleEyebrow,
  ConsoleHeading,
  ConsolePlate,
  ConsoleRule,
} from '@/app/vendor-dashboard/on-the-day/_components/pahina-console';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import type { SupplierDeskModel } from '../_lib/supplier-desk.server';
import type { ClientEventWords } from './event-words-provider';

/**
 * THE SUPPLIER'S DESK, ON THE CELEBRATION'S OWN PAGE — for the whole life of
 * the booking.
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────
 * The same strip, in whichever state the calendar says. `vendor-doorway.tsx`
 * has always been *"A DOOR, NOT A ROOM"* — one line and a link out. That door
 * now opens in place, and what is behind it depends on where the booking is in
 * its life: the call sheet before, the live desk on the day, the week of
 * looking back after, and one quiet line long after that.
 *
 * ── WHY IT IS FOUR STATES AND NOT ONE DAY ───────────────────────────────────
 * S3 (2026-08-27) opened it on the day and shut it at 06:00 the morning after —
 * about thirty hours of a booking's life. The binding design
 * (`Vendor_Room_Design_2026-08-26.md` § G) argues against exactly that, and it
 * is the strongest sentence in it: *"a day-only room recreates exactly the
 * midnight-door mistake this product has already paid once to learn."* The
 * venue's address and the call time are communicated in the WEEKS BEFORE;
 * confirming a shot landed happens the morning AFTER.
 *
 * 🔒 THE SHAPE NEVER CHANGES — same pieces, in the same order, learned once
 * (design § F). A piece that cannot be true yet SAYS SO. Nothing silently
 * isn't there, because a room that loses panels as the calendar moves reads as
 * broken rather than as early.
 *
 * 🔒 ONE LINE OF THE DOOR'S REASONING SURVIVES INTACT, and it is what keeps this
 * from becoming a second dashboard: *"a supplier works many weddings; their
 * week, their invoices and their other clients do not belong inside one
 * couple's page."* Nothing here is about any other booking, and there is no
 * money on it. THIS celebration's facts, and a way back to everything else.
 *
 * ── PORTED, NOT REDRAWN ─────────────────────────────────────────────────────
 * The materials are the console's own (`pahina-console.tsx`) and the running
 * order is the SHARED `RunOfShowHeader` the console, the organiser's schedule
 * and the day-of guest card all already render — realtime subscription
 * included, so advancing on the floor lights up here within about half a second.
 * `canAdvance` is left false: only the coordinator runs the programme, and a
 * control shown wider than it is permitted is how a supplier came to press
 * "Start next" and watch nothing happen.
 *
 * ⚠ THAT LIVE HEADER RENDERS ON THE DAY AND ON NO OTHER DAY. It answers "what
 * is happening NOW", and the schedule stores the venue's WALL CLOCK rather than
 * an instant — so pointed at a celebration three months out it would count down
 * to a time on the wrong day. Before the day the same slot carries the
 * countdown instead, which is what the design asks for there anyway.
 *
 * ⚠ IMPORTING THE CONSOLE'S MATERIALS IS SAFE, AND THE REASON IS THE REASON
 * THEY EXIST. They are composed from `:root` palette tokens rather than the
 * `.sn-editorial .pahina-*` descendant recipes, precisely so they carry no
 * scope. Inside the guest tree they therefore resolve to the same look without
 * double-matching anything, and nothing here can affect a dashboard.
 *
 * ── WHAT THE ORGANISER'S GUESTS NEVER SEE ───────────────────────────────────
 * 🔒 This renders ONLY from a `SupplierDeskModel`, which exists only after
 * `resolveVendorCapability` proved a committed booking for a signed-in account
 * AND the brief confirmed it a second time under that account's own session. An
 * anonymous visitor, a guest and a supplier who was only ASKED all render the
 * page with no desk and no trace that one exists. Widening the window moved the
 * DATE gate and nothing else; the capability gate is untouched.
 */

/**
 * One tool tile. Factored out for two reasons, and the second is the load-bearing
 * one:
 *
 *   1. The console tile and the per-tool tiles were the same twenty lines twice.
 *   2. 🔑 A COMPUTED `href` IS INVISIBLE TO `lint-port-no-lost-controls`. Its
 *      extractor matches `href` followed by a literal, so folding the day's
 *      console link and the call sheet's setup link into one ternary made the
 *      whole `/{slug}` route read as having LOST `/vendor-dashboard/on-the-day`
 *      — a false alarm that could only be silenced by recording a removal that
 *      had not happened. With a tile component each call site writes its own
 *      literal, and the guard can see both.
 */
function ToolTile({ href, title, blurb }: { href: string; title: string; blurb: string }) {
  return (
    <Link
      href={href}
      className="sn-press group relative flex items-center justify-between gap-3 border border-ink/10 bg-paper p-4 transition-colors hover:border-gild/40"
    >
      <span aria-hidden className="pointer-events-none absolute inset-1.5 border border-ink/[0.08]" />
      <span className="relative min-w-0">
        <span className="block font-pahina text-base font-light leading-snug tracking-tight text-ink">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink/70">{blurb}</span>
      </span>
      <ArrowUpRight
        aria-hidden
        className="relative h-5 w-5 shrink-0 text-ink/45 transition-colors group-hover:text-gild"
        strokeWidth={1.75}
      />
    </Link>
  );
}

/** The one word at the top that tells a supplier where in the booking they are. */
const EYEBROW: Record<SupplierDeskStage, string> = {
  call_sheet: 'Your call sheet',
  today: 'Your desk today',
  look_back: 'Look back',
  archive: 'Your work here',
};

const ARIA: Record<SupplierDeskStage, string> = {
  call_sheet: 'Your call sheet for this event',
  today: 'Your supplier desk for this event',
  look_back: 'Looking back on this event',
  archive: 'Your work on this event',
};

export function SupplierDesk({
  desk,
  words,
}: {
  desk: SupplierDeskModel;
  words: ClientEventWords;
}) {
  const hasProgramme = desk.blocks.length > 0;
  const privateLines = desk.blocks.filter((b) => b.is_public === false).length;
  const isToday = desk.stage === 'today';
  const isPast = desk.stage === 'look_back' || desk.stage === 'archive';
  // Did anybody actually run the programme on the floor? Looking back at a
  // schedule nobody advanced and calling it "how the day ran" would be a
  // sentence the data does not support.
  const ranLines = desk.blocks.filter((b) => b.run_state === 'done').length;

  return (
    <aside
      id={SUPPLIER_DESK_ANCHOR}
      className="mx-auto mt-6 w-full max-w-3xl px-4"
      aria-label={ARIA[desk.stage]}
    >
      <div className="border-t-[3px] border-terracotta bg-paper-deep">
        <div className="space-y-5 p-5 sm:p-6">
          <header className="space-y-1.5">
            <ConsoleEyebrow>{EYEBROW[desk.stage]}</ConsoleEyebrow>
            <ConsoleHeading as="h2">{desk.businessName}</ConsoleHeading>
            {desk.bookedCategories.length > 0 ? (
              <p className="text-sm text-ink/70">
                Booked here for {desk.bookedCategories.join(' · ').replace(/_/g, ' ')}.
              </p>
            ) : null}
            {/* THE DATE, AND HOW FAR OFF IT IS. Not on the day itself — a desk
                that says "today" and then names today's date twice is noise.
                Everywhere else it is the single most useful fact on the strip:
                a supplier looking in March is deciding when to order stock. */}
            {!isToday && desk.eventDateLabel ? (
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink/60">
                {desk.eventDateLabel}
                {desk.countdown ? ` · ${desk.countdown}` : null}
              </p>
            ) : null}
          </header>

          {/* WHERE. The venue and its address are the two facts withheld until a
              supplier has agreed — so once they have, they are the first thing,
              on every day of the booking and not only on the last one. The
              plate stays even when the organiser has not set a venue yet:
              a piece that silently isn't there reads as a broken room. */}
          <ConsolePlate className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin aria-hidden className="h-4 w-4 text-gild" strokeWidth={1.75} />
              <ConsoleHeading as="h3">Where</ConsoleHeading>
            </div>
            {desk.venueName || desk.venueAddress ? (
              <>
                {desk.venueName ? (
                  <p className="text-sm font-semibold text-ink">{desk.venueName}</p>
                ) : null}
                {desk.venueAddress ? (
                  <p className="text-sm leading-relaxed text-ink/75">{desk.venueAddress}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm leading-relaxed text-ink/70">
                {words.TheOrganizer} {words.solemn ? 'has not named' : 'hasn’t set'} the place yet.
                It appears here the moment they do.
              </p>
            )}
          </ConsolePlate>

          {/* NOW / NEXT — the shared header, live, and ONLY on the day. Renders
              nothing of its own when there is no programme, which is why the
              plate below says so in words rather than leaving a gap. */}
          {isToday && hasProgramme ? (
            <RunOfShowHeader eventId={desk.vendorEventId} initial={desk.blocks} />
          ) : null}

          {/* THE WHOLE RUNNING ORDER, private lines included and MARKED.
              Owner ruling 2026-08-27: the private cues do show here — the same
              notes, in a new place. He turned down "schedule only". The read
              policy behind these rows has no public/private filter of its own,
              so this marking is the only thing telling a supplier which lines
              the guests were never given. */}
          <ConsolePlate className="space-y-3">
            <ConsoleHeading as="h3">The running order</ConsoleHeading>
            {hasProgramme ? (
              <>
                <ol className="space-y-2">
                  {desk.blocks.map((b) => (
                    <li key={b.block_id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs text-ink/60">
                        {formatBlockTimeRange(b.start_at, b.end_at) || 'Time TBD'}
                      </span>
                      <span className="text-sm font-medium text-ink">{b.label}</span>
                      {b.location ? (
                        <span className="text-xs text-ink/60">· {b.location}</span>
                      ) : null}
                      {/* Looking back, the only honest extra fact is which
                          lines the floor actually advanced. Nothing is claimed
                          about the rest — an unadvanced line may well have
                          happened with nobody pressing anything. */}
                      {isPast && b.run_state === 'done' ? (
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink/50">
                          ✓ ran
                        </span>
                      ) : null}
                      {/* mulberry-600, NOT the gold slot. In this repo the slot
                          NAMED `terracotta` is the atelier gold, which fails the
                          4.5:1 floor on its own tints; mulberry-600 measures
                          4.92:1 light and 5.78:1 dark, so the marker carries in
                          both themes. And `text-xs` (12px), not the 0.66rem the
                          console eyebrows use: this is a WARNING somebody has to
                          read at arm's length on a venue floor, and 12px is this
                          project's own legibility floor. */}
                      {b.is_public === false ? (
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-mulberry-600">
                          {PRIVATE_LINE_NOTE}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {isPast ? (
                  <>
                    <ConsoleRule />
                    <p className="text-xs leading-relaxed text-ink/70">
                      {ranLines > 0
                        ? 'Marked lines are the ones the floor advanced on the day. The rest are the times as they were planned.'
                        : 'Nobody advanced the running order on the floor, so these are the times as they were planned.'}
                    </p>
                  </>
                ) : null}
                {privateLines > 0 ? (
                  <>
                    <ConsoleRule />
                    <p className="text-xs leading-relaxed text-ink/70">
                      {privateLines === 1 ? 'One line above is' : `${privateLines} lines above are`}{' '}
                      not on the programme the guests were given. They are here so you can work to
                      them — not to be announced.
                    </p>
                  </>
                ) : null}
              </>
            ) : isPast ? (
              <p className="text-sm leading-relaxed text-ink/70">
                {words.TheOrganizer} never wrote a timeline for the day.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-ink/70">
                {words.TheOrganizer} {words.solemn ? 'has not set out' : 'hasn’t written'} the day’s
                timeline yet. The moment they do it appears here — the same one the floor runs on.
              </p>
            )}
          </ConsolePlate>

          {/* HEADCOUNT — live from the RSVPs, the same figure the console shows.
              Before the day it is explicitly NOT SETTLED: replies are still
              arriving, and a caterer who reads a half-finished number as final
              orders the wrong amount of food. */}
          <ConsolePlate className="space-y-2">
            <div className="flex items-center gap-2">
              <Users aria-hidden className="h-4 w-4 text-gild" strokeWidth={1.75} />
              <ConsoleHeading as="h3">Headcount</ConsoleHeading>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-ink">
                {desk.attending} / {desk.invited}
              </span>
              <span className="text-sm text-ink/70">
                {isToday
                  ? 'coming, of everyone invited'
                  : isPast
                    ? 'had said they were coming, of everyone invited'
                    : 'have said yes so far, of everyone invited'}
              </span>
            </div>
            {desk.stage === 'call_sheet' ? (
              <p className="text-xs leading-relaxed text-ink/70">
                Not settled yet — replies are still coming in.
              </p>
            ) : null}
          </ConsolePlate>

          {/* THE TOOLS. The console is the primary way in — it is where every
              tool that has no address of its own is rendered. The tiles below
              are only the ones that genuinely live somewhere else, so nothing
              here can be a door that opens onto the wrong room.

              🔑 A DAY-ONLY PIECE SAYS SO RATHER THAN VANISHING (design § F).
              Before the day the console link goes to that booking's own setup
              view — choosing the tools is exactly the work to do in advance —
              and afterwards there is no floor to open, so the section says that
              in a sentence instead of quietly losing a tile. */}
          <div className="space-y-2">
            <ConsoleEyebrow>Your tools</ConsoleEyebrow>
            {isPast ? (
              <p className="text-sm leading-relaxed text-ink/70">
                The floor desk closed at six the morning after. Everything below still opens.
              </p>
            ) : isToday ? (
              <ToolTile
                href="/vendor-dashboard/on-the-day"
                title="Open your day-of console"
                blurb="The floor tools you switched on for this booking."
              />
            ) : (
              <ToolTile
                href={`/vendor-dashboard/on-the-day?event=${desk.vendorEventId}`}
                title="Set up your console for this day"
                blurb="Choose the tools you’ll use. The floor desk itself opens on the day."
              />
            )}
            {desk.tools.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {desk.tools.map((t) => (
                  <ToolTile key={t.id} href={t.href} title={t.label} blurb={t.blurb} />
                ))}
              </div>
            ) : null}
          </div>

          {/* BEFORE THE DAY, THE ONE ACTION THAT MAKES SENSE. Posting a status
              and flagging an issue are things a person does standing up on a
              floor; weeks out, the thing to do is ask. ⛔ It opens the
              conversation that ALREADY EXISTS — the design refuses a chat of its
              own here, because a third channel splits one conversation across
              three places. */}
          {desk.stage === 'call_sheet' && desk.threadId ? (
            <Link
              href={`/vendor-dashboard/messages/${desk.threadId}`}
              className="sn-press group relative flex items-center gap-3 border border-ink/10 bg-paper p-4 transition-colors hover:border-gild/40"
            >
              <MessageSquare aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block font-pahina text-base font-light leading-snug tracking-tight text-ink">
                  Message {words.theOrganizer}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink/70">
                  The conversation you already have about this booking.
                </span>
              </span>
              <ArrowUpRight
                aria-hidden
                className="h-5 w-5 shrink-0 text-ink/45 transition-colors group-hover:text-gild"
                strokeWidth={1.75}
              />
            </Link>
          ) : null}

          {/* THE WAY OUT. Never a trap: one link back to everything that is not
              this day — the booking, the money, the other clients. */}
          <p className="text-xs leading-relaxed text-ink/70">
            <Link
              href={`/vendor-dashboard/clients/${desk.vendorEventId}`}
              className="font-semibold text-link underline underline-offset-2"
            >
              {desk.businessName}
            </Link>{' '}
            — the booking itself, and everything about it that is not
            {isToday ? ' today' : ' this day'}.
          </p>
        </div>
      </div>
    </aside>
  );
}
