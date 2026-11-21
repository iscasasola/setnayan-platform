'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Armchair, ChevronRight, Share, RotateCcw, RotateCw, Trash2, Unlink, X } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { NfcWriteButton } from '@/app/_components/nfc-write-button';
import { FORM_PICK_CLASS, usePillWidth } from '@/app/_components/form-row';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { SubmitButton } from '@/app/_components/submit-button';
import { GuestConfirmActions, GuestPopup } from './guest-popup';
import { useGuestActions } from './guest-actions-context';
import { ticketFileName, ticketUrl, useTicketVersion, type TicketVersion } from './send-invite';
import { DeleteGuestFlow, useGuestRemoval } from './guest-delete';
import { GuestResetFlow } from './guest-reset';
import { useInspectorContext } from '@/app/_components/inspector/inspector-column';
import { useRouter } from 'next/navigation';
import { useGuestTicketStatus } from './guest-card-quick';
import { TicketPlaceholder } from '@/app/_components/ticket-placeholder';

/**
 * guest-ticket-parts.tsx — the top of the guest card, and the ⋯ every Invite
 * row carries (owner 2026-09-30, DECISION_LOG "APPROVED — THE FABLE DESIGNS FOR
 * THE GUEST CARD, THE GUEST LIST ROWS AND THE GUEST LANDING PAGE";
 * `prototypes/guest_card_invite_simple_2026-09-30_fable.html`, frames A · D · E · F).
 *
 *   · `GuestTicketThumb` — "Their ticket", ONE row with its state in words (20 Nov 2026). Tap → the full ticket
 *     exactly as the guest sees it on Me, with Save ticket (it replaces Download ticket AND Download QR — the QR is
 *     on the ticket) and the labelled buttons below.
 *   · `GuestMoreMenu` — Write to NFC · New QR · Unlink account as labelled buttons inside that opened ticket (the
 *     last only while an account holds the invitation). New QR asks first (frame E); so does Unlink.
 *
 * 🔑 +0 SERVER ACTIONS. New QR and Unlink both ride `releaseGuestClaim`'s one
 * door (`new_qr` / `unlink_account`), the way "Give this spot" does.
 *
 * ⚠ The QR's LOOK is not here any more: it is the whole event's, not one
 * guest's, and lives in the Maker — Details › Look.
 */

/**
 * 🎟 THEIR TICKET IS ONE ROW YOU TAP TO VIEW (owner-approved drawing `guests_redesign_2026-11-20_fable.html` § 3, "Yes, build
 * it" 20 Nov 2026: *"The ticket is one row you tap to view, with its state in words."*). The row: their real ticket, small ·
 * "Their ticket" · "Not sent yet · Not linked" · ›. A tap opens the full ticket exactly as the guest sees it on Me, with
 * Save ticket — and, under it, the labelled buttons that were icons on the old ticket row (`tools`: Write to NFC · New QR ·
 * Unlink account). A guest with no ticket (replied they can't come, no link yet) still has the row: it opens on "No ticket"
 * and the same buttons, so New QR is never out of reach.
 */
