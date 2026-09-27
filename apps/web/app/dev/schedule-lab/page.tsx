'use client';

/**
 * /dev/schedule-lab — the Schedule's Event Day rail on fixture moments, with no
 * sign-in and no database (Schedule rebuild, 2026-09-28). DEV-ONLY: production
 * builds 404 this route, the same kill-switch as `/dev/booth-lab`. NODE_ENV is
 * inlined at build time, so the guard is free and the lab chunk never ships.
 *
 * Why it exists: the rail is drag, drop, sheets and a bottom panel — layout that
 * no unit test lays out (a green suite once shipped a Save button below the
 * fold). This page lets a session, or the owner on a phone pointed at a dev
 * server, drive the REAL `ScheduleDay` at 375px and on a desktop before a PR,
 * against the prototype's own nine moments, three supplier requests and roles.
 */

import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';

const ScheduleLabClient = dynamic(() => import('./schedule-lab-client'), { ssr: false });

export default function ScheduleLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ScheduleLabClient />;
}
