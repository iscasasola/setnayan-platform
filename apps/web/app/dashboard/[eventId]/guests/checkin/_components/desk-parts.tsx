'use client';

/**
 * 🛂 ONE DESK, THREE PARTS (owner 16 Nov 2026, "Yes, as drawn"; prototype § "Check-in desk (three parts)").
 *
 * "Desk · Guests ▾" is ONE `PickMenu` (the house rule: a set of choices is one dropdown) listing only the parts this
 * person may open. Every part stays MOUNTED and the others are `hidden` — so switching is instant, the Guests desk keeps
 * its scanner, its typed search and its offline queue, and a live refresh of the page (LiveRefresher) updates the
 * Suppliers and Team parts in place without moving the picker. Nothing navigates.
 *
 * ⚙ opens "Who runs the desk" — hosts only. Each pick saves in the background and the panel shows what the server
 * stored, never what was tapped: a refused save puts the row back and says why.
 */
import { useState, useTransition, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SidePanel } from '@/app/_components/side-panel';
import { ActionButton } from '@/components/action-button';
import {
  DESK_PARTS,
  DESK_PART_LABEL,
  isDeskPart,
  partsWords,
  serializeDeskAccess,
  type DeskAccess,
  type DeskPart,
} from '@/lib/checkin-desk';
import { saveDeskAccess } from '../actions';

export type DoorCandidate = { userId: string; name: string };

export function DeskParts({
  eventId,
  parts,
  isHost,
  access: initialAccess,
  doorCandidates,
  guests,
  suppliers,
  team,
}: {
  eventId: string;
  /** The parts this person may open, in the drawing's order. Never empty (the page shows "not shared" instead). */
  parts: readonly DeskPart[];
  isHost: boolean;
  access: DeskAccess;
  doorCandidates: readonly DoorCandidate[];
  guests: ReactNode;
  suppliers: ReactNode;
  team: ReactNode;
}) {
  const [part, setPart] = useState<DeskPart>(parts[0] ?? 'guests');
  const [open, setOpen] = useState(false);
  const shown = parts.includes(part) ? part : (parts[0] ?? 'guests');
  const body: Record<DeskPart, ReactNode> = { guests, suppliers, team };

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2" data-desk-head>
        {parts.length > 1 ? (
          <PickMenu
            label="Desk part"
            value={shown}
            buttonText={`Desk · ${DESK_PART_LABEL[shown]}`}
            options={parts.map((p) => ({ key: p, label: DESK_PART_LABEL[p] }))}
            onPick={(k) => {
              if (isDeskPart(k)) setPart(k);
            }}
            dataAttr="data-desk-part"
          />
        ) : (
          <span className="text-sm font-semibold text-ink/70">Desk · {DESK_PART_LABEL[shown]}</span>
        )}
        {parts.length > 1 ? <span className="text-xs text-ink/70">{partsWords(parts)}</span> : null}
        <span className="flex-1" />
        {isHost ? (
          <ActionButton tone="neutral" icon={Settings} iconOnly label="Who runs the desk" onClick={() => setOpen(true)} />
        ) : null}
      </div>

      {DESK_PARTS.filter((p) => parts.includes(p)).map((p) => (
        <div key={p} hidden={p !== shown} data-desk-body={p} className="mt-4">
          {body[p]}
        </div>
      ))}

      {isHost ? (
        <SidePanel open={open} onClose={() => setOpen(false)} title="Who runs the desk">
          <WhoRunsTheDesk eventId={eventId} initial={initialAccess} doorCandidates={doorCandidates} />
        </SidePanel>
      ) : null}
    </>
  );
}

function PartsPick({ label, parts, onChange }: { label: string; parts: readonly DeskPart[]; onChange: (next: DeskPart[]) => void }) {
  return (
    <PickMenu
      label={label}
      value={null}
      buttonText={partsWords(parts)}
      options={DESK_PARTS.map((p) => ({ key: p, label: DESK_PART_LABEL[p] }))}
      picked={parts}
      onPick={(k) => {
        if (!isDeskPart(k)) return;
        onChange(parts.includes(k) ? parts.filter((p) => p !== k) : DESK_PARTS.filter((p) => p === k || parts.includes(p)));
      }}
      compact
    />
  );
}

function WhoRunsTheDesk({
  eventId,
  initial,
  doorCandidates,
}: {
  eventId: string;
  initial: DeskAccess;
  doorCandidates: readonly DoorCandidate[];
}) {
  const [access, setAccess] = useState<DeskAccess>(initial);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (next: DeskAccess) => {
    const before = access;
    setAccess(next);
    setNote(null);
    start(async () => {
      const res = await saveDeskAccess(eventId, serializeDeskAccess(next));
      if (res.ok) {
        setAccess(res.access);
        setNote('Saved');
      } else {
        setAccess(before);
        setNote(res.error);
      }
    });
  };

  const door = access.door;
  const doorName = door ? (doorCandidates.find((c) => c.userId === door.userId)?.name ?? 'A supplier') : null;

  return (
    <div className="space-y-1 px-1 pb-4" aria-busy={pending}>
      <Row title="Hosts" sub="Always · every part">
        <span className="inline-flex min-h-11 items-center rounded-full bg-ink/5 px-3 text-sm font-semibold text-ink/50">
          {partsWords(DESK_PARTS)}
        </span>
      </Row>
      <Row title="Coordinator">
        <PartsPick label="Coordinator’s parts" parts={access.coordinator} onChange={(p) => save({ ...access, coordinator: p })} />
      </Row>
      <Row title="Helpers">
        <PartsPick label="Helpers’ parts" parts={access.helpers} onChange={(p) => save({ ...access, helpers: p })} />
      </Row>
      <Row title="A supplier at the door" sub={doorName ?? (doorCandidates.length ? 'Pick the supplier' : 'No supplier has access to this event yet')}>
        <PickMenu
          label="Supplier at the door"
          value={door?.userId ?? 'off'}
          buttonText={door ? (doorName ?? 'A supplier') : 'Off'}
          options={[{ key: 'off', label: 'Off' }, ...doorCandidates.map((c) => ({ key: c.userId, label: c.name }))]}
          onPick={(k) => save({ ...access, door: k === 'off' ? null : { userId: k, parts: door?.parts.length ? door.parts : ['guests'] } })}
          compact
        />
      </Row>
      {door ? (
        <Row title={`${doorName ?? 'A supplier'}’s parts`}>
          <PartsPick
            label="Door supplier’s parts"
            parts={door.parts}
            onChange={(p) => save({ ...access, door: p.length ? { userId: door.userId, parts: p } : null })}
          />
        </Row>
      ) : null}
      <p className="min-h-5 pt-2 text-sm text-ink/70" role="status">
        {pending ? 'Saving…' : note}
      </p>
    </div>
  );
}

function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-ink/10 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {sub ? <span className="block text-xs text-ink/70">{sub}</span> : null}
      </span>
      {children}
    </div>
  );
}