export function GuestTicketThumb({
  guestId,
  name,
  available,
  version,
  tools,
  status,
  about,
}: {
  guestId: string;
  /** The guest's full name — the saved file is named after them. */
  name: string;
  /** False when they have no ticket (replied they can't come, a request, passed away). */
  available: boolean;
  /**
   * 🎟 The ticket's version, streamed with the card (`passCardTicketVersion`; owner 2026-10-16: "it always
   * reloads i thought we have cache"). The picture is asked for at its versioned address, which the route
   * caches for a year — so every later open draws it from the phone with no request. Absent → the old
   * address (asked again on every open).
   */
  version?: TicketVersion;
  /** The labelled buttons inside the opened ticket (`GuestMoreMenu`: Write to NFC · New QR · Unlink account). */
  tools?: ReactNode;
  /** The row's state in words when no invite cell hands them (`useGuestTicketStatus`) — the couple's "Linked · Host". */
  status?: ReactNode;
  /** One short line inside the opened ticket — "What they see on their phone." */
  about?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const titleId = useId();
  const imgRef = useRef<HTMLImageElement>(null);
  const tv = useTicketVersion(version);
  const src = ticketUrl(guestId, tv.v);
  const handed = useGuestTicketStatus();
  const words = handed ?? status ?? null;
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

  const has = available && !broken;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sn-press group flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-ink/10 px-3 py-2 text-left"
        aria-label={has ? `View ${name}'s ticket` : `${name}'s ticket — none yet`}
        aria-haspopup="dialog"
        data-guest-ticket-thumb={has ? '' : 'none'}
      >
        {/* ⚡ The card never waits for its ticket (owner, live iPhone test 2026-10-02): the picture is asked for only once
            the card is on screen, at low priority. 🎟 NEVER A BLANK WHITE BOX (owner 2026-10-05): until the picture has
            LOADED the box is the ticket's own shape with a QR mark, and the picture fades in OVER it. */}
        <span className="relative block aspect-[3/4] w-9 shrink-0">
          <TicketPlaceholder name={null} waiting={has && !loaded} />
          {has && mounted && tv.ready ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own gated route; the same PNG Save ticket saves
            <img
              ref={imgRef}
              src={src}
              alt=""
              width={36}
              height={48}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
              data-guest-ticket-img={loaded ? 'loaded' : 'loading'}
              className={`absolute inset-0 h-full w-full rounded-md object-cover ring-1 ring-ink/10 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-tight text-ink">Their ticket</span>
          <span className="mt-0.5 block truncate text-[13px] text-ink/60" data-guest-invite-status="">
            {has ? words ?? 'Tap to view' : <>No ticket{words ? <> · {words}</> : null}</>}
          </span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
      </button>
      {open && mounted ? (
        <GuestPopup
          onClose={() => setOpen(false)}
          rootClassName="fixed inset-0 z-[96] flex items-center justify-center p-4"
          rootData={{ 'data-guest-ticket-view': '' }}
          panelClassName="relative flex max-h-[92dvh] w-full max-w-[380px] flex-col items-center gap-3 overflow-y-auto rounded-3xl bg-cream p-4 shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)]"
          labelledById={titleId}
        >
          <div className="flex w-full items-center justify-between">
            <p id={titleId} className="sn-eye">
              Their ticket
            </p>
            <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close" onClick={() => setOpen(false)} />
          </div>
          {has ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- the guest's own ticket, exactly as they see it on Me */}
              <img
                src={src}
                alt={`${name}'s ticket`}
                width={300}
                height={400}
                onError={() => setBroken(true)}
                className="max-h-[52dvh] w-auto rounded-xl object-contain ring-1 ring-ink/10"
              />
              <SaveFileLink
                href={src}
                filename={ticketFileName(name)}
                className={actionButtonClass('brand', { main: true, extra: 'w-full min-h-11' })}
              >
                {(state) => (
                  <>
                    <Share aria-hidden strokeWidth={1.9} />
                    <span className="lbl">{state === 'saving' ? 'Saving…' : 'Save ticket'}</span>
                  </>
                )}
              </SaveFileLink>
              <p className="text-center text-xs text-ink/55">{about ? <>{about} </> : null}Saves it as one image — the QR is on it.</p>
            </>
          ) : (
            <p role="status" className="w-full py-6 text-center text-sm text-ink/60" data-guest-ticket-none="">
              No ticket yet.
            </p>
          )}
          {/* 🏷 What were icons on the ticket row, each with its word (drawing § 3: "labelled buttons inside the opened ticket"). */}
          {tools ? (
            <div className="grid w-full grid-cols-1 gap-2 border-t border-ink/10 pt-3 [&_.ab]:w-full [&_.ab]:justify-start" data-guest-ticket-tools="">
              {tools}
            </div>
          ) : null}
        </GuestPopup>
      ) : null}
    </>
  );
}

/**
 * 🏷 THE OPENED TICKET'S BUTTONS — Write to NFC · New QR · Unlink account, each WITH ITS WORD (owner-approved drawing
 * `guests_redesign_2026-11-20_fable.html` § 3: *"NFC and New QR icons, ⋯ Unlink account → labelled buttons inside the opened
 * ticket"*). Until 20 Nov they were two icon buttons and a ⋯ of one line on the card's ticket row; the ⋯ is gone — three
 * buttons need no menu. The same doors: NFC is the shipped writer and its sheet (`NfcWriteButton`); New QR and Unlink each
 * ASK FIRST, then ride `releaseGuestClaim` (`new_qr` / `unlink_account`). Unlink is drawn only while an account holds the
 * invitation.
 *
 * 🗑 Delete guest is the card's own last group — `GuestDeleteControl` below.
 */
