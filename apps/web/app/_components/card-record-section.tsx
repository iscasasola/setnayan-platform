/**
 * THE CARD RECORD — the compiled-history section a service card grows.
 *
 * Owner-locked 2026-07-28 (DECISION_LOG row 2819): "every event this card
 * creates is documented on the card". Rendered at the BOTTOM of a service card,
 * on two surfaces:
 *   • `variant="couple"` — the public /v/[slug] card. Proof, read by a stranger.
 *   • `variant="vendor"` — the vendor's own services manager. The payoff for
 *     taking care of the card: the same record plus the medal case and the
 *     distance to the next medal.
 *
 * A DUMB VIEW, deliberately. Every number, label, month and band arrives
 * pre-formatted from `compileCardRecord()` (lib/service-card-record.ts), which
 * is where all the rules and all the tests live. This file imports TYPES ONLY,
 * so mounting it inside the `'use client'` services gallery pulls no data-layer
 * code into the browser.
 *
 * PRIVACY: there is nothing to redact here. The reader behind this section
 * (`public.service_card_records`, migration 20271018283550) never emits a name,
 * a user or event id, an exact date, a venue, a price or an exact head-count —
 * the ledger is (event type · month-year · coarse pax band) and nothing else,
 * capped at six PAST events. The anonymisation is a property of the SQL, not of
 * this component, which is why a future edit here cannot leak anything.
 *
 * ⚠ THE COUNT-ONLY SHAPE IS NORMAL, NOT A BUG. Below the SQL minimum-N floor a
 * card returns its booked count with an EMPTY mix and an EMPTY ledger, because
 * at one or two events those "aggregates" would BE a single private event's
 * record — rendered on the same page as a reviews section that names the
 * couple. This component therefore renders each block only when its collection
 * is non-empty, and the bar + medals stand alone perfectly well. Do NOT add a
 * placeholder, an "only N events" hint, or any other tell: the whole value of
 * the floor is that a suppressed card looks the same as a quiet one. Pre-launch
 * this is the COMMON path — every card in prod today sits below the floor.
 *
 * The rating badge is VENDOR-level, not per-card: reviews attach to
 * `vendor_reviews.vendor_profile_id` and carry no service dimension, so every
 * card of a shop shows the same stars. It reads
 * `vendor_trusted_review_stats` — the only source the anti-fraud lock permits
 * for a public rating number — and the label says "shop rating" so the card
 * never implies the stars were earned by this card alone.
 */

import { Trophy, Medal, Star, Camera } from 'lucide-react';
import {
  cardRecordHasSomethingToSay,
  cardRecordHasSomethingToSayToTheShop,
  type CompiledCardRecord,
} from '@/lib/service-card-record';

/** Vendor-level trusted rating, when the shop has one. */
export type CardRecordRating = {
  /** Trusted average, 1–5. */
  avg: number;
  /** Trusted review count. */
  count: number;
};

/**
 * Gold ramp for the event-type mix bar, darkest first. Written as literal class
 * strings so Tailwind's scanner sees them; slices past the ramp reuse the
 * faintest step, which is correct — a long tail should read as one quiet band.
 */
const MIX_SHADES = [
  'bg-terracotta',
  'bg-terracotta/70',
  'bg-terracotta/45',
  'bg-terracotta/25',
  'bg-terracotta/15',
] as const;

