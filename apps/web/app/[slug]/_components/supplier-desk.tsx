import Link from 'next/link';
import { ArrowUpRight, MapPin, Users } from 'lucide-react';

import { formatBlockTimeRange } from '@/lib/schedule';
import { PRIVATE_LINE_NOTE } from '@/lib/supplier-desk-rule';
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
 * THE SUPPLIER'S DESK, ON THE CELEBRATION'S OWN PAGE.
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────
 * The same strip, on the day it matters. `vendor-doorway.tsx` has always been
 * *"A DOOR, NOT A ROOM"* — one line and a link out. From the day this
 * celebration begins until six the morning after it ends, that door opens in
 * place and the supplier's own day is on it: where they are going, what is
 * running now, how many people are coming, and the tools that live elsewhere.
 *
 * 🔒 ONE LINE OF THE DOOR'S REASONING SURVIVES INTACT, and it is what keeps this
 * from becoming a second dashboard: *"a supplier works many weddings; their
 * week, their invoices and their other clients do not belong inside one
 * couple's page."* Nothing here is about any other booking, and there is no
 * money on it. THIS day's facts, and a way back to everything else.
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
 * page with no desk and no trace that one exists.
 */
export function SupplierDesk({
  desk,
  words,
}: {
  desk: SupplierDeskModel;
  words: ClientEventWords;
}) {
  const hasProgramme = desk.blocks.length > 0;
  const privateLines = desk.blocks.filter((b) => b.is_public === false).length;

  return (
    <aside
      className="mx-auto mt-6 w-full max-w-3xl px-4"
      aria-label="Your supplier desk for this event"
    >
      <div className="border-t-[3px] border-terracotta bg-paper-deep">
        <div className="space-y-5 p-5 sm:p-6">
          <header className="space-y-1.5">
            <ConsoleEyebrow>Your desk today</ConsoleEyebrow>
            <ConsoleHeading as="h2">{desk.businessName}</ConsoleHeading>
            {desk.bookedCategories.length > 0 ? (
              <p className="text-sm text-ink/70">
                Booked here for {desk.bookedCategories.join(' · ').replace(/_/g, ' ')}.
              </p>
            ) : null}
          </header>

          {/* WHERE. The venue and its address are the two facts withheld until a
              supplier has agreed — so on the day they are the first thing. */}
          {desk.venueName || desk.venueAddress ? (
            <ConsolePlate className="space-y-1">
              <div className="flex items-center gap-2">
                <MapPin aria-hidden className="h-4 w-4 text-gild" strokeWidth={1.75} />
                <ConsoleHeading as="h3">Where</ConsoleHeading>
              </div>
              {desk.venueName ? (
                <p className="text-sm font-semibold text-ink">{desk.venueName}</p>
              ) : null}
              {desk.venueAddress ? (
                <p className="text-sm leading-relaxed text-ink/75">{desk.venueAddress}</p>
              ) : null}
            </ConsolePlate>
          ) : null}

          {/* NOW / NEXT — the shared header, live. Renders nothing of its own
              when there is no programme, which is why the plate below says so
              in words rather than leaving a gap. */}
          {hasProgramme ? (
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
            ) : (
              <p className="text-sm leading-relaxed text-ink/70">
                {words.TheOrganizer} {words.solemn ? 'has not set out' : 'hasn’t written'} the day’s
                timeline yet. The moment they do it appears here — the same one the floor runs on.
              </p>
            )}
          </ConsolePlate>

          {/* HEADCOUNT — live from the RSVPs, the same figure the console shows. */}
          <ConsolePlate className="space-y-2">
            <div className="flex items-center gap-2">
              <Users aria-hidden className="h-4 w-4 text-gild" strokeWidth={1.75} />
              <ConsoleHeading as="h3">Headcount</ConsoleHeading>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-ink">
                {desk.attending} / {desk.invited}
              </span>
              <span className="text-sm text-ink/70">coming, of everyone invited</span>
            </div>
          </ConsolePlate>

          {/* THE TOOLS. The console is the primary way in — it is where every
              tool that has no address of its own is rendered. The tiles below
              are only the ones that genuinely live somewhere else, so nothing
              here can be a door that opens onto the wrong room. */}
          <div className="space-y-2">
            <ConsoleEyebrow>Your tools</ConsoleEyebrow>
            <Link
              href="/vendor-dashboard/on-the-day"
              className="sn-press group relative flex items-center justify-between gap-3 border border-ink/10 bg-paper p-4 transition-colors hover:border-gild/40"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-1.5 border border-ink/[0.08]"
              />
              <span className="relative min-w-0">
                <span className="block font-pahina text-base font-light leading-snug tracking-tight text-ink">
                  Open your day-of console
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink/70">
                  The floor tools you switched on for this booking.
                </span>
              </span>
              <ArrowUpRight
                aria-hidden
                className="relative h-5 w-5 shrink-0 text-ink/45 transition-colors group-hover:text-gild"
                strokeWidth={1.75}
              />
            </Link>
            {desk.tools.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {desk.tools.map((t) => (
                  <Link
                    key={t.id}
                    href={t.href}
                    className="sn-press group relative flex items-center justify-between gap-3 border border-ink/10 bg-paper p-4 transition-colors hover:border-gild/40"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-1.5 border border-ink/[0.08]"
                    />
                    <span className="relative min-w-0">
                      <span className="block font-pahina text-base font-light leading-snug tracking-tight text-ink">
                        {t.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink/70">
                        {t.blurb}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className="relative h-5 w-5 shrink-0 text-ink/45 transition-colors group-hover:text-gild"
                      strokeWidth={1.75}
                    />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {/* THE WAY OUT. Never a trap: one link back to everything that is not
              this day — the booking, the money, the other clients. */}
          <p className="text-xs leading-relaxed text-ink/70">
            <Link
              href={`/vendor-dashboard/clients/${desk.vendorEventId}`}
              className="font-semibold text-link underline underline-offset-2"
            >
              {desk.businessName}
            </Link>{' '}
            — the booking itself, and everything about it that is not today.
          </p>
        </div>
      </div>
    </aside>
  );
}
