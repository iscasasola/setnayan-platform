import { createAdminClient } from '@/lib/supabase/admin';
import { fetchReligionReadiness, type ReligionReadinessRow } from '@/lib/religion-readiness';
import { SubmitButton } from '@/app/_components/submit-button';
import { setWeddingTypeStatus, setWeddingTypeThreshold } from './actions';

export const metadata = { title: 'Wedding types · Admin' };

/**
 * Per-religion launch gate (iteration 0043). Shows each wedding religion's
 * live vendor + ceremonial-venue readiness (counted from
 * `compatible_ceremony_types`) against its threshold, and lets an admin open
 * it (active) / hold it (coming-soon) / disable it. Flipping the status greys
 * the religion in BOTH the onboarding faith picker and the create-event
 * wedding-type picker. Owner: "open a religion when its vendors are enough to
 * cater it."
 */
export default async function WeddingTypesPage() {
  const admin = createAdminClient();
  const rows = await fetchReligionReadiness(admin);

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Wedding types — launch gate
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          Open a religion when its vendors can cater it. Readiness counts
          published vendors and ceremonial venues that have tagged themselves
          compatible with that religion (officiant · ceremony · food are the
          religion-specific roles). Flipping a religion to <em>Coming soon</em>{' '}
          greys it in the onboarding faith picker and the create-event picker;
          couples can&apos;t pick it until you re-open it.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/55">
          No launch-status rows found. Ensure the iteration-0043 seed has been
          applied.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <ReligionCard key={`${row.ceremonyType}-${row.region}`} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReligionCard({ row }: { row: ReligionReadinessRow }) {
  const statusTone =
    row.status === 'active'
      ? 'bg-success-100 text-success-800'
      : row.status === 'coming_soon'
        ? 'bg-warn-100 text-warn-900'
        : 'bg-ink/10 text-ink/60';
  const statusLabel =
    row.status === 'active'
      ? 'Live'
      : row.status === 'coming_soon'
        ? 'Coming soon'
        : 'Disabled';

  return (
    <li className="rounded-xl border border-ink/10 bg-cream p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-ink">{row.label}</h2>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${statusTone}`}
            >
              {statusLabel}
            </span>
            {row.ready ? (
              <span className="rounded-full bg-success-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-700 ring-1 ring-inset ring-success-200">
                Ready
              </span>
            ) : (
              <span className="rounded-full bg-ink/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                Building supply
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {row.total} / {row.threshold} compatible &middot; {row.vendorCount} vendors &middot;{' '}
            {row.venueCount} ceremonial venues
          </p>
        </div>

        {/* Status flips — show the two the admin isn't already on. */}
        <div className="flex flex-wrap items-center gap-2">
          {row.status !== 'active' ? (
            <StatusButton
              ceremonyType={row.ceremonyType}
              region={row.region}
              status="active"
              className="bg-success-700 text-cream hover:bg-success-800"
            >
              Open (go live)
            </StatusButton>
          ) : null}
          {row.status !== 'coming_soon' ? (
            <StatusButton
              ceremonyType={row.ceremonyType}
              region={row.region}
              status="coming_soon"
              className="border border-ink/15 bg-cream text-ink hover:border-terracotta/40 hover:text-terracotta"
            >
              Hold (coming soon)
            </StatusButton>
          ) : null}
          {row.status !== 'disabled' ? (
            <StatusButton
              ceremonyType={row.ceremonyType}
              region={row.region}
              status="disabled"
              className="border border-ink/15 bg-cream text-ink/60 hover:border-danger-300 hover:text-danger-700"
            >
              Disable
            </StatusButton>
          ) : null}
        </div>
      </div>

      {/* Readiness threshold editor. */}
      <form
        action={setWeddingTypeThreshold}
        className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3"
      >
        <input type="hidden" name="ceremony_type" value={row.ceremonyType} />
        <input type="hidden" name="region" value={row.region} />
        <label
          htmlFor={`threshold-${row.ceremonyType}`}
          className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
        >
          Ready at
        </label>
        <input
          id={`threshold-${row.ceremonyType}`}
          name="threshold"
          type="number"
          min={0}
          max={100000}
          defaultValue={row.threshold}
          className="h-8 w-20 rounded-md border border-ink/15 bg-cream px-2 text-sm text-ink"
        />
        <span className="text-xs text-ink/50">compatible vendors + venues</span>
        <SubmitButton
          className="inline-flex items-center rounded-md bg-ink/80 px-3 py-1 text-xs font-medium text-cream hover:bg-ink disabled:opacity-70"
          pendingLabel="Saving…"
        >
          Save threshold
        </SubmitButton>
      </form>
    </li>
  );
}

function StatusButton({
  ceremonyType,
  region,
  status,
  className,
  children,
}: {
  ceremonyType: string;
  region: string;
  status: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <form action={setWeddingTypeStatus}>
      <input type="hidden" name="ceremony_type" value={ceremonyType} />
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton
        className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-70 ${className}`}
        pendingLabel="Saving…"
      >
        {children}
      </SubmitButton>
    </form>
  );
}
