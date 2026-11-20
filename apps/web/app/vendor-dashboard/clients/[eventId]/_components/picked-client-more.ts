/**
 * ⋯ THE PICKED CLIENT'S MORE ROWS — pure, so the guard can run the rule itself
 * (`the-more-menu-holds-places-to-go.test.ts`). Drawn by the ONE picked shell (`app/_components/picked/picked-shell.tsx`).
 */
import type { ReactNode } from 'react';
import { CalendarPlus, ListMusic, ScrollText, Users } from 'lucide-react';
import type { PickedMoreRow } from '@/app/_components/picked/picked-shell';
import { TOPIC_ICON } from '@/lib/topic-icons';
import type { PickedClientPage } from './picked-client-menu';

/**
 * ⋯ WHAT SITS BEHIND THE HEAD'S MORE (Unichat part G, owner 20 Nov 2026 — *"build it now, I am happy with the design"*;
 * drawing UNICHAT-LIVE-2026-11-19: "⋯ holds places to go"). In the drawn order:
 *
 *   For your trade — **Song list** (a music act) or **Script** (an emcee / host), ONLY when the shop's service has the
 *     page: the page hands the body in when it holds that desk (`holdsSpecialization`), and no body means no row —
 *     never a greyed one (drawing: "The greyed Script row. Trade pages show only when the shop's service has them.").
 *   **Files · Event Hub** — the pages with no box in the strip (Hub once booked). Not Details: the client's name in the
 *     head opens it, and the drawing has no second way in.
 *   **Crew for 18 Dec** — the shipped Hub › Crew for this event (booked only), named with the event's day when it has one.
 *   **Add to my calendar** — the shipped `calendar.ics`, only once the day has a timed moment (the file is a 404 before).
 *   **Report a problem** — LAST. Owner 20 Nov: the approved design moves it into ⋯, superseding 9 Nov "last row of (+)".
 *
 * ⛔ Not here, on purpose: Book & Budget · Schedule · Forms · Decisions (the strip's four boxes open them) and anything
 * the (+) sends. ⛔ No "Mute this chat": no mute is stored anywhere yet (a per-person, per-chat fact — a data change).
 */
export type ClientMoreFacts = {
  /** 🎵 The Song list page — handed in only for a shop that holds the Song Desk on a booked event. */
  songs?: ReactNode;
  /** 🎤 The Script page — handed in only for a shop that holds the emcee's Script desk. */
  script?: ReactNode;
  /** Hub › Crew for this event, or null before booking. */
  crewHref?: string | null;
  /** The event's day as the drawing words it ("18 Dec", `dayMonth`) — the Crew row's tail; null = no date yet. */
  crewDay?: string | null;
  /** The event's timeline file, or null while it has no timed moment. */
  calendar?: { href: string; filename: string } | null;
};

export function clientMoreRows({ songs, script, crewHref, crewDay, calendar }: ClientMoreFacts): PickedMoreRow<PickedClientPage>[] {
  const rows: PickedMoreRow<PickedClientPage>[] = [];
  if (songs) rows.push({ id: 'songs', label: 'Song list', icon: ListMusic, heading: 'For your trade', body: songs });
  if (script) rows.push({ id: 'script', label: 'Script', icon: ScrollText, heading: songs ? undefined : 'For your trade', body: script });
  rows.push('files', { id: 'hub', label: 'Event Hub', icon: TOPIC_ICON.hub, page: 'hub' });
  if (crewHref) rows.push({ id: 'crew', label: crewDay ? `Crew for ${crewDay}` : 'Crew', icon: Users, href: crewHref });
  if (calendar) rows.push({ id: 'calendar', label: 'Add to my calendar', icon: CalendarPlus, file: calendar });
  rows.push({ id: 'report', label: 'Report a problem', icon: TOPIC_ICON.report, page: 'report' });
  return rows;
}
