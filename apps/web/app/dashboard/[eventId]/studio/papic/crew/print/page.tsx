import { redirect } from 'next/navigation';

// Papic · printable photo-crew QR cards — ⛔ RETIRED (owner 2026-10-23).
//
// This printed one card per seat ("Camera 1", "Seat 3"), each its own camera — the per-seat model the
// 2026-09-16 ruling retired (*"we do not have papic seat. we only have papic with credits and shared
// amongst everybody"*). The one thing a couple prints now is the shared code's poster, so a bookmark or an
// old link to this page lands there. The poster page does its own couple check.

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export default async function PapicCrewPrintPage({ params }: Props) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/studio/papic/crew/poster`);
}
