import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Slim outer layout: auth gate only. The event-scoped chrome (top bar +
 * 4-tab bottom nav) lives in [event_id]/layout.tsx so the picker and
 * profile pages render without an event header.
 */
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

  return <div className="min-h-screen bg-page-bg">{children}</div>;
}
