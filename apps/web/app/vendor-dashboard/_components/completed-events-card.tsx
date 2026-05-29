'use client';

/**
 * Completed-events stat card — public vs. private view (iteration 0022 § 2.4a).
 *
 * MUST BE A CLIENT COMPONENT (2026-05-29):
 * This file renders an <input onChange={...}> handler for the "Include
 * team bookings" toggle so the form auto-submits on tick. Server Components
 * cannot pass function props (onChange) across the Server→Client
 * serialization boundary — doing so throws at render time with:
 *
 *   Error: Event handlers cannot be passed to Client Component props.
 *     {type: ..., name: ..., defaultChecked: ..., onChange: function onChange, ...}
 *     digest: '1341067551'
 *
 * That digest matches the persistent /vendor-dashboard crash the owner has
 * been hitting all session. PR #628, PR #631, PR #632, AND PR #633 (DB
 * trigger drop) collectively could not catch this because:
 *   - It happens during JSX streaming serialization, not in any try/catch
 *     in the function body (PR #628 + #632 useless here)
 *   - The segment error.tsx (PR #631) DOES catch it gracefully but renders
 *     the user-facing "Your shop console is temporarily unavailable" UI
 *     instead of the actual dashboard
 *   - It's an app-layer bug, not a DB-layer bug (PR #633 useless here)
 *
 * The CompletedEventsCard only renders when the user has a vendor_profile
 * (gated by `{profile ? <CompletedEventsCard ... /> : null}` in page.tsx).
 * That explains why /vendor-dashboard/team /earnings /marketing all worked
 * for the owner — those routes don't render this component. And why /v/[slug]
 * worked too — same reason.
 *
 * The server action `toggleVendorBackendCount` imported below is still safe
 * to call from a Client Component (Next.js server-action interop). The form's
 * action={toggleVendorBackendCount} continues to work as before.
 *
 * Default render (toggle OFF):
 *   ┌─────────────────────────────┐
 *   │ Completed events            │
 *   │  47   ⓘ Public count        │
 *   │ [ Include team bookings ▢ ] │
 *   └─────────────────────────────┘
 *
 * Toggle ON state:
 *   ┌─────────────────────────────┐
 *   │ Completed events            │
 *   │  51   +4 team / internal    │
 *   │ Public count: 47            │
 *   │ [ Include team bookings ☑ ] │
 *   └─────────────────────────────┘
 *
 * Public count is NEVER toggleable — the platform always serves the
 * team-excluded number to the marketplace.
 */
import { Info, Users } from 'lucide-react';
import { toggleVendorBackendCount } from '../actions';

type Props = {
  publicCount: number;
  fullCount: number;
  showTeamBookings: boolean;
};

export function CompletedEventsCard({ publicCount, fullCount, showTeamBookings }: Props) {
  const delta = Math.max(0, fullCount - publicCount);
  const headlineCount = showTeamBookings ? fullCount : publicCount;

  return (
    <section
      aria-labelledby="completed-events-heading"
      className="rounded-2xl border border-ink/10 bg-cream p-5"
    >
      <h2
        id="completed-events-heading"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
      >
        Completed events
      </h2>

      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className="font-display text-4xl font-semibold tabular-nums text-ink">
          {headlineCount}
        </span>
        {showTeamBookings ? (
          delta > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-xs font-medium text-terracotta-700">
              <Users aria-hidden className="h-3 w-3" strokeWidth={2} />
              +{delta} team / internal
            </span>
          ) : (
            <span className="text-xs text-ink/55">No team / internal bookings yet</span>
          )
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-ink/55">
            <Info aria-hidden className="h-3 w-3" strokeWidth={2} />
            Public count
          </span>
        )}
      </div>

      {showTeamBookings ? (
        <p className="mt-1 text-xs text-ink/65">
          Public count: <span className="font-medium tabular-nums">{publicCount}</span>
        </p>
      ) : null}

      <form
        action={toggleVendorBackendCount}
        className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white/60 px-3 py-2"
      >
        <span className="text-sm text-ink">
          <span className="block font-medium">Include team bookings</span>
          <span className="block text-xs text-ink/55">
            Adds bookings made by your team, internal accounts, and self-comp orders.
            Your public profile is never affected.
          </span>
        </span>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            name="show_team_bookings"
            defaultChecked={showTeamBookings}
            onChange={(e) => {
              // Submit on toggle for an immediate response.
              e.currentTarget.form?.requestSubmit();
            }}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="block h-5 w-9 rounded-full bg-ink/20 transition-colors peer-checked:bg-terracotta peer-focus-visible:ring-2 peer-focus-visible:ring-terracotta/40"
          />
          <span
            aria-hidden
            className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-cream shadow-sm transition-transform peer-checked:translate-x-4"
          />
          <span className="sr-only">
            {showTeamBookings ? 'Hide team bookings' : 'Show team bookings'}
          </span>
        </label>
      </form>
    </section>
  );
}
