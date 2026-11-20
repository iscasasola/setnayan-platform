'use client';

/**
 * guest-card-quick.tsx — THE GUEST CARD'S QUICK ACTIONS (owner-approved drawing `guests_redesign_2026-11-20_fable.html`
 * § 3, "Yes, build it" 20 Nov 2026: *"Four quick actions with words: Send invite · Call · Seat · Note. No mobile yet, so
 * Call reads 'Add mobile'."* · *"What you do most is at the top."*).
 *
 * NOT a second way to change anything. Send invite is the card's ONE send (`GuestInviteCell`, which draws this row);
 * Call is the shipped hand-off to the phone (`guest-call-buttons.tsx`); and the three here — Add mobile · Seat · Note —
 * only OPEN THE ROW that already holds the field, exactly as a tap on that row's own head does (one fold open at a time,
 * the same autosave). Add mobile also opens the mobile box itself, so the next thing they do is type.
 *
 * The buttons are THE BUTTON (`ActionButton`, neutral); the row's look — four equal tiles, the icon over its word — is
 * `GUEST_QUICK_ROW`, laid over them by the row, so no button here is hand-made.
 * 🔒 guests/_components/the-guest-card-is-the-20-nov-card.test.ts
 */
import { createContext, useContext, type ReactNode } from 'react';
import { Armchair, PencilLine, Phone } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/** One row, equal widths, the icon over its word, 52 px tall (the drawing's tiles; over the 44 px floor). */
export const GUEST_QUICK_ROW =
  'grid auto-cols-fr grid-flow-col gap-2 [&_.ab]:h-auto [&_.ab]:min-h-[52px] [&_.ab]:w-full [&_.ab]:min-w-0 [&_.ab]:flex-col [&_.ab]:justify-center [&_.ab]:gap-1 [&_.ab]:rounded-xl [&_.ab]:px-1 [&_.ab]:py-1.5 [&_.ab_.lbl]:text-[12px] [&_.ab_.lbl]:leading-tight';

/** The quick row's box, for a card whose Send invite is not drawn (the couple): the same row, the other actions. */
export function GuestQuickRow({ children }: { children: ReactNode }) {
  return (
    <div className={GUEST_QUICK_ROW} data-guest-quick-actions="">
      {children}
    </div>
  );
}

/** The card's groups a quick action opens — the rows' stable handles (`CardFold`'s `handle`). */
const ROWS = {
  mobile: { handle: 'basic-info', field: 'mobile', icon: Phone, label: 'Add mobile' },
  seat: { handle: 'seat-plan', field: null, icon: Armchair, label: 'Seat' },
  note: { handle: 'note-for-them-private-note', field: null, icon: PencilLine, label: 'Note' },
} as const;
export type GuestQuickRowKey = keyof typeof ROWS;

/** Open one group of the card this button sits on, and bring it into view; `field` → that field's own box opens too. */
export function openGuestCardRow(from: Element, handle: string, field: string | null): void {
  const card = from.closest('[data-guest-card-root]') ?? document;
  const fold = card.querySelector<HTMLElement>(`[data-fold="card-${handle}"]`);
  if (!fold) return;
  const head = fold.querySelector<HTMLElement>(':scope > [data-fold-pinbox] [data-fold-head]');
  if (head?.getAttribute('aria-expanded') === 'false') head.click();
  // Two frames: the fold takes its place (and stops being `inert`) on the first, then the field can open.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      fold.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (!field) return;
      const pill = fold.querySelector<HTMLElement>(`[data-card-field="${field}"] [data-form-row-pill]`);
      if (pill && !pill.closest('[data-form-row-open]')) pill.click();
    }),
  );
}

export function GuestCardOpenRow({ row, name }: { row: GuestQuickRowKey; /** Whose card — for the button's accessible name. */ name: string }) {
  const r = ROWS[row];
  return (
    <ActionButton
      tone="neutral"
      icon={r.icon}
      label={r.label}
      name={row === 'mobile' ? `Add mobile for ${name}` : `${r.label} — ${name}`}
      onClick={(e) => openGuestCardRow(e.currentTarget, r.handle, r.field)}
      data-guest-quick={row}
    />
  );
}

/**
 * 🎟 "Not sent yet · Not linked" — the ticket row's words. Whether the invitation was SENT is the invite cell's own
 * state (it changes the moment they mark it sent), so the cell hands its words to the ticket row drawn under it; a card
 * with no invite cell (the couple) hands its own.
 */
const TicketStatus = createContext<ReactNode>(null);
export function GuestTicketStatusProvider({ words, children }: { words: ReactNode; children: ReactNode }) {
  return <TicketStatus.Provider value={words}>{children}</TicketStatus.Provider>;
}
export function useGuestTicketStatus(): ReactNode {
  return useContext(TicketStatus);
}
