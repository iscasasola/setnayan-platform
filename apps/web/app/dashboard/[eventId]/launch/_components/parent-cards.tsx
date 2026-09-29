'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { parseGuestInput } from '@/lib/guest-parse';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { addSingleGuest } from '../../guests/inline-actions';

/**
 * THE PARENTS ON THE INVITATION — each one tappable, opening THEIR OWN guest
 * card right here (owner 2026-09-28, via the controller: parents, option (a) —
 * *"Tapping a parent opens the shipped guest card (GuestCardBody + AutosaveForm)
 * on the right; +0 server actions"*; DECISION_LOG "NO 'GO EDIT IT OVER THERE'
 * LINKS — EDIT IT WHERE YOU ARE").
 *
 * 🔑 THE CARD, NEVER A NAME BOX. The only guest writer is `updateGuest`, a
 * full-row write that stores NULL for any column it is not sent
 * (`the-card-posts-every-column.test.ts`). A names-only field here would erase a
 * parent's side, role, RSVP and contact on the first keystroke. The shipped
 * card posts every column, so it is what opens — loaded on the server by the
 * one loader the Guest list uses (`loadGuestCard`).
 *
 * ＋ ADDING A PARENT IS DONE HERE TOO (owner's rule, via the controller: no
 * "go edit it over there" links). The Guest list's own single-guest add
 * (`addSingleGuest` — the capture bar's path: the name parser, the offered-role
 * check, the insert), with the parent role preset from the side picked. The
 * new parent joins the list after the Maker's one refresh, and their card
 * opens. +0 server actions.
 */
export function ParentCards({
  eventId,
  parents,
}: {
  eventId: string;
  parents: Array<{ guestId: string | null; name: string; card: ReactNode }>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [side, setSide] = useState<'bride' | 'groom'>('bride');
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /* The new parent's card opens once the refreshed list carries it. */
  useEffect(() => {
    if (pendingOpen && parents.some((p) => p.guestId === pendingOpen && p.card)) {
      setOpen(pendingOpen);
      setPendingOpen(null);
    }
  }, [parents, pendingOpen]);

  const add = () => {
    const typed = name.trim();
    if (!typed || pending) return;
    setError(null);
    start(async () => {
      const draft = { ...parseGuestInput(typed, { defaultSide: side }), side, groups: [], plusOnes: 0, roleHint: side === 'bride' ? ('bride_parents' as const) : ('groom_parents' as const) };
      try {
        const r = await makerSave(() => addSingleGuest(eventId, draft), requestMakerRefresh);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setName('');
        setAdding(false);
        setPendingOpen(r.guest.guest_id);
      } catch {
        setError('That did not save. Please try again.');
      }
    });
  };
  const openParent = parents.find((p) => p.guestId && p.guestId === open) ?? null;
  if (openParent) {
    return (
      <div data-parent-card={openParent.guestId} className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="sn-press inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-ink/75 hover:bg-ink/5"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          Parents
        </button>
        <HubSavesImmediately />
        {openParent.card}
      </div>
    );
  }
  return (
    <div data-parent-list="" className="flex flex-col gap-1.5">
      {parents.length ? (
        parents.map((p, i) =>
          p.guestId && p.card ? (
            <button
              key={p.guestId}
              type="button"
              onClick={() => setOpen(p.guestId)}
              data-parent-open={p.guestId}
              className="sn-press flex min-h-11 items-center justify-between gap-2 rounded-md border border-ink/15 bg-white px-3 text-left text-sm text-ink hover:border-ink/30"
            >
              <span className="truncate">{p.name}</span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
            </button>
          ) : (
            <p key={`${p.name}-${i}`} className="px-1 text-sm text-ink/75">
              {p.name}
            </p>
          ),
        )
      ) : (
        <p className="text-xs text-ink/65">No parents on your guest list yet.</p>
      )}
      {adding ? (
        <div data-parent-add="" className="flex flex-col gap-2 rounded-md bg-ink/[0.03] p-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            maxLength={120}
            autoFocus
            aria-label="Parent’s name"
            placeholder="e.g. Atty. Rosa M. Santos"
            className="rounded-md border border-ink/15 bg-white px-3 py-2 text-[16px] text-ink"
          />
          <div className="flex flex-wrap items-center gap-2">
            <PickMenu
              label="Whose parent"
              value={side}
              dataAttr="data-parent-side"
              options={[
                { key: 'bride', label: 'Parent of the Bride' },
                { key: 'groom', label: 'Parent of the Groom' },
              ]}
              onPick={(k) => setSide(k === 'groom' ? 'groom' : 'bride')}
            />
            <button type="button" onClick={add} disabled={pending || !name.trim()} className="button-primary text-sm disabled:opacity-50">
              {pending ? 'Adding…' : 'Add'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs font-medium text-ink/60 underline underline-offset-2">
              Cancel
            </button>
          </div>
          <HubSavesImmediately />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          data-parent-add-open=""
          className="sn-press inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-mulberry hover:bg-mulberry/5"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add a parent
        </button>
      )}
      {pendingOpen ? <p role="status" className="text-xs text-ink/60">Added — opening their card…</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