export function GuestMoreMenu({
  eventId,
  guestId,
  guestName,
  nfcUrl,
  linked,
  returnTo,
}: {
  eventId: string;
  guestId: string;
  guestName: string;
  /** Their own link, for the tag. Null → no link yet, so no NFC button. */
  nfcUrl: string | null;
  /** An account holds this invitation — only then is Unlink offered. */
  linked: boolean;
  /** Where New QR lands — the surface the ticket was opened on. */
  returnTo: string;
}) {
  const [confirm, setConfirm] = useState<'new_qr' | 'unlink' | null>(null);
  const confirmId = useId();
  /* The shipped action — the dev lab hands in a stand-in (`guest-actions-context.tsx`). */
  const { releaseGuestClaim } = useGuestActions();
  const release = releaseGuestClaim.bind(null, eventId, guestId);

  return (
    <>
      {nfcUrl ? <NfcWriteButton url={nfcUrl} worded name={`Write ${guestName}’s link to NFC`} /> : null}
      <ActionButton
        tone="neutral"
        icon={RotateCw}
        label="New QR"
        name={`Make a new QR for ${guestName}`}
        onClick={() => setConfirm('new_qr')}
        aria-haspopup="dialog"
        data-testid="guest-new-qr"
      />
      {linked ? (
        <span className="contents" data-guest-more-menu="">
          <ActionButton
            tone="danger"
            icon={Unlink}
            label="Unlink account"
            name={`Unlink the account holding ${guestName}’s invitation`}
            onClick={() => setConfirm('unlink')}
            aria-haspopup="dialog"
            data-guest-unlink=""
          />
        </span>
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
              <p className="text-sm leading-relaxed text-ink/70" data-guest-new-qr-warning="">
                Their old QR and link will stop working. Anyone holding the old one — a printed pass, a forwarded
                message — won&rsquo;t get in.
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
    </>
  );
}

/**
 * 🗑 THE CARD'S OWN DELETE — the last group of the guest card (owner 2026-10-23, prototype
 * `guest_card_groups_and_papic_2026-10-23.html`: "Delete (out of ⋯)"). Moved, not re-made: the same warning
 * (`DeleteGuestFlow` — never a browser `confirm()`; its button is the second tap) and the same delete as the swipe and
 * the selection bar (`guest-delete.tsx`, owner 2026-10-03 DECISION_LOG "A HOST CAN DELETE A GUEST WHO ALREADY
 * ACCEPTED"), and the card closes itself once it is done. Any reply state; never the couple (the body says why instead).
 *
 * 🪑 A +1 with no name yet (`seatWithNoName`, `plusOneHasNoName`) reads "Release seat": gone at once, with Undo, their
 * guest's "+N" one lower (owner 2026-10-21). A named +1 keeps Delete and its warning.
 */
/** The dropdown's two lines, Reset first (the order the two buttons stood in). */
const RESET_OR_DELETE: readonly PickOption[] = [
  { key: 'reset', label: 'Reset', icon: <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.9} /> },
  { key: 'delete', label: 'Delete guest', icon: <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.9} /> },
];

export function GuestDeleteControl({
  eventId,
  guestId,
  guestName,
  seatWithNoName = false,
  resettable = false,
}: {
  eventId: string;
  guestId: string;
  guestName: string;
  seatWithNoName?: boolean;
  /** 🔄 Reset beside Delete (owner 2026-10-26: "(RESET) (DELETE)") — a guest's own card; never a +1 seat or the couple. */
  resettable?: boolean;
}) {
  const { release: releaseSeat } = useGuestRemoval(eventId);
  const width = usePillWidth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const inspector = useInspectorContext();
  const router = useRouter();
  // The card is of a guest (or a seat) who is gone — close it: the panel over the list, or the standalone page back to the list.
  const closeCard = () => {
    if (inspector) inspector.close();
    else router.push(`/dashboard/${eventId}/guests`);
  };
  return (
    <div data-guest-delete-control="">
      {/* 🔽 RESET OR DELETE IS ONE DROPDOWN (owner-approved drawing `guests_redesign_2026-11-20_fable.html` § 3: "Reset or
          delete ⓘ · Choose ▾", inside More; the house rule "any set of choices is a dropdown"). It replaces the 26 Oct pair of
          buttons side by side — the same two doors: each still ASKS FIRST and offers Undo right after. One choice is not a
          set: a +1 seat keeps its single Delete / Release seat button. */}
      {resettable && !seatWithNoName ? (
        <span data-guest-reset-or-delete="">
          <PickMenu
            label={`Reset or delete ${guestName}`}
            value={null}
            buttonText="Choose"
            options={RESET_OR_DELETE}
            onPick={(k) => (k === 'reset' ? setConfirmReset(true) : setConfirmDelete(true))}
            className={`${FORM_PICK_CLASS} ${width}`}
          />
        </span>
      ) : seatWithNoName ? (
        <span data-guest-release-seat="">
          <ActionButton tone="danger" icon={Armchair} label="Release seat" onClick={() => void releaseSeat([guestId], { onReleased: closeCard })} />
        </span>
      ) : (
        <span data-guest-delete="">
          <ActionButton tone="danger" icon={Trash2} label="Delete guest" onClick={() => setConfirmDelete(true)} />
        </span>
      )}
      {confirmReset ? (
        <GuestResetFlow eventId={eventId} guestId={guestId} guestName={guestName} onClose={() => setConfirmReset(false)} />
      ) : null}
      {confirmDelete ? (
        <DeleteGuestFlow
          eventId={eventId}
          guestId={guestId}
          guestName={guestName}
          onClose={() => setConfirmDelete(false)}
          onDeleted={closeCard}
        />
      ) : null}
    </div>
  );
}
