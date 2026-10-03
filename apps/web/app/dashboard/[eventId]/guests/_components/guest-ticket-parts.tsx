'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { NfcWriteButton } from '@/app/_components/nfc-write-button';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { Sheet } from '@/app/_components/sheet';
import { SubmitButton } from '@/app/_components/submit-button';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { releaseGuestClaim } from '../[guestId]/actions';
import { ticketFileName, ticketUrl } from './send-invite';
import { DeleteGuestFlow } from './guest-delete';
import { useInspectorContext } from '@/app/_components/inspector/inspector-column';
import { useRouter } from 'next/navigation';

/**
 * guest-ticket-parts.tsx — the top of the guest card, and the ⋯ every Invite
 * row carries (owner 2026-09-30, DECISION_LOG "APPROVED — THE FABLE DESIGNS FOR
 * THE GUEST CARD, THE GUEST LIST ROWS AND THE GUEST LANDING PAGE";
 * `prototypes/guest_card_invite_simple_2026-09-30_fable.html`, frames A · D · E · F).
 *
 *   · `GuestTicketThumb` — their REAL Digital ticket, small. Tap → the full
 *     ticket exactly as the guest sees it on Me, with ONE button: Save ticket
 *     (it replaces Download ticket AND Download QR — the QR is on the ticket).
 *   · `GuestMoreMenu` — ⋯ : ONE dropdown list, never a row of pills —
 *     Write to NFC · New QR · Unlink account (the last only while an account
 *     holds the invitation). New QR asks first (frame E); so does Unlink.
 *
 * 🔑 +0 SERVER ACTIONS. New QR and Unlink both ride `releaseGuestClaim`'s one
 * door (`new_qr` / `unlink_account`), the way "Give this spot" does.
 *
 * ⚠ The QR's LOOK is not here any more: it is the whole event's, not one
 * guest's, and lives in the Maker — Details › Look.
 */

