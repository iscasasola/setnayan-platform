'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';

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
 */
export function ParentCards({
  parents,
  guestsHref,
}: {
  parents: Array<{ guestId: string | null; name: string; card: ReactNode }>;
  /** Where a parent is ADDED — a role on the Guest list is the one home for that. */
  guestsHref: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
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
      <Link href={guestsHref} className="w-fit text-xs font-medium text-mulberry underline underline-offset-2">
        Add a parent on your Guest list
      </Link>
    </div>
  );
}
