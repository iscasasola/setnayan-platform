import Link from "next/link";
import { redirect } from "next/navigation";
import { listCoupleEventsForUser } from "@/lib/db/events";
import { createClient } from "@/lib/supabase/server";
import { NoEventState } from "./_components/no-event-state";

export const dynamic = "force-dynamic";

export default async function DashboardPickerPage() {
  const events = await listCoupleEventsForUser({ includeArchived: true });

  // 0 events → welcome / "Create your first event" empty state.
  if (events.length === 0) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return <NoEventState userEmail={user?.email ?? ""} />;
  }

  const active = events.filter((e) => !e.archived);
  const archived = events.filter((e) => e.archived);

  // 1 active event → auto-jump (per spec).
  if (active.length === 1) {
    redirect(`/dashboard/${active[0]!.event_id}/guests`);
  }

  return (
    <div className="px-4 py-10 lg:px-8 lg:py-14">
      <div className="mx-auto max-w-2xl">
        <p className="meta-label mb-2">Dashboard</p>
        <h1 className="display-title">Which event are you working on?</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Pick the wedding you want to plan. You can switch any time from the
          event pill in the top bar.
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {active.map((e) => {
            const dateLabel = new Date(`${e.event_date}T00:00:00`).toLocaleDateString(
              "en-US",
              { month: "long", day: "numeric", year: "numeric" },
            );
            return (
              <li key={e.event_id}>
                <Link
                  href={`/dashboard/${e.event_id}/guests`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-rule-strong bg-surface px-5 py-4 transition hover:border-ink"
                >
                  <div>
                    <p className="text-[15px] font-medium text-ink">
                      {e.is_primary && <span aria-hidden className="mr-1">⭐</span>}
                      {e.bride_first_name} &amp; {e.groom_first_name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-soft">
                      {dateLabel}
                      {e.guest_count_estimate
                        ? ` · ${e.guest_count_estimate} guests`
                        : ""}
                    </p>
                  </div>
                  <span aria-hidden className="text-ink-faint">→</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/dashboard/new"
          className="btn-default mt-4 inline-flex w-full justify-center text-[13px]"
        >
          + Create another event
        </Link>

        {archived.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-[12px] text-ink-soft hover:text-ink">
              ▸ Archived events ({archived.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-2">
              {archived.map((e) => (
                <li key={e.event_id}>
                  <Link
                    href={`/dashboard/${e.event_id}/guests`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-rule bg-surface px-4 py-3 opacity-60 hover:opacity-100"
                  >
                    <span className="text-[13px] text-ink">
                      {e.bride_first_name} &amp; {e.groom_first_name}
                    </span>
                    <span className="text-[11px] text-ink-faint">{e.event_date}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