/** Their ticket, small — and full size on a tap, with Save ticket. */
export function GuestTicketThumb({
  guestId,
  name,
  available,
}: {
  guestId: string;
  /** The guest's full name — the saved file is named after them. */
  name: string;
  /** False when they have no ticket (replied they can't come, a request, passed away). */
  available: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: boxRef });

  const src = ticketUrl(guestId);
  if (!available || broken) {
    return (
      <div
        role="status"
        className="flex aspect-[3/4] w-[92px] shrink-0 items-center justify-center rounded-lg bg-ink/[0.04] p-2 text-center text-[11px] leading-tight text-ink/50"
        data-guest-ticket-thumb="none"
      >
        No ticket
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-[92px] shrink-0 flex-col items-center gap-1"
        aria-label={`View ${name}'s ticket`}
        data-guest-ticket-thumb=""
      >
        {/* ⚡ The card never waits for its ticket (owner, live iPhone test
            2026-10-02). The picture is drawn on demand by the server, so it is
            asked for only once the card is on screen, at low priority — the
            card's own fields arrive first; the ticket fills its box after. */}
        {mounted ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own gated route; the same PNG Save ticket saves
          <img
            src={src}
            alt=""
            width={92}
            height={123}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            onError={() => setBroken(true)}
            className="aspect-[3/4] w-full rounded-lg bg-white object-cover shadow-[0_6px_18px_-10px_rgba(30,26,18,.45)] ring-1 ring-ink/10 transition-transform group-hover:-translate-y-0.5"
          />
        ) : (
          <span aria-hidden className="aspect-[3/4] w-full rounded-lg bg-ink/[0.04]" data-guest-ticket-waiting="" />
        )}
        <span className="text-[11px] italic text-ink/55">
          <span className="lg:hidden">Tap to view</span>
          <span className="hidden lg:inline">Click to view</span>
        </span>
      </button>
      {open && mounted
        ? createPortal(
            <div
              ref={boxRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="fixed inset-0 z-[96] flex items-center justify-center p-4"
              data-guest-ticket-view=""
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
              />
              <div className="relative flex max-h-[92dvh] w-full max-w-[380px] flex-col items-center gap-3 rounded-3xl bg-cream p-4 shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)]">
                <div className="flex w-full items-center justify-between">
                  <p id={titleId} className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
                    Their ticket
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
                  >
                    <X aria-hidden className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element -- the guest's own ticket, exactly as they see it on Me */}
                <img
                  src={src}
                  alt={`${name}'s ticket`}
                  className="max-h-[62dvh] w-auto rounded-xl object-contain ring-1 ring-ink/10"
                />
                <SaveFileLink
                  href={src}
                  filename={ticketFileName(name)}
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-cream"
                >
                  {(state) => (state === 'saving' ? 'Saving…' : 'Save ticket')}
                </SaveFileLink>
                <p className="text-center text-xs text-ink/55">Saves it as one image — the QR is on it.</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** ⋯ — Write to NFC · New QR · Unlink account · Delete guest, one list. */
export function GuestMoreMenu({
  eventId,
  guestId,
  guestName,
  nfcUrl,
  linked,
  returnTo,
  deletable = false,
}: {
  eventId: string;
  guestId: string;
  guestName: string;
  /** Their own link, for the tag. Null → no link yet, so no NFC line. */
  nfcUrl: string | null;
  /** An account holds this invitation — only then is Unlink offered. */
  linked: boolean;
  /** Where New QR lands — the surface the ⋯ was opened on. */
  returnTo: string;
  /**
   * ⚖ Delete guest, on the CARD's ⋯ (owner 2026-10-03, DECISION_LOG "A HOST CAN
   * DELETE A GUEST WHO ALREADY ACCEPTED"). Any reply state; never the couple.
   * The same warning and the same delete as the swipe and the selection bar
   * (`guest-delete.tsx`), and the card closes itself once it is done.
   */
  deletable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'new_qr' | 'unlink' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inspector = useInspectorContext();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const confirmId = useId();
  const menuId = useId();
  const release = releaseGuestClaim.bind(null, eventId, guestId);
  useEffect(() => setPortal(document.body), []);
  const portalled = (node: ReactNode) => (portal ? createPortal(node, portal) : node);

  /*
    ⚖ THE LIST DRAWS OUTSIDE THE ROW (Problems log, live iPhone test
    2026-10-02: RAGE_TAP on "More for …" — tapped again and again). A phone
    row clips its content (`overflow-hidden`, for the swipe), and this list
    used to open BELOW the ⋯ inside it — so it opened, invisibly, under the
    row's edge. It is drawn on the page now, pinned under the ⋯ where it was
    tapped, and closes if the page scrolls out from under it.
  */
  const place = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      // The NFC sheet is drawn by the button inside this menu; a tap in it is not "outside".
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t) || t?.closest?.('[data-sheet]')) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const item =
    'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[14px] text-ink transition-colors hover:bg-ink/5';

  return (
    <div ref={wrapRef} className="relative" data-guest-more-menu="">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) place();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`More for ${guestName}`}
        className="relative z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 transition-colors hover:border-ink/30 hover:text-ink"
      >
        <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={2} />
      </button>
      {/* Kept mounted while closed (hidden), so the NFC sheet its button opens
          outlives the menu closing behind it. */}
      {/* Drawn in place until the page has mounted (so the server and the first
          paint agree), then on the page itself — see `place` above. */}
      {portalled(
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        hidden={!open}
        style={at ? { top: at.top, right: at.right } : undefined}
        data-guest-more-list=""
        className="fixed z-[96] w-56 rounded-2xl bg-cream p-1.5 shadow-[0_18px_40px_-18px_rgba(30,26,18,.45)] ring-1 ring-ink/5"
      >
        {nfcUrl ? (
          <NfcWriteButton url={nfcUrl} className={item} />
        ) : null}
        <button
          type="button"
          role="menuitem"
          className={item}
          data-guest-new-qr=""
          onClick={() => {
            setOpen(false);
            setConfirm('new_qr');
          }}
        >
          New QR
        </button>
        {linked ? (
          <button
            type="button"
            role="menuitem"
            className={`${item} border-t border-ink/[0.06] text-terracotta-700`}
            data-guest-unlink=""
            onClick={() => {
              setOpen(false);
              setConfirm('unlink');
            }}
          >
            Unlink account
          </button>
        ) : null}
        {deletable ? (
          <button
            type="button"
            role="menuitem"
            className={`${item} border-t border-ink/[0.06] text-danger-700`}
            data-guest-delete=""
            onClick={() => {
              setOpen(false);
              setConfirmDelete(true);
            }}
          >
            Delete guest
          </button>
        ) : null}
      </div>,
      )}

      {confirmDelete ? (
        <DeleteGuestFlow
          eventId={eventId}
          guestId={guestId}
          guestName={guestName}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => {
            // The card is of a guest who is gone — close it (the panel over the
            // list, or the standalone page back to the list).
            if (inspector) inspector.close();
            else router.push(`/dashboard/${eventId}/guests`);
          }}
        />
      ) : null}

      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} labelledById={confirmId} rise>
        <form action={release} className="space-y-4 p-5" data-guest-confirm={confirm ?? ''}>
          {confirm === 'new_qr' ? (
            <>
              <input type="hidden" name="new_qr" value="1" />
              <input type="hidden" name="return_to" value={returnTo} />
              <h2 id={confirmId} className="font-display text-xl text-ink">
                Make a new QR for {guestName}?
              </h2>
              <p className="text-sm leading-relaxed text-ink/70">
                The old QR and link will stop working. Send them the new one — they&rsquo;ll see their updated
                ticket first when they open it.
              </p>
            </>
          ) : (
            <>
              <input type="hidden" name="unlink_account" value="1" />
              <h2 id={confirmId} className="font-display text-xl text-ink">
                Unlink the account holding {guestName}&rsquo;s invitation?
              </h2>
              <p className="text-sm leading-relaxed text-ink/70">
                That account stops seeing it, and the invitation gets a new QR and link. The guest, their reply and
                their seat stay.
              </p>
            </>
          )}
          <SubmitButton
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-mulberry px-5 text-sm font-medium text-cream disabled:opacity-60"
            pendingLabel={confirm === 'new_qr' ? 'Making a new QR…' : 'Unlinking…'}
          >
            {confirm === 'new_qr' ? 'Make a new QR' : 'Unlink account'}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setConfirm(null)}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-ink/15 bg-cream px-5 text-sm font-medium text-ink"
          >
            Cancel
          </button>
        </form>
      </Sheet>
    </div>
  );
}
