import type { ReactNode } from 'react';
import { InspectorColumn } from '@/app/_components/inspector/inspector-column';
import type { GuestHelperCard } from '@/lib/guest-helper-card.server';
import type { GuestPapicState } from '@/lib/papic-guest-camera';
import { GuestCardAvatar, GuestCardBody, guestCardEyebrow, guestCardReply, guestCardTitle, type GuestCardActions } from './guest-card-body';
import type { GuestCardData } from './guest-card-data';
import type { InviteSetup } from './invite-message-setup';
import { GuestInviteCell } from './guest-invite-cell';
import { GuestDeleteControl, GuestMoreMenu, GuestTicketThumb } from './guest-ticket-parts';
import { GuestPapicCamera } from './guest-papic-camera';
import { GuestAccessPick } from './guest-access-pick';
import { GuestProxyRow } from './guest-proxy-row';
import { GuestHelperAccess } from './guest-helper-access';

/**
 * 🪪 THE GUEST CARD — ONE, EVERYWHERE (owner 2026-10-24, on desktop, with a screenshot: *"the guest card on wedding march
 * is not same with the guest card."*).
 *
 * The Wedding March opened a SECOND card: the same body drawn by the Maker's hand-drawn kit, with no Invite ▾, no
 * "✓ Saved", no Delete, "Photos" for Papic, chevron rows for the approved folds, under a "Guests see this right away"
 * header the Guest list never had. This is now the only thing that draws a guest's card — the Guest list's panel
 * (`?inspect=`), the standalone route, the Wedding March, the parents on the invitation (`open-guest-card.tsx`) and the
 * dev labs — so a surface can no longer drift: the approved groups, order, folds, ticket, Invite, ⋯, Papic, Access and
 * Delete are ALL in it, wired once here (prototype `guest_card_groups_and_papic_2026-10-23.html`).
 *
 *   'panel' — the sticky eyebrow · name · reply header (`InspectorColumn`) over the body. The Guest list hands it to its
 *             rail (≥ 1280) and its sheet (below); a surface with no list behind it opens it in `InspectorSheetAlone`
 *             (`guest-card-sheet.tsx`) — the same sheet, the 440 panel from 701, a phone sheet below.
 *   'page'  — the standalone route: the card owns the page heading (`variant="page"`).
 *
 * 🔒 `guests/_components/one-guest-card.test.ts` — no other file draws `GuestCardBody`, and every surface that opens a
 * guest's card goes through this component.
 */
export type GuestCardProps = {
  frame: 'panel' | 'page';
  eventId: string;
  data: GuestCardData;
  invitationBase: string | null;
  photoDisplayUrl: string | null;
  inviteSetup: InviteSetup | null;
  papic: GuestPapicState | null;
  storeShell: boolean;
  ticketVersion: Promise<string | null> | null;
  /** A limited helper's grants (couple only) — null for everyone else. */
  helper: GuestHelperCard | null;
  returnTo: string;
  errorMessage: string | null;
  inviteFlash: { ok: boolean; msg: string } | null;
  /** The dev labs' stand-in writes (they reach no database). Every real surface leaves it out. */
  actions?: GuestCardActions;
};

/** What a surface's opener returns: the card, or a plain sentence (never the database's words). */
export type GuestCardResult = { ok: true; card: ReactNode } | { ok: false; reason: string };

export function GuestCard({
  frame,
  eventId,
  data,
  invitationBase,
  photoDisplayUrl,
  inviteSetup,
  papic,
  storeShell,
  ticketVersion,
  helper,
  returnTo,
  errorMessage,
  inviteFlash,
  actions,
}: GuestCardProps) {
  const { guest } = data;
  const body = (
    <GuestCardBody
      eventId={eventId}
      data={data}
      invitationBase={invitationBase}
      photoDisplayUrl={photoDisplayUrl}
      variant={frame}
      headerShown={frame === 'panel'}
      inviteSetup={inviteSetup}
      SendInvite={GuestInviteCell}
      TicketThumb={GuestTicketThumb}
      MoreMenu={GuestMoreMenu}
      DeleteControl={GuestDeleteControl}
      papic={papic}
      PapicCamera={GuestPapicCamera}
      AccessPick={GuestAccessPick}
      ProxyRow={GuestProxyRow}
      storeShell={storeShell}
      ticketVersion={ticketVersion}
      helperAccess={
        helper ? <GuestHelperAccess eventId={eventId} guestId={guest.guest_id} firstName={guest.first_name} helper={helper} /> : null
      }
      returnTo={returnTo}
      errorMessage={errorMessage}
      inviteFlash={inviteFlash}
      actions={actions}
    />
  );
  if (frame === 'page') return body;
  const title = guestCardTitle(guest, data.plusOneOf);
  return (
    <InspectorColumn
      eyebrow={guestCardEyebrow(guest, { hasSides: data.hasSides, roleNames: data.roleNames, plusOneOf: data.plusOneOf })}
      title={title}
      badge={guestCardReply(guest, data.proxy)}
      lead={<GuestCardAvatar guest={guest} photoDisplayUrl={photoDisplayUrl} size="head" />}
      pinSlot
      swapKey={guest.guest_id}
      ariaLabel={`${title} details`}
    >
      {body}
    </InspectorColumn>
  );
}
