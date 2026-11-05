/**
 * /dev/schedule-lab — the Schedule's Event Day rail on fixture moments, with no
 * sign-in and no database (Schedule rebuild, 2026-09-28). DEV-ONLY: production
 * builds 404 this route, the same kill-switch as `/dev/booth-lab`. NODE_ENV is
 * inlined at build time, so the guard is free and the lab chunk never ships.
 *
 *   (default)                      the Event Day rail (`schedule-lab-mount.tsx` → `schedule-lab-client.tsx`)
 *   ?view=preparation[&filter=todo] ✅ PLANNING STAGE — the one lead-up list since the owner merged the Checklist into
 *                                   it (2026-11-01): the REAL `PreparationAgendaView` on `lab-planning.ts` (the real
 *                                   wedding template, dated, folded, with two hand-added rows). A tick or a date save
 *                                   here reaches the real action and is REFUSED (no sign-in) — the row says so.
 *   ?view=playlist                 the REAL playlist moment sections on fixture picks (`lab-playlist.tsx`) — the pick
 *                                   row's swipe-to-delete (owner 2026-11-03).
 *
 * Why it exists: the rail is drag, drop, sheets and a bottom panel — layout that
 * no unit test lays out (a green suite once shipped a Save button below the
 * fold). This page lets a session, or the owner on a phone pointed at a dev
 * server, drive the REAL `ScheduleDay` at 375px and on a desktop before a PR,
 * against the prototype's own nine moments, three supplier requests and roles.
 */

import { notFound } from 'next/navigation';
import { PreparationAgendaView } from '@/app/dashboard/[eventId]/schedule/_components/preparation-agenda';
import ScheduleLabMount from './schedule-lab-mount';
import { LAB_PLAN_DATE, labPlanningList } from './lab-planning';
import { LabPlaylist } from './lab-playlist';

export default async function ScheduleLabPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  if (q.view === 'playlist') return <LabPlaylist />;
  if (q.view !== 'preparation') return <ScheduleLabMount />;
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-cream px-4 pb-24 pt-3 sm:px-6" data-lab="planning-stage">
      <PreparationAgendaView
        eventId="lab"
        agenda={labPlanningList()}
        hasEventDate
        line
        eventDateIso={LAB_PLAN_DATE}
        initialFilter={q.filter === 'todo' ? 'todo' : 'all'}
      />
    </main>
  );
}