export function CardRecordSection({
  record,
  variant,
  rating = null,
}: {
  record: CompiledCardRecord;
  variant: 'couple' | 'vendor';
  rating?: CardRecordRating | null;
}) {
  // A card with no history shows NOTHING new. Enforced here as well as at every
  // mount site, so the section can never render an empty frame — through the
  // ONE shared predicate rather than a fourth hand-written copy of the same
  // comparison (see cardRecordHasSomethingToSay for what the copies were about
  // to get wrong).
  // On the SHOP's own card the documented-celebrations count is enough on its
  // own — that is where the owner's nudge to record everything has to be
  // visible, including before the card's first booking. On a couple's card it
  // rides along instead of opening the section, the same restraint the shop
  // rating already shows: a card that has done nothing itself should not grow a
  // "record" out of a fact about its shop.
  const open =
    variant === 'vendor'
      ? cardRecordHasSomethingToSayToTheShop(record)
      : cardRecordHasSomethingToSay(record);
  if (!open) return null;

  const {
    bookedCount,
    mix,
    ledger,
    milestones,
    optionSampleN,
    optionPicks,
    documentedEvents,
  } = record;
  const topMedal = milestones.earned.length
    ? milestones.earned[milestones.earned.length - 1]!
    : null;
  const showRating = rating !== null && rating.count > 0 && rating.avg > 0;

  return (
    <section className="mt-auto border-t border-ink/10 pt-3">
      <h4 className="sr-only">Card record</h4>

      {/* ── The booked bar — the headline claim ──────────────────────────────
          Rendered only when the count is REAL. `bookedCount` cannot see a
          booking made through this card's own package (those rows carry no
          service_id), so a card can have picks to show and a zero here — and
          "Booked 0× on Setnayan" printed beside "4 of the last 6 couples chose"
          is the product contradicting itself. Show less, never something
          untrue. */}
      {bookedCount > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="inline-flex items-center gap-1.5 text-[12px] text-ink/70">
          <Trophy className="h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={2} aria-hidden />
          <span>
            Booked <span className="font-mono font-medium text-ink">{bookedCount}×</span> on
            Setnayan
          </span>
        </p>

        {topMedal !== null ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700"
            title={`Milestone reached: ${topMedal} events`}
          >
            <Medal className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            <span className="font-mono">{topMedal}</span>
          </span>
        ) : null}
      </div>
      ) : null}

      {/* ── Shop rating — vendor-level, and labelled as such ───────────────── */}
      {showRating ? (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink/55">
          <Star className="h-3 w-3 shrink-0 fill-warn-400 text-warn-500" strokeWidth={1.5} aria-hidden />
          <span className="font-mono text-ink/80">{rating.avg.toFixed(1)}</span>
          <span>
            · {rating.count} review{rating.count === 1 ? '' : 's'} · shop rating
          </span>
        </p>
      ) : null}

      {/* ── The event-type mix ──────────────────────────────────────────────
          Absent below the SQL minimum-N floor (see the header note). Silence is
          the design — no placeholder, no explanation. */}
      {mix.length > 0 ? (
        <div className="mt-2">
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink/5"
            aria-hidden
          >
            {mix.map((slice, i) => (
              <span
                key={slice.eventType}
                className={`block h-full ${MIX_SHADES[Math.min(i, MIX_SHADES.length - 1)]}`}
                style={{ width: `${slice.pct}%` }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink/55">
            {mix.map((slice, i) => (
              <span key={slice.eventType}>
                {i > 0 ? ' · ' : ''}
                <span className="font-mono text-ink/75">{slice.n}</span> {slice.label}
                {slice.n === 1 ? '' : 's'}
              </span>
            ))}
          </p>
        </div>
      ) : null}

      {/* ── The ledger — anonymized, six at most, and only from months that
             are already history. Absent below the minimum-N floor, and absent
             for a card whose booked work is all still ahead of it. */}
      {ledger.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {ledger.map((row, i) => (
            <li
              key={`${row.label}-${row.month ?? 'no-month'}-${i}`}
              className="flex items-center justify-between gap-3 rounded-md bg-ink/[0.03] px-2.5 py-1 text-[11px]"
            >
              <span className="truncate text-ink/70">{row.label}</span>
              <span className="flex shrink-0 items-center gap-2 text-ink/45">
                {row.pax ? <span>{row.pax}</span> : null}
                {row.month ? (
                  <span className="font-mono uppercase tracking-[0.12em]">{row.month}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Celebrations documented ──────────────────────────────────────────
          Owner ruling 2026-08-24: *"we only count events that they had photos
          with … no photo, no proof the event took place."* The unit is the
          CELEBRATION, never the photo.

          Labelled "this shop" because captures are keyed on the vendor profile,
          not on this card — the same reason the rating beside it says "shop
          rating". Unlike the picks below there is no floor: this is the shop's
          own work, so one reads as one, and the number is meant to move from
          the first celebration. */}
      {documentedEvents > 0 ? (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink/55">
          <Camera className="h-3 w-3 shrink-0 text-terracotta" strokeWidth={2} aria-hidden />
          <span className="font-mono text-ink/80">{documentedEvents}</span>
          <span>
            celebration{documentedEvents === 1 ? '' : 's'} documented · this shop
          </span>
        </p>
      ) : null}

      {/* ── What couples picked ─────────────────────────────────────────────
          The sample and every line have ALREADY cleared the minimum-N floor in
          SQL — a line that reaches this component is one at least three couples
          chose, out of at least three bookings. There is nothing to suppress
          here and nothing to compute; adding a "not enough data yet" note would
          undo the floor's whole purpose, which is that a suppressed card looks
          exactly like a quiet one.

          The pair is the point — "4 of the last 6" — so there is no percentage
          and no bar. A percentage of six reads as a statistic about a market
          instead of a fact about six couples. */}
      {optionPicks.length > 0 && optionSampleN > 0 ? (
        <div className="mt-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/45">
            What couples add
          </p>
          <ul className="mt-1 space-y-1">
            {optionPicks.map((pick) => (
              <li
                key={pick.label}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <span className="truncate text-ink/70">{pick.label}</span>
                <span className="shrink-0 text-ink/45">
                  <span className="font-mono text-ink/75">{pick.n}</span> of the last{' '}
                  <span className="font-mono text-ink/75">{optionSampleN}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Vendor-only: the medal case + the distance to the next one ─────── */}
      {variant === 'vendor' ? (
        <div className="mt-2.5 space-y-1.5">
          {milestones.earned.length > 0 ? (
            <ul className="flex flex-wrap gap-1" aria-label="Milestones reached">
              {milestones.earned.map((t) => (
                <li
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700"
                >
                  <Medal className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="font-mono">{t}</span> events
                </li>
              ))}
            </ul>
          ) : null}

          {milestones.next !== null ? (
            <p className="text-[11px] text-ink/50">
              <span className="font-mono text-ink/70">{milestones.next - bookedCount}</span> more
              to reach the <span className="font-mono">{milestones.next}</span>-event medal.
            </p>
          ) : (
            <p className="text-[11px] text-ink/50">Every milestone reached.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
