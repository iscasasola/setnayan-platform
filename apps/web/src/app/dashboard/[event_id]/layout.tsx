import { notFound } from "next/navigation";
import { getEventByIdForUser, listCoupleEventsForUser } from "@/lib/db/events";
import { eventCoupleNames, daysUntil } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { EventTopBar } from "./_components/event-top-bar";
import { EventBottomNav } from "./_components/event-bottom-nav";

interface RouteParams {
  params: Promise<{ event_id: string }>;
}

export default async function EventScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: RouteParams["params"];
}) {
  const { event_id } = await params;
  const event = await getEventByIdForUser(event_id);
  if (!event) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userInitials = ((user?.email ?? "U").split("@")[0] ?? "U")
    .slice(0, 2)
    .toUpperCase();

  // Quick-switcher candidates — non-archived couple-events the user belongs
  // to. Always includes the current event so the dropdown works even if
  // it's the only one.
  const allEvents = await listCoupleEventsForUser({ includeArchived: false });
  const switcherEvents = allEvents.length > 1 ? allEvents : [];

  const coupleNames = eventCoupleNames(event);
  const days = daysUntil(event.event_date);
  const dateLabel = new Date(`${event.event_date}T00:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );

  return (
    <div className="min-h-screen bg-page-bg">
      <EventTopBar
        eventId={event.event_id}
        coupleNames={coupleNames}
        eventMeta={`${dateLabel} · ${days} days`}
        userInitials={userInitials}
        switcherEvents={switcherEvents}
      />
      <main className="pb-24 lg:pb-0">{children}</main>
      <EventBottomNav eventId={event.event_id} />
    </div>
  );
}
