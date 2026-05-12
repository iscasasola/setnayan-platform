import { redirect } from 'next/navigation';

// Inside-event home — auto-redirect to the Guest List tab's default sub-page.
export default async function EventHomePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/guests`);
}
