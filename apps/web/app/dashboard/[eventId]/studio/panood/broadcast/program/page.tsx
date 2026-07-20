import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { eventSkuActive } from '@/lib/entitlements';
import { requirePanoodControlRoomMember } from '@/lib/panood-control-room-access';
import { PanoodProgramSurface } from './program-surface';

export const metadata = {
  title: 'Program output · Setnayan',
  // A capture surface, never a page anyone should reach from search.
  robots: { index: false, follow: false },
};

// Live Studio — the chrome-less PROGRAM OUTPUT pop-out (PR #4 of the
// 2026-07-08 repackaging plan; Live_Studio_Repackaging_2026-07-08 § 10).
//
// This is the surface OBS window-captures so the couple can push their
// composited program to their OWN YouTube (or Facebook — RTMPS is RTMPS; note
// Facebook auto-deletes live replays after 30 days, Meta policy 2026-02-19).
// OBS is only the output pipe: every production decision — switching, overlays,
// split cam, moments — happens in OUR control room, which composites
// client-side. This window just shows the result, with no chrome to composite
// into the couple's stream.
//
// It carries the SAME gates as the control room it mirrors (auth → control-room
// membership → paid PANOOD_SYSTEM). It must not be a softer door to the same
// video: a program feed is exactly as sensitive as the console that produces it.
//
// It holds no connection of its own — see lib/panood-program-bridge for why a
// second WebRTC viewer would steal the operator's cameras.

const PANOOD_SKU_CODE = 'PANOOD_SYSTEM';

type Props = { params: Promise<{ eventId: string }> };

export default async function PanoodProgramOutputPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const isMember = await requirePanoodControlRoomMember(eventId, user.id);
  if (!isMember) redirect(`/dashboard/${eventId}`);

  // Same paid gate as the control room. Degrades to false on a pre-bootstrap DB.
  let owned = false;
  try {
    owned = await eventSkuActive(supabase, eventId, PANOOD_SKU_CODE);
  } catch {
    owned = false;
  }
  if (!owned) redirect(`/dashboard/${eventId}/studio/panood/broadcast`);

  return <PanoodProgramSurface />;
}
