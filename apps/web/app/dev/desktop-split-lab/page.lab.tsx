/**
 * /dev/desktop-split-lab — 🖥 the DESKTOP SPLIT VIEW + ONE EDITOR PER PART (owner 2026-11-21, DECISION_LOG "DESKTOP
 * SPLIT VIEW + ONE EDITOR PER PART — APPROVED TO BUILD"; drawing `prototypes/desktop_split_view_2026-11-21/
 * desktop_split_view_v2_fable.html`), drawn from the REAL pieces on fixtures (no sign-in, no database). DEV-ONLY:
 * production 404s it (first statement).
 *
 *   ?frame=1    the booked coordinator: the chat left, the hosts' dashboard right (`CoordinatorPane`)
 *   ?frame=2    a supplier: the chat left, the "Their event" list right (`TheirEventColumn`)
 *   ?frame=2b   the same, after a tap on Guests — the part in the column with a back arrow
 *   ?frame=3    "Ria is editing Guests." — read-only (the real bar)
 *   ?frame=3b   5 s after she stops — "Guests is free."
 *   ?frame=4    a host took over — the kept change, Put it back grey
 *   ?frame=5    Put it back — the draft on top of the host's latest, a pick per item
 *
 * The chat is the lab's embedded thread (`LabPickedChat`, the real `ChatBox` + stream on fixture messages). On a phone
 * (< 701) the right column is not drawn — as shipped, the list sits above the chat and a part opens full screen.
 */
import { notFound } from 'next/navigation';
import { SupplierLabShell } from '@/app/dev/_components/supplier-lab-shell';
import { SupplierColumns } from '@/app/vendor-dashboard/_components/supplier-columns';
import { LabPickedChat } from '@/app/dev/_components/lab-picked-chat';
import { LAB_THREADS } from '@/app/dev/chat-lab/fixtures';
import { CoordinatorPane, TheirEventColumn } from '@/app/vendor-dashboard/clients/[eventId]/_components/their-event-pane';
import { TheirEventList } from '@/app/vendor-dashboard/clients/[eventId]/_components/their-event-list';
import { TheirEventPartBody } from '@/app/vendor-dashboard/clients/[eventId]/_components/their-event-part-body';
import { COLUMN_PARTS, coordinatorDashboardRows, theirEventColumnHref, theirEventRows } from '@/lib/their-event';
import { COORDINATOR_AREAS } from '@/lib/delegate-areas';
import { LabPartEdit } from './lab-part-edit';

const EVENT = 'lab-claire';
const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="8">C&amp;I</text></svg>')}`;
const GROUP = {
  status: 'ok' as const,
  label: 'Catering, per head',
  booked: 150,
  counted: null,
  guests: [
    { name: 'Ana Reyes', rsvp: 'attending', diet: 'Table 4 · no pork' },
    { name: 'Ben Tan', rsvp: 'attending', diet: 'Table 4' },
    { name: 'Carla Lim', rsvp: null, diet: 'Table 7 · vegetarian' },
    { name: 'Dino Santos', rsvp: 'attending', diet: 'Table 2' },
  ],
};
const PAX = { invited: 186, attending: 68, maybe: 12, pending: 106, declined: 0 };

/** The lab chat's stand-in send — it writes nothing. */
async function labChatSend(formData: FormData): Promise<void> {
  'use server';
  void formData;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}

type Frame = '1' | '2' | '2b' | '3' | '3b' | '4' | '5';
const FRAMES: readonly Frame[] = ['1', '2', '2b', '3', '3b', '4', '5'];

export default async function DesktopSplitLab({ searchParams }: { searchParams: Promise<{ frame?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { frame: raw } = await searchParams;
  const frame: Frame = (FRAMES as readonly string[]).includes(raw ?? '') ? (raw as Frame) : '1';

  const chat = <LabPickedChat threadId={LAB_THREADS[0].id} side="vendor" counterpartyLabel="Claire & Indalecio" actions={{ send: labChatSend }} />;
  const rows = theirEventRows({ eventId: EVENT, category: 'catering', grants: {}, logoHref: LOGO, tables: 19, group: { label: GROUP.label, count: 150 } });

  let pane: React.ReactNode;
  if (frame === '1') {
    pane = (
      <CoordinatorPane
        eventName="Claire & Indalecio"
        dateLine="Sat, Dec 12, 2026"
        placeLine="Seda Vertis North · 186 guests"
        rows={coordinatorDashboardRows({
          eventId: EVENT,
          grants: COORDINATOR_AREAS,
          pax: PAX,
          tables: 19,
          moments: 12,
          href: {
            guests: '/dev/desktop-split-lab?frame=3',
            seats: '/dev/desktop-split-lab?frame=1',
            march: '/dev/desktop-split-lab?frame=1',
            schedule: '/dev/desktop-split-lab?frame=1',
            hub: '/dev/desktop-split-lab?frame=1',
            details: '/dev/desktop-split-lab?frame=1',
            suppliers: '/dev/desktop-split-lab?frame=1',
            moodBoard: '/dev/desktop-split-lab?frame=1',
            budget: '/dev/desktop-split-lab?frame=1',
          },
        })}
      />
    );
  } else if (frame === '2' || frame === '2b') {
    pane = (
      <TheirEventColumn
        eventId={EVENT}
        rows={rows}
        listHref="/dev/desktop-split-lab?frame=2"
        partHref={(part) => (part === 'guests' ? '/dev/desktop-split-lab?frame=2b' : COLUMN_PARTS.includes(part) ? theirEventColumnHref(EVENT, part) : null)}
        open={
          frame === '2b'
            ? {
                part: 'guests',
                title: `Guests · ${GROUP.label}`,
                body: <TheirEventPartBody eventId={EVENT} part="guests" open brief={{ pax: PAX, timeline: [] }} group={GROUP} hubSlug={null} />,
              }
            : null
        }
      />
    );
  } else {
    pane = <LabPartEdit frame={frame} />;
  }

  return (
    <SupplierLabShell measure="own" page="/vendor-dashboard/clients">
      <div data-desktop-split-lab={frame}>
        {/* 📱 The phone keeps the list above the chat (as shipped) — the pane is never drawn below 701. */}
        {/* 📱 Frames 3–5 on a phone: the part is the full screen (as approved), with the same bar. */}
        {frame !== '1' && frame !== '2' && frame !== '2b' ? <div className="tab:hidden">{pane}</div> : null}
        {frame === '2' ? (
          <div className="px-4 pt-3 tab:hidden">
            <TheirEventList eventId={EVENT} rows={rows} />
          </div>
        ) : null}
        <div className={`tab:[&_.sn-cols-pane]:h-auto${frame === '1' || frame === '2' || frame === '2b' ? '' : ' hidden tab:block'}`} data-chat-split="">
          <SupplierColumns name="client-chat" list={chat} pane={pane} paneLabel="Their event · Claire & Indalecio" />
        </div>
      </div>
    </SupplierLabShell>
  );
}
