import { ProgressRing } from '@/app/_components/progress-ring';
import { formatPeso } from '@/lib/checklist-budget-format';

/**
 * OverviewAtAGlance — the "Energy, not skin" DENSITY row on the couple Home
 * cockpit (reskin 2026-07-09). A compact bento that reads the numbers the
 * Overview page ALREADY computed (no new queries, no fetches) and lays them
 * out as a scannable editorial glance-strip under the countdown hero.
 *
 * Four tiles, all in the wine/champagne palette:
 *   1. Days to go   — big serif number (or a "Set your date" prompt).
 *   2. Guests       — ProgressRing of attending ÷ total.
 *   3. Budget       — ProgressRing of committed ÷ target.
 *   4. Vendors      — ProgressRing of locked ÷ lockable categories.
 * A thin stat strip beneath carries the secondary counts (seated · schedule
 * blocks · tasks left) so the host sees the whole shape at a glance.
 *
 * Pure presentation — renderable in a server component (ProgressRing is
 * inline SVG, no client JS). Every prop is derived upstream from data the
 * page loaded; this component invents nothing.
 */
export function OverviewAtAGlance({
  daysOut,
  guestsAttending,
  guestsTotal,
  committedCentavos,
  budgetTargetCentavos,
  vendorsLocked,
  vendorsLockable,
  seatedGuests,
  scheduleBlocks,
  tasksRemaining,
}: {
  /** Days until the event — null when the date isn't at 'day' precision. */
  daysOut: number | null;
  guestsAttending: number;
  guestsTotal: number;
  committedCentavos: number;
  budgetTargetCentavos: number | null;
  vendorsLocked: number;
  vendorsLockable: number;
  seatedGuests: number;
  scheduleBlocks: number;
  tasksRemaining: number;
}) {
  const guestPct = guestsTotal > 0 ? (guestsAttending / guestsTotal) * 100 : 0;
  const budgetPct =
    budgetTargetCentavos && budgetTargetCentavos > 0
      ? (committedCentavos / budgetTargetCentavos) * 100
      : 0;
  const vendorPct =
    vendorsLockable > 0 ? (vendorsLocked / vendorsLockable) * 100 : 0;

  return (
    <section aria-labelledby="overview-glance-heading" className="space-y-3">
      <h2
        id="overview-glance-heading"
        className="m-serif text-lg leading-none text-ink"
      >
        At a glance
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Days to go — the emotional anchor as a number. */}
        <div className="m-card flex flex-col items-center justify-center gap-1 px-3 py-4 text-center">
          {daysOut !== null && daysOut >= 0 ? (
            <>
              <span className="m-serif text-4xl leading-none text-mulberry">
                {daysOut}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-ink/55">
                {daysOut === 0 ? 'Today' : daysOut === 1 ? 'Day to go' : 'Days to go'}
              </span>
            </>
          ) : (
            <>
              <span className="m-serif text-2xl leading-tight text-ink/70">
                Set your
                <br />
                date
              </span>
              <span className="text-[11px] uppercase tracking-wide text-ink/45">
                Countdown
              </span>
            </>
          )}
        </div>

        {/* Guests — attending ÷ total. */}
        <div className="m-card flex flex-col items-center justify-center gap-1.5 px-3 py-4 text-center">
          <ProgressRing pct={guestPct} size={64} stroke={7}>
            <span className="m-serif text-lg leading-none text-ink">
              {guestsAttending}
            </span>
          </ProgressRing>
          <span className="text-[11px] uppercase tracking-wide text-ink/55">
            of {guestsTotal} guests
          </span>
        </div>

        {/* Budget — committed ÷ target. */}
        <div className="m-card flex flex-col items-center justify-center gap-1.5 px-3 py-4 text-center">
          <ProgressRing pct={budgetPct} size={64} stroke={7}>
            <span className="m-serif text-base leading-none text-ink">
              {budgetTargetCentavos && budgetTargetCentavos > 0
                ? `${Math.round(budgetPct)}%`
                : '—'}
            </span>
          </ProgressRing>
          <span className="text-[11px] uppercase tracking-wide text-ink/55">
            {formatPeso(committedCentavos)} committed
          </span>
        </div>

        {/* Vendors — locked ÷ lockable categories. */}
        <div className="m-card flex flex-col items-center justify-center gap-1.5 px-3 py-4 text-center">
          <ProgressRing pct={vendorPct} size={64} stroke={7}>
            <span className="m-serif text-lg leading-none text-ink">
              {vendorsLocked}
            </span>
          </ProgressRing>
          <span className="text-[11px] uppercase tracking-wide text-ink/55">
            of {vendorsLockable} locked
          </span>
        </div>
      </div>

      {/* Secondary counts — a calm mono strip, no new data. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-ink/55">
        <span>
          <span className="font-semibold text-ink/75">{seatedGuests}</span> seated
        </span>
        <span aria-hidden className="text-ink/20">
          ·
        </span>
        <span>
          <span className="font-semibold text-ink/75">{scheduleBlocks}</span>{' '}
          schedule {scheduleBlocks === 1 ? 'block' : 'blocks'}
        </span>
        <span aria-hidden className="text-ink/20">
          ·
        </span>
        <span>
          <span className="font-semibold text-ink/75">{tasksRemaining}</span>{' '}
          {tasksRemaining === 1 ? 'task' : 'tasks'} left
        </span>
      </div>
    </section>
  );
}
