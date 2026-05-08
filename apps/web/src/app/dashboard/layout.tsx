import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEvent } from "@/lib/db/events";
import { eventCoupleNames, daysUntil } from "@/lib/db/types";
import { DashboardTopNav } from "./_components/top-nav";
import { MobileTabBar } from "./_components/mobile-tab-bar";
import { NoEventState } from "./_components/no-event-state";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const event = await getCurrentEvent();
  if (!event) {
    return <NoEventState userEmail={user.email ?? ""} />;
  }

  const coupleNames = eventCoupleNames(event);
  const days = daysUntil(event.event_date);
  const dateLabel = new Date(event.event_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );
  const userInitials = ((user.email ?? "U").split("@")[0] ?? "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-page-bg">
      <DashboardTopNav
        coupleNames={coupleNames}
        eventMeta={`${dateLabel} · ${days} days`}
        userInitials={userInitials}
      />
      <main className="pb-24 lg:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
