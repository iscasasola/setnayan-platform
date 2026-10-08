'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Download, MoreHorizontal, QrCode, Trash2, Unlink, X } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { NfcWriteButton } from '@/app/_components/nfc-write-button';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { SubmitButton } from '@/app/_components/submit-button';
import { GuestConfirmActions, GuestPopup } from './guest-popup';
import { menuNudge, menuRoomOf, menuWidthIn, nudgeUp, placeMenuIn } from '@/lib/menu-place';
import { useGuestActions } from './guest-actions-context';
import { ticketFileName, ticketUrl } from './send-invite';
import { DeleteGuestFlow } from './guest-delete';
import { useInspectorContext } from '@/app/_components/inspector/inspector-column';
import { useRouter } from 'next/navigation';
import { useOneOpen } from '@/lib/one-open';
import { TicketPlaceholder } from '@/app/_components/ticket-placeholder';

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
  const [loaded, setLoaded] = useState(false);
  const titleId = useId();
  const imgRef = useRef<HTMLImageElement>(null);
  const src = ticketUrl(guestId);
  useEffect(() => setMounted(true), []);
  // A card that switches guests starts over — only when the ADDRESS changes, so
  // an error that already fired for this ticket is never wiped.
  const shownSrc = useRef(src);
  useEffect(() => {
    if (shownSrc.current !== src) {
      shownSrc.current = src;
      setLoaded(false);
      setBroken(false);
    }
    // A picture already in the browser's cache can finish before React attaches
    // `onLoad` — read it once it is in the DOM, so a cached ticket is not held
    // behind the placeholder.
    const img = imgRef.current;
    if (mounted && img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [mounted, src]);

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
        {/* 🎟 NEVER A BLANK WHITE BOX (owner 2026-10-05, live on maria-and-jose:
            "the ticket picture is blank white for ~4 s before it appears"). The
            server draws the 1080×1440 PNG on demand — seconds, not
            milliseconds — and the <img> used to sit there white while it did.
            Until the picture has actually LOADED, the box is the ticket's own
            shape with their name and a QR mark; the picture fades in OVER it
            (the placeholder stays underneath, so the fade never shows an empty
            box). A broken picture still falls back to "No ticket" above. */}
        <span className="relative block aspect-[3/4] w-full">
          <TicketPlaceholder name={name} waiting={!loaded} />
          {mounted ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own gated route; the same PNG Save ticket saves
            <img
              ref={imgRef}
              src={src}
              alt=""
              width={92}
              height={123}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
              data-guest-ticket-img={loaded ? 'loaded' : 'loading'}
              className={`absolute inset-0 h-full w-full rounded-lg object-cover shadow-[0_6px_18px_-10px_rgba(30,26,18,.45)] ring-1 ring-ink/10 transition-[opacity,transform] duration-300 group-hover:-translate-y-0.5 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : null}
        </span>
        <span className="text-[11px] italic text-ink/55">
          <span className="lg:hidden">Tap to view</span>
          <span className="hidden lg:inline">Click to view</span>
        </span>
      </button>
      {open && mounted ? (
        <GuestPopup
          onClose={() => setOpen(false)}
          rootClassName="fixed inset-0 z-[96] flex items-center justify-center p-4"
          rootData={{ 'data-guest-ticket-view': '' }}
          panelClassName="relative flex max-h-[92dvh] w-full max-w-[380px] flex-col items-center gap-3 rounded-3xl bg-cream p-4 shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)]"
          labelledById={titleId}
        >
          <div className="flex w-full items-center justify-between">
            <p id={titleId} className="sn-eye">
              Their ticket
            </p>
            <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close" onClick={() => setOpen(false)} />
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
            className={actionButtonClass('brand', { main: true, extra: 'w-full min-h-11' })}
          >
            {(state) => (
              <>
                <Download aria-hidden strokeWidth={1.9} />
                <span className="lbl">{state === 'saving' ? 'Saving…' : 'Save ticket'}</span>
              </>
            )}
          </SaveFileLink>
          <p className="text-center text-xs text-ink/55">Saves it as one image — the QR is on it.</p>
        </GuestPopup>
      ) : null}
    </>
  );
}

/** The ⋯ list's width (was `w-56`) — one number for the CSS and the placement. */
const MORE_MENU_WIDTH = 224;

/**
 * ⋯ — Write to NFC · New QR · Unlink account · Delete guest, one list. Every
 * line carries its icon (owner 2026-10-04: "every item gets an icon, or none
 * do" — Write to NFC had one, New QR had none).
 */
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
  useOneOpen(open, setOpen); // one open at a time — lib/one-open.ts
  const inspector = useInspectorContext();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [at, setAt] = useState<{ top: number; left: number; width: number; maxHeight?: number } | null>(null);
  /** When WE scrolled the card to make room — that scroll must not close the list. */
  const nudgedAt = useRef(0);
  const confirmId = useId();
  const menuId = useId();
  /* The shipped action — the dev lab hands in a stand-in (`guest-actions-context.tsx`). */
  const { releaseGuestClaim } = useGuestActions();
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
  /*
    ⚖ WHOLLY ON SCREEN (live bug on 74ff0be at 375 px, 2026-10-03). The list
    was pinned by its RIGHT edge to the ⋯'s right edge — and on a phone row the
    ⋯ sits on the LEFT, beside Invite, so the list ran off the left of the
    screen and only "…to NFC" showed. It lines up with the ⋯'s right edge when
    it fits, and is otherwise clamped into the viewport (flipped above when
    there is no room below) by the one placement rule, lib/menu-place.ts.
  */
  /*
    ⚖ ON THE CARD IT STAYS IN THE CARD, BELOW THE TICKET (owner, live iPhone
    review 2026-10-04: the host's ⋯ "opens to the LEFT, spills past the card's
    edge and covers the ticket and the status line"). Inside the card's top
    (`data-menus-open-below`) the list opens under that whole row, lined up by
    its LEFT edge like the Invite list, and clamped between the card's edges. A
    guest-list row has no such box and keeps the right-edge rule above.
  */
  /*
    ⚖ NEVER OVER THE TICKET, EVEN ON A SHORT PHONE (review of #6352: on a
    375×667 iPhone SE with the ticket row low on screen, the list flipped ABOVE
    and covered the ticket again). In the card it never flips: if two lines of
    it cannot fit under the row, the card is brought up first; what still does
    not fit scrolls inside the list. Its height is measured at the width it is
    drawn — narrowed to the card, a list wraps taller.
  */
  const place = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let room = menuRoomOf(btn);
    const menuEl = menuRef.current;
    if (menuEl) menuEl.style.width = `${menuWidthIn(Math.min(MORE_MENU_WIDTH, vw - 16), room)}px`;
    const height = menuEl?.offsetHeight ?? 0;
    if (room && height > 0) {
      const by = menuNudge(room, { height: vh }, height, { boxTop: room.top });
      if (by > 0) {
        nudgedAt.current = Date.now();
        nudgeUp(btn, by);
        room = menuRoomOf(btn);
      }
    }
    const r = btn.getBoundingClientRect();
    setAt(
      placeMenuIn(
        r,
        { width: vw, height: vh },
        { width: Math.min(MORE_MENU_WIDTH, vw - 16), height },
        room ? 'start' : 'end',
        room,
      ),
    );
  };
  // Measured again once it is showing, so a tall list flips above a ⋯ that sits
  // low on the screen (its height is 0 while hidden).
  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portal]);

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
      if (Date.now() - nudgedAt.current < 500) return; // our own nudge, not the person scrolling away
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
      <ActionButton
        ref={buttonRef}
        tone="neutral"
        iconOnly
        icon={MoreHorizontal}
        label={`More for ${guestName}`}
        onClick={() => {
          if (!open) place();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative z-20"
      />
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
        style={
          at
            ? {
                top: at.top,
                left: at.left,
                width: at.width,
                maxWidth: 'calc(100vw - 16px)',
                ...(at.maxHeight != null ? { maxHeight: at.maxHeight, overflowY: 'auto' as const } : {}),
              }
            : { width: MORE_MENU_WIDTH, maxWidth: 'calc(100vw - 16px)' }
        }
        data-guest-more-list=""
        className="fixed z-[96] rounded-2xl bg-cream p-1.5 shadow-[0_18px_40px_-18px_rgba(30,26,18,.45)] ring-1 ring-ink/5"
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
          <QrCode aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
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
            <Unlink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
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
            <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
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

      {confirm !== null ? (
      <GuestPopup kind="confirm" onClose={() => setConfirm(null)} labelledById={confirmId}>
        <form action={release} className="space-y-3" data-guest-confirm={confirm ?? ''}>
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
          <GuestConfirmActions
            keep={<ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setConfirm(null)} />}
            go={
              <SubmitButton
                className={actionButtonClass('brand', { main: true, extra: 'min-h-11' })}
                pendingLabel={confirm === 'new_qr' ? 'Making a new QR…' : 'Unlinking…'}
              >
                {confirm === 'new_qr' ? 'Make a new QR' : 'Unlink account'}
              </SubmitButton>
            }
          />
        </form>
      </GuestPopup>
      ) : null}
    </div>
  );
}
