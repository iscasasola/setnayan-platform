import { redirect } from "next/navigation";

interface RouteParams {
  params: Promise<{ event_id: string }>;
}

/**
 * Event home auto-jumps into the Guest List tab — the most common landing
 * task per the 0000 spec ("Default landing inside the tab = Guests").
 */
export default async function EventHomeRedirect({ params }: RouteParams) {
  const { event_id } = await params;
  redirect(`/dashboard/${event_id}/guests`);
}
