import { notFound } from "next/navigation";
import { getEventByIdForUser } from "@/lib/db/events";
import { getGuestsForEvent } from "@/lib/db/guests";
import { GuestsPage } from "./_components/guests-page";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ event_id: string }>;
}

export default async function GuestsRoute({ params }: RouteParams) {
  const { event_id } = await params;
  const event = await getEventByIdForUser(event_id);
  if (!event) notFound();

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
