import { redirect } from "next/navigation";
import { getCurrentEvent } from "@/lib/db/events";
import { getGuestsForEvent } from "@/lib/db/guests";
import { GuestsPage } from "./_components/guests-page";

export const dynamic = "force-dynamic";

export default async function GuestsRoute() {
  const event = await getCurrentEvent();
  if (!event) redirect("/dashboard");

  const { guests, households, tables } = await getGuestsForEvent(event.event_id);

  return (
    <GuestsPage
      event={event}
      initialGuests={guests}
      households={households}
      tables={tables}
    />
  );
}
