import Link from "next/link";
import { getCurrentEvent } from "@/lib/db/events";
import { daysUntil, eventCoupleNames } from "@/lib/db/types";

export default async function DashboardOverviewPage() {
  const event = await getCurrentEvent();
  if (!event) return null; // layout already renders the no-event state

  const days = daysUntil(event.event_date);
  const couple = eventCoupleNames(event);
  const dateLabel = new Date(event.event_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  );

  return (
    <div className="px-6 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="meta-label mb-2">Dashboard / Overview</p>
          <h1 className="display-title">Hello, {event.bride_first_name} &amp; {event.groom_first_name}</h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-rule bg-surface p-6 shadow-tayo-sm">
            <p className="meta-label mb-2">Wedding</p>
            <p className="font-serif text-3xl text-ink">{couple}</p>
            <p className="mt-1 text-sm text-ink-soft">{dateLabel}</p>
            <p className="mt-3 font-mono text-xs text-ink-faint tracking-label-mid">
              {days} DAYS REMAINING
            </p>
          </div>
          <div className="rounded-2xl border border-rule bg-surface p-6 shadow-tayo-sm">
            <p className="meta-label mb-2">Guest list</p>
            <p className="font-serif text-3xl text-ink">Manage</p>
            <p className="mt-1 text-sm text-ink-soft">
              Track invites, RSVPs, sponsors, plus-ones, and household pairings.
            </p>
            <Link
              href="/dashboard/guests"
              className="btn-accent mt-4 inline-flex"
            >
              Open guests →
            </Link>
          </div>
          <div className="rounded-2xl border border-rule bg-surface p-6 shadow-tayo-sm">
            <p className="meta-label mb-2">Coming soon</p>
            <p className="font-serif text-3xl text-ink">Landing &amp; gallery</p>
            <p className="mt-1 text-sm text-ink-soft">
              Couple landing page, schedule, suppliers, gallery — each is its
              own work order. Sprint 1 ships the guest list first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
