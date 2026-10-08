import Link from 'next/link';
import { composeFormalName } from '@/lib/formal-name';
import { LINKED_NAME_WORDS, PROFILE_NAME_WORDS } from '@/lib/extra-seats';
import { pickItems } from '@/lib/role-alternatives';
import { InfoTip } from '@/app/_components/info-tip';
import {
  guestDisplayName,
  guestInitials,
  GROUP_CATEGORY_LABELS,
  MEAL_LABELS,
  guestRoleLabel,
  guestRolePickLabel,
  SIDE_LABELS,
  SINGLETON_GUEST_ROLES,
  REQUEST_ENTRY_SOURCE,
  type GuestGroupCategory,
  type GuestRole,
  type InvitedToBlock,
  type GuestSide,
  type GuestAttire,
  type MealPreference,
  type RsvpStatus,
  RSVP_ROW_WORDS,
  PLUS_ONE_CHOICES,
  plusOneSeats,
  guestFullName,
  guestHasTicket,
} from '@/lib/guests';
import { prefixChoicesFor } from '@/lib/formal-name';
import { roleGroupLabel, roleGroupOf } from '@/lib/role-groups';
import { SubmitButton } from '@/app/_components/submit-button';
import { InvitedToChips } from './invited-to-chips';
import { FormPick } from './card-fields';
/* ⚡ TYPE ONLY, like SendInvite below: the ticket view and the ⋯ are handed in
   by the pages that draw them (the Guest list, the standalone card). The Maker's
   parent cards pass neither — they get a plain server-drawn ticket and no ⋯ —
   so the NFC writer and the confirm sheets never enter the Maker's first load
   (`check-maker-js-budget.mjs`). Not a lazy import either: an async chunk adds
   an entry to the every-page webpack runtime, measured +58 B against a shared
   bundle with 20 B to spare. */
import type { GuestMoreMenu, GuestTicketThumb } from './guest-ticket-parts';
/* ⚡ TYPE ONLY. The Invite pair is handed in by the page that draws it
   (\`SendInvite\` below): the Guest list passes the real one, and the Maker —
   whose parent cards never show it — passes nothing, so its code stays out of
   the Maker's first load (\`check-maker-js-budget.mjs\`). */
import type { GuestInviteCell } from './guest-invite-cell';
// A server component: the route comes from its own module (a constant imported
// from a 'use client' file would arrive here as a client reference, not a string).
import { PASS_CARD_ROUTE } from '@/lib/pass-card';
import type { InviteSetup } from './invite-message-setup';
import type { CardBoxProps, CardFieldProps, CardFoldProps, CardInvitedToProps, CardKit, CardLockedProps, CardPickProps, CardSubmitProps, CardTipProps, CardToggleProps } from './guest-card-kit';
import type { ComponentType } from 'react';
import { AutosaveForm, AutosaveState } from './guest-card-autosave';
import { GuestAccessControl } from './guest-access-control';
import { accessTag, accessWordFor } from '@/lib/guest-access';
import { THIS_IS_ME_REFUSAL_COPY } from '@/lib/creator-couple-row';
import type { GuestCardData } from './guest-card-data';
import { inviteGuestByEmailAction, releaseGuestClaim, updateGuest } from '../[guestId]/actions';
import { invitationLinkOn } from '@/lib/invitation-link';
import { tableWords } from '@/lib/table-words';

/**
 * guest-card-body.tsx — ONE card per guest: the personal QR AND every editable
 * field, in one place, saving itself.
 *
 * ── What it replaced ────────────────────────────────────────────────────────
 * Until 2026-09-22 a guest had TWO surfaces. A read-only quick view (the sheet
 * below xl, the `?inspect=` column at ≥xl) carried the QR, and a standalone
 * route carried the form. The only way from one to the other was a link called
 * "Open full details" — a page navigation to change one RSVP. Owner, verbatim:
 * *"can we just open all of these in one pop up (mobile) and a window opens
 * from the right for desktop? so less clicks easier access."*
 *
 * ── The arrangement (owner 2026-09-30, the approved Fable designs) ──────────
 * `Setnayan-specs/prototypes/guest_card_invite_simple_2026-09-30_fable.html` +
 * `guest_card_details_2026-09-30_fable.html`, DECISION_LOG "APPROVED — THE
 * FABLE DESIGNS FOR THE GUEST CARD, THE GUEST LIST ROWS AND THE GUEST LANDING
 * PAGE":
 *
 *   TOP    their Digital ticket, small (tap → full view + Save ticket) · ONE
 *          Invite · ⋯ (Write to NFC · New QR · Unlink account) · the status
 *          line (Not sent · Not linked / ✓ Sent Sep 30 · Linked). The QR's look
 *          left the card — it is the whole event's (Maker › Details › Look).
 *   NAME   open and writable: Prefix (dropdown) · First · Middle · Last · Suffix
 *          · Shown as.
 *   then seven rows, CLOSED, each with a one-line summary — Details · RSVP ·
 *   Seat · Photos · Private note · Access · Tags. One open at a time (a native
 *   exclusive details-element accordion (`name`) — no script). Yes/No = a toggle, one
 *   choice = one dropdown, several = a dropdown with checkmarks.
 *
 * ✉ No email anywhere: the guest's address is CARRIED (hidden), never shown or
 * offered — Setnayan sends guests nothing. 🚶 "Walks with" is not on the card:
 * who walks beside whom is set in the Maker's Wedding March only (DECISION_LOG
 * 2026-09-30 "WALKING TOGETHER IS NOT BEING A COUPLE").
 *
 * 🔑 DIETARY SITS WITH MEAL. It used to live under "More details" beside email
 * and mobile; the owner's words were *"these are not contact information.
 * Dietary and meal goes together."* Same review removed the free-text
 * Relationship field from this card — `guests.relation` still exists, is still
 * written by `/guests/new`, and is still READ by the tea-ceremony page, which
 * prints it beside each elder. It simply can no longer be corrected here.
 *
 * ⚠ Nothing was dropped to shorten the card. Twelve sections became eight by
 * merging ("Invited to" is part of the RSVP question; extra seats are part of
 * the seat), not by deleting controls.
 */

const SIDE_OPTIONS: GuestSide[] = ['bride', 'groom', 'both'];
const MEAL_OPTIONS: MealPreference[] = [
  'no_preference',
  'beef',
  'chicken',
  'fish',
  'vegetarian',
  'vegan',
  'kids',
];
const RSVP_OPTIONS: RsvpStatus[] = ['attending', 'pending', 'maybe', 'declined'];
// 3D seat-plan attire. 'neutral' is the default: the avatar auto-dresses from a
// gendered wedding-party role, else stays a plain token.
const ATTIRE_OPTIONS: GuestAttire[] = ['neutral', 'gown', 'suit'];
const ATTIRE_LABELS: Record<GuestAttire, string> = {
  neutral: 'Neutral / auto',
  gown: 'Gown',
  suit: 'Suit',
};

/** The card's words for an answer (owner 2026-09-30: "no reply" / "not coming"). */
const CARD_RSVP_WORDS: Record<RsvpStatus, string> = RSVP_ROW_WORDS;


/**
 * The card's identity line and its reply, as words — ONE source for the body
 * (the standalone page) and the sticky header over the panel (owner 2026-10-02:
 * "maybe we can leave this part persistent?"), so they are drawn once each.
 */
export function guestCardEyebrow(
  guest: Pick<GuestCardData['guest'], 'role' | 'side'>,
  opts: { hasSides: boolean; roleNames: GuestCardData['roleNames'] },
): string {
  const isCouple = guest.role === 'bride' || guest.role === 'groom';
  return [isCouple ? guestRoleLabel(guest.role, opts.roleNames) : 'Guest', opts.hasSides && !isCouple ? SIDE_LABELS[guest.side] : null]
    .filter(Boolean)
    .join(' · ');
}
export function guestCardReply(guest: Pick<GuestCardData['guest'], 'role' | 'rsvp_status'>): string {
  if (guest.role === 'bride' || guest.role === 'groom') return '✓ Attending · always';
  return `${guest.rsvp_status === 'attending' ? '✓ ' : ''}${CARD_RSVP_WORDS[guest.rsvp_status]}`;
}


export const GUEST_CARD_ERROR_COPY: Record<string, string> = {
  missing_name: 'Please enter both first and last name.',
  missing_side: 'Choose which side this guest is on.',
  missing_group: 'Choose a group category for this guest.',
  invalid_role: 'Invalid role selection.',
  invalid_rsvp: 'Invalid RSVP status.',
  invalid_meal: 'Invalid meal preference.',
  // "Give this spot to someone else" (guestId/actions.ts giveSpotToSomeoneElse).
  swap_replied: 'Only a guest who has not replied can give their spot away — this guest already answered.',
  swap_needs_name: 'Type the name of the person taking the spot.',
  swap_after_day: 'The day has passed — this spot can no longer be given away.',
  swap_failed: 'The spot could not be given away just now — nothing was changed. Please try again.',
  // "Unlink" (lib/seat-unlink.ts).
  unlink_not_allowed: 'Only the couple can unlink an account from an invitation.',
  unlink_nothing_linked: 'No account holds this invitation — there is nothing to unlink.',
  unlink_holds_access:
    'That account is a Co-host or helper through this guest. Set their Access back to None first, then unlink. (On the bride, groom or celebrant row a Co-host cannot be removed here — ask Setnayan support.)',
  unlink_failed: 'The account could not be unlinked just now — nothing was changed. Please try again.',
  // The card's Table dropdown (updateGuest › syncCardTable).
  seat_failed: 'The table could not be changed just now — the rest was saved. Please try again.',
  // ⋯ › New QR (releaseGuestClaim › newGuestQr).
  new_qr_failed: 'A new QR could not be made just now — the old one still works. Please try again.',
  new_qr_rate_limited: 'This QR was already replaced 3 times in the last 24 hours — try again later.',
  // 🪪 "This is me" (releaseGuestClaim › thisIsMe › claim_my_couple_row).
  ...THIS_IS_ME_REFUSAL_COPY,
};

/**
 * The three writes the card's own forms post — the SHIPPED server actions, bound to this guest, unless a page hands others in.
 * Only the dev lab does (its stand-ins write nothing, so its card can be pressed); every real page leaves it out. A prop,
 * not an import of the lab's: this file is drawn inside the Maker's first load and must not learn about it.
 */
export type GuestCardActions = {
  /** A QUIET save (the autosave's) RETURNS `{ refused }` for a refusal; every other post redirects, as before. */
  update: (formData: FormData) => void | { refused: string } | Promise<void | { refused: string }>;
  release: (formData: FormData) => void | Promise<void>;
  partnerLink: () => void | Promise<void>;
};

export function GuestCardBody({
  eventId,
  data,
  invitationBase,
  photoDisplayUrl,
  variant,
  headerShown = false,
  returnTo,
  errorMessage,
  inviteFlash,
  inviteSetup,
  SendInvite,
  TicketThumb,
  MoreMenu,
  helperAccess,
  actions,
  kit,
}: {
  eventId: string;
  data: GuestCardData;
  /** The event's public address WITHOUT the guest's token. Null before the
   *  event has a slug — then there is no link to send, write to a tag or copy. */
  invitationBase: string | null;
  photoDisplayUrl: string | null;
  /**
   * Which frame is rendering.
   *   'page'  — the standalone route. The card owns the page heading, so the
   *             identity row carries an <h1>. Its `loading.tsx` reserves a
   *             title, and a route whose skeleton promises a heading it never
   *             draws jumps upward on land (the-skeleton-promises-only-what-
   *             the-page-draws.test.ts).
   *   'panel' — the roster's card. `InspectorColumn` already prints the name in
   *             its own header, so repeating it here would say it twice; the
   *             row keeps the face and the status line, which the header has
   *             neither of.
   */
  variant: 'page' | 'panel';
  /** The panel's sticky header already shows the eyebrow, name and reply. */
  headerShown?: boolean;
  /** Where a FAILED save should land — the surface this card is open on. */
  returnTo: string;
  errorMessage: string | null;
  inviteFlash: { ok: boolean; msg: string } | null;
  /** The event's facts and the couple's wording for Invite, read once by the page. */
  inviteSetup?: InviteSetup | null;
  /** The Invite pair itself — given with \`inviteSetup\` by the pages that draw it. */
  SendInvite?: typeof GuestInviteCell;
  /** Their ticket, small (tap → full view + Save ticket). Absent (the Maker) → a plain ticket image. */
  TicketThumb?: ComponentType<Parameters<typeof GuestTicketThumb>[0]>;
  /** The ⋯ (Write to NFC · New QR · Unlink). Absent (the Maker) → none; the Guest list has it. */
  MoreMenu?: ComponentType<Parameters<typeof GuestMoreMenu>[0]>;
  /**
   * A limited helper's grants, colour domains and activity — the Hosts pieces
   * that moved under the Access line (build F2, `guest-helper-access.tsx`).
   * Rendered by the Guest list's card screens; absent (the Maker) → none.
   */
  helperAccess?: React.ReactNode;
  /** Other writes for the card's forms — the dev lab's stand-ins. Absent = the shipped actions. */
  actions?: GuestCardActions;
  /**
   * The card's leaf controls, drawn by the app's templates (`guest-card-kit.ts`). Handed in by the Guests pages; the Maker's
   * parent cards hand none (the templates are not in the Maker's first load) and keep the hand-drawn rows below.
   */
  kit?: CardKit;
}) {
  const {
    guest,
    isCouple,
    hasSides,
    availableRoles,
    groupOptions,
    isIncWedding,
    showTeaCeremony,
    plusOneStateLabel,
    initialInvited,
    seatedAt,
    customGroups,
    recordedAt,
    access,
    canManageAccess,
    offersThisIsMe,
    nameLinked,
    linkedAccount,
    profileName,
    roleNames,
    tables,
    seatTableId,
    groupChoices,
  } = data;
  /* 👤 Whose words the name is (owner 2026-09-30): a linked account's profile
     name is fixed here — "From their account" for the couple, a way to the
     profile for the person themself. A plus-one's link keeps its own words. */
  const nameLockWords = profileName ? (profileName.isYou ? null : PROFILE_NAME_WORDS) : nameLinked ? LINKED_NAME_WORDS : null;
  const nameLocked = Boolean(profileName) || nameLinked;
  // The five parts as one line — the same formal name the list prints.
  const lockedName = composeFormalName(guest) ?? guestDisplayName(guest);
  const accessTagLabel = access ? accessTag(access) : null;

  const K: CardKit = kit ?? OLD_KIT;
  /** True when the templates draw the leaves — their helper sentences go behind each row's ⓘ, not beside the control. */
  const templated = kit !== undefined;
  const updateAction = actions?.update ?? updateGuest.bind(null, eventId, guest.guest_id);
  const releaseAction = actions?.release ?? releaseGuestClaim.bind(null, eventId, guest.guest_id);
  const partnerLinkAction = actions?.partnerLink ?? inviteGuestByEmailAction.bind(null, eventId, guest.guest_id);

  const name = guestDisplayName(guest);
  const inviteUrl = invitationBase && guest.qr_token ? invitationLinkOn(invitationBase, guest.qr_token) : null;
  // Linked is known only to the couple (it reads another account); anyone else is told nothing either way.
  const linked: boolean | null = canManageAccess ? Boolean(linkedAccount) : null;
  const hasTicket = guestHasTicket(guest);
  const seats = plusOneSeats(guest);
  // The creator is the Host; a couple row someone chose is a Co-host (owner 2026-10-04).
  const hostWord = access?.level === 'co_host' ? accessWordFor(access) : 'Host';

  const more = MoreMenu ? (
    <MoreMenu
      eventId={eventId}
      guestId={guest.guest_id}
      guestName={name}
      nfcUrl={inviteUrl}
      linked={Boolean(linkedAccount)}
      returnTo={returnTo}
      deletable={!isCouple}
    />
  ) : null;

  // ── the one-line summaries of the closed rows ──
  const roleWord = guestRoleLabel(guest.role, roleNames);
  const detailsSummary = [
    hasSides ? SIDE_LABELS[guest.side] : null,
    GROUP_CATEGORY_LABELS[guest.group_category],
    isCouple ? `${roleWord} · locked` : roleWord,
  ]
    .filter(Boolean)
    .join(' · ');
  const rsvpSummary = isCouple
    ? 'Attending · always'
    : [
        CARD_RSVP_WORDS[guest.rsvp_status],
        guest.meal_preference && guest.meal_preference !== 'no_preference' ? MEAL_LABELS[guest.meal_preference] : null,
        seats > 0 ? `+${seats}` : null,
        guest.guest_note?.trim() ? 'a note from them' : null,
      ]
        .filter(Boolean)
        .join(' · ');
  const seatSummary = seatedAt ? tableWords(seatedAt) : guest.rsvp_status === 'declined' ? 'Not coming' : 'Not seated';
  const photosSummary = `Tagging ${guest.photo_consent ? 'on' : 'off'}${guest.faceblock_enabled ? ' · Blurred' : ''}`;
  const accessSummary = [
    linked === null ? null : linked ? 'Linked' : 'Not linked',
    access ? accessWordFor(access) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const tagWords = [
    hasSides ? SIDE_LABELS[guest.side] : null,
    GROUP_CATEGORY_LABELS[guest.group_category],
    roleWord,
    seatedAt ? tableWords(seatedAt) : null,
    accessTagLabel ? `+${accessTagLabel}` : null,
    ...customGroups.map((g) => g.label),
  ].filter((t): t is string => Boolean(t));

  // "Also serves as" — every offered role but the one they hold, the one-per-event
  // roles and plain "Guest", under the Role picker's own headings in the couple's words.
  const extraRoleOptions = availableRoles
    .filter((r) => r !== guest.role && r !== 'guest' && !SINGLETON_GUEST_ROLES.includes(r))
    .map((r) => {
      const g = roleGroupOf(r);
      return {
        key: r,
        label: guestRoleLabel(r, roleNames),
        group: g === 'guest' ? 'Other roles' : roleGroupLabel(g, roleNames),
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group));
  const extraRolesNow = (guest.extra_roles ?? []).filter((r) => extraRoleOptions.some((o) => o.key === r));

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <p
          role="alert"
          className="text-sm font-semibold text-danger-700"
        >
          {errorMessage}
        </p>
      ) : null}
      {inviteFlash ? (
        <p
          role={inviteFlash.ok ? 'status' : 'alert'}
          className={
            inviteFlash.ok
              ? 'rounded-md border border-success-300/60 bg-success-50 px-4 py-2.5 text-sm text-success-800'
              : 'text-sm font-semibold text-danger-700'
          }
        >
          {inviteFlash.msg}
        </p>
      ) : null}

      {/* Identity — who, whose side, and the answer at a glance. */}
      <div className="flex items-center gap-3">
        {photoDisplayUrl ? (
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sn-accent/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL, resolved by the loader */}
            <img src={photoDisplayUrl} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sn-accent/10 text-sm font-semibold text-sn-accent">
            {guestInitials(guest)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {/* Over the Guest list the eyebrow, the name and the reply live in
              the panel's STICKY header (`headerShown`, InspectorColumn) — drawn
              there once, not twice. The standalone page and the Maker's parent
              cards have no such header, so they draw them here. */}
          {headerShown ? null : (
            <p className="sn-eye">
              {guestCardEyebrow(guest, { hasSides, roleNames })}
            </p>
          )}
          {variant === 'page' ? (
            <h1 className="truncate font-display text-2xl tracking-tight text-ink">{name}</h1>
          ) : null}
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            {!headerShown ? (
              <span className="rounded-full bg-success-50 px-2 py-0.5 font-medium text-success-800 ring-1 ring-success-200">
                {guestCardReply(guest)}
              </span>
            ) : null}
            {seats > 0 && !isCouple ? (
              <span className="rounded-full px-2 py-0.5 text-ink/70 ring-1 ring-ink/15">+{seats}</span>
            ) : null}
            {isCouple ? <span className="rounded-full px-2 py-0.5 text-ink/70 ring-1 ring-ink/15">Host</span> : null}
          </p>
        </div>
      </div>

      {/* ── TOP · their ticket, Invite · ⋯, the status line ─────────────────
          Outside the autosave form: Invite and ⋯ bring their own actions.
          `data-menus-open-below` (lib/menu-place.ts): the Invite and ⋯ lists
          open UNDER this row and inside the card's edges, so neither covers
          the ticket, "Tap to view" or the status line (owner 2026-10-04). */}
      <section className="flex items-start gap-3.5 border-b border-ink/10 pb-4" data-guest-card-top="" data-menus-open-below="">
        {TicketThumb ? (
          <TicketThumb guestId={guest.guest_id} name={name} available={hasTicket} />
        ) : hasTicket ? (
          // eslint-disable-next-line @next/next/no-img-element -- the guest's own ticket route, drawn by the server
          <img
            src={`${PASS_CARD_ROUTE}?guest=${encodeURIComponent(guest.guest_id)}`}
            alt={`${name}'s ticket`}
            width={92}
            height={123}
            loading="lazy"
            className="aspect-[3/4] w-[92px] shrink-0 rounded-lg bg-white object-cover ring-1 ring-ink/10"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            {/* ⚖ ONE LABEL STYLE ON THE CARD (owner 2026-10-04): every section
                label is the eyebrow's own `.sn-eye`. And plain words: "Me" is
                the guest's own tab on the Event Hub — a host reading this card
                does not know that name, so it says where they see it. */}
            <p className="sn-eye">Their ticket</p>
            <p className="mt-1 text-[13px] leading-snug text-ink/65">
              {isCouple ? 'A host — nothing to send.' : 'What they see on their phone.'}
            </p>
          </div>
          {/* 🕯 Nothing is offered for a guest marked Passed away, and the couple
              do not invite themselves. */}
          {inviteSetup && SendInvite && !guest.passed_away && !isCouple ? (
            <SendInvite
              eventId={eventId}
              layout="card"
              more={more}
              linked={linked}
              guest={{
                guestId: guest.guest_id,
                formalName: guestFullName(guest, inviteSetup.facts.nameStyle),
                firstName: guest.first_name,
                fullName: name,
                inviteUrl,
                sentAt: guest.invitation_sent_at,
                hasTicket,
              }}
              facts={inviteSetup.facts}
              template={inviteSetup.template}
            />
          ) : (
            <div className="space-y-1">
              {more}
              <p className="text-xs text-ink/60" data-guest-invite-status="">
                {[
                  linked === null ? null : linked ? '✓ Linked' : 'Not linked',
                  isCouple ? hostWord : guest.passed_away ? 'Not sent · passed away' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
              {/* 🪪 The creator's own unlinked bride / groom row (owner 2026-10-04):
                  one action, in place — it attaches the creator's membership to
                  this row (claim_my_couple_row re-checks everything). */}
              {offersThisIsMe ? (
                <form action={releaseAction} data-this-is-me="">
                  <input type="hidden" name="this_is_me" value="1" />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <K.Submit pendingLabel="Saving…">This is me</K.Submit>
                </form>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <AutosaveForm action={updateAction} returnTo={returnTo} className="space-y-4">
        {/* ── NAME · open, and saves itself (no caption — owner 2026-10-03) ── */}
        <section className="space-y-2.5" data-guest-card-name="">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="sn-eye">Name · mobile</h2>
            <span className="flex items-center gap-2 text-xs text-ink/45">
              <K.SaveState copy={templated ? GUEST_CARD_ERROR_COPY : undefined} />
            </span>
          </div>
          {/* 🔒 A linked person keeps their own name — a plus-one who linked
              (owner 2026-09-29, OWNER ANSWERS (10)) or any row whose account's
              profile holds a formal name (owner 2026-09-30): read-only here, and
              `updateGuest` leaves the name out of its write. The stored parts
              still post, so the form's own checks are satisfied. */}
          <K.List>
            {nameLocked ? (
              <div data-guest-name-linked="">
                <p className="text-sm text-ink">
                  <span className="font-medium">{lockedName}</span>
                  {nameLockWords ? <span className="text-ink/60"> · {nameLockWords}</span> : null}
                  {profileName?.isYou ? (
                    <>
                      {' · '}
                      <Link href="/dashboard/profile" className="text-sn-accent underline-offset-2 hover:underline">
                        Edit on your profile ›
                      </Link>
                    </>
                  ) : null}
                </p>
                <input type="hidden" name="first_name" value={guest.first_name} />
                <input type="hidden" name="last_name" value={guest.last_name} />
                <input type="hidden" name="name_prefix" value={guest.name_prefix ?? ''} />
                <input type="hidden" name="middle_name" value={guest.middle_name ?? ''} />
                <input type="hidden" name="name_suffix" value={guest.name_suffix ?? ''} />
                <input type="hidden" name="display_name" value={guest.display_name ?? ''} />
              </div>
            ) : (
              <>
                <K.Cols className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                  <K.Pick
                    name="name_prefix"
                    label="Prefix"
                    value={guest.name_prefix ?? ''}
                    options={[{ key: '', label: '—' }, ...prefixChoicesFor(guest.name_prefix).map((p) => ({ key: p, label: p }))]}
                  />
                  <K.Field id="first_name" label="First" required defaultValue={guest.first_name} />
                  <K.Field id="middle_name" label="Middle" defaultValue={guest.middle_name ?? ''} />
                </K.Cols>
                <K.Cols className="grid grid-cols-[minmax(0,1fr)_minmax(0,5.5rem)] gap-2">
                  <K.Field id="last_name" label="Last" required defaultValue={guest.last_name} />
                  <K.Field id="name_suffix" label="Suffix" defaultValue={guest.name_suffix ?? ''} placeholder="—" />
                </K.Cols>
                <K.Field
                  id="display_name"
                  label="Shown as (optional)"
                  defaultValue={guest.display_name ?? ''}
                  placeholder="e.g. Tito Boy & Tita Cora"
                />
              </>
            )}
            {/* 📱 THEIR MOBILE, UP FRONT (owner, live iPhone test 2026-10-02: "the
                guest's mobile number is hard to find on the guest card"). It sat
                inside the closed Details row; the first section is the one a
                phone opens on, so the way to reach them is here, under the name. */}
            <K.Field id="mobile" label="Mobile" type="tel" defaultValue={guest.mobile ?? ''} placeholder="+63 …" />
          </K.List>
        </section>

        <div className="border-y border-ink/10">
          {/* ── DETAILS — side, group, role, extra roles, groups ───────────── */}
          <K.Fold summary="Details" value={detailsSummary}>
            <K.Cols className="grid grid-cols-2 gap-2.5">
              {hasSides ? (
                <K.Pick
                  name="side"
                  label="Side"
                  value={guest.side}
                  options={SIDE_OPTIONS.map((v) => ({ key: v, label: SIDE_LABELS[v] }))}
                />
              ) : null}
              <K.Pick
                name="group_category"
                label="Group"
                value={guest.group_category}
                options={groupOptions.map((v) => ({ key: v, label: GROUP_CATEGORY_LABELS[v] }))}
              />
            </K.Cols>
            {isCouple ? (
              <>
                <K.Locked label={hasSides ? 'Role in wedding' : 'Role'} value={roleWord} note="Foundation · locked" />
                <input type="hidden" name="role" value={guest.role} />
              </>
            ) : (
              <K.Cols className="space-y-1">
                <K.Pick
                  name="role"
                  label={hasSides ? 'Role in wedding' : 'Role'}
                  about={isIncWedding ? 'INC note: non-member principal sponsors (Ninong/Ninang) are limited to one pair. Member sponsors aren’t capped.' : undefined}
                  value={guest.role}
                  /* ⚖ Owner 2026-09-30: best man OR best woman, maid OR
                     matron of honour — each pair sits under ONE heading so
                     the two words read as the alternatives they are. */
                  options={pickItems(availableRoles).flatMap((it) =>
                    it.kind === 'pair'
                      ? it.roles.map((v) => ({ key: v, label: guestRolePickLabel(v, roleNames), group: it.heading }))
                      : [{ key: it.role, label: guestRolePickLabel(it.role, roleNames) }],
                  )}
                />
                {isIncWedding && !templated ? (
                  <p className="text-xs text-ink/55">
                    INC note: non-member principal sponsors (Ninong/Ninang) are
                    limited to one pair. Member sponsors aren&rsquo;t capped.
                  </p>
                ) : null}
              </K.Cols>
            )}
            {/* ✓ Checkmark dropdowns (owner 2026-09-30 "yes"): extra roles and
                the couple's own groups, editable right here. */}
            {isCouple ? null : (
              <>
                <input type="hidden" name="extra_roles_posted" value="1" />
                <K.Pick
                  name="extra_roles"
                  label="Also serves as"
                  value={extraRolesNow.join(',')}
                  options={extraRoleOptions}
                  multi
                />
              </>
            )}
            {groupChoices ? (
              groupChoices.options.length > 0 ? (
                <>
                  <input type="hidden" name="groups_posted" value="1" />
                  <K.Pick
                    name="group_ids"
                    label="Groups"
                    value={groupChoices.memberIds.join(',')}
                    options={groupChoices.options.map((g) => ({ key: g.groupId, label: g.label }))}
                    multi
                  />
                </>
              ) : (
                <p className="text-xs text-ink/55">No groups yet — make one from the Guest list&rsquo;s Group dropdown.</p>
              )
            ) : customGroups.length > 0 ? (
              <p className="text-sm text-ink/70">Groups: {customGroups.map((g) => g.label).join(', ')}</p>
            ) : null}
            {/* ✉ Carried, never shown: no email to guests (owner 2026-09-30).
                `updateGuest` writes every column it reads, so a dropped input
                would erase the address a guest's own account linked with. */}
            <input type="hidden" name="email" value={guest.email ?? ''} />
            {/* Chinese / Tsinoy rites only. Fails CLOSED: a refused ceremony read
                degrades to null and this hides. */}
            {showTeaCeremony ? (
              <K.Field
                id="seniority_rank"
                label="Tea-ceremony order"
                type="number"
                defaultValue={guest.seniority_rank !== null ? String(guest.seniority_rank) : ''}
                placeholder="Lower serves first"
              />
            ) : (
              // Hidden ≠ cleared: this form posts every column, so a field that
              // is not rendered is a field that gets written as null.
              <input
                type="hidden"
                name="seniority_rank"
                value={guest.seniority_rank !== null ? String(guest.seniority_rank) : ''}
              />
            )}
            {/* 🚨 RELATION IS CARRIED, NOT EDITED (owner 2026-09-22) — the
                tea-ceremony page still reads it; see the-card-posts-every-column. */}
            <input type="hidden" name="relation" value={guest.relation ?? ''} />
            {/* 🕯 PASSED AWAY — listed, never counted (owner 2026-09-25). Never
                offered for the couple — `updateGuest` refuses it for them too. */}
            {isCouple ? null : (
              <K.Toggle
                name="passed_away"
                defaultChecked={guest.passed_away === true}
                label="Passed away"
                note="Kept on the list as “the late …”. Not counted, seated or sent an invitation."
                soft
              />
            )}
          </K.Fold>

          {/* ── RSVP — the answer, to what, and what they eat ─────────────── */}
          <K.Fold summary="RSVP" value={rsvpSummary} open={Boolean(guest.guest_note?.trim())}>
            {isCouple ? (
              <>
                <p className="text-sm font-medium text-success-800">Attending · always</p>
                <p className="text-xs text-ink/50">The couple is the foundation of the event.</p>
                {/* 🔴 AND NO "Answer recorded" LINE: the action coerces bride and
                    groom to attending, so their stamp only says when a host saved. */}
                <input type="hidden" name="rsvp_status" value="attending" />
              </>
            ) : (
              /* Attending · No reply · Not coming (owner 2026-09-30 — no Maybe).
                 A guest who already answered Maybe keeps it listed, so opening
                 the card never rewrites their answer. */
              <K.Pick
                name="rsvp_status"
                label="Reply"
                value={guest.rsvp_status}
                options={RSVP_OPTIONS.filter((v) => v !== 'maybe' || guest.rsvp_status === 'maybe').map((v) => ({
                  key: v,
                  label: CARD_RSVP_WORDS[v],
                }))}
              />
            )}
            {/* "Recorded", not "replied" — three of the column's four writers are
                host-side. Only when there IS one, and 🔴 never for the couple. */}
            {!isCouple && recordedAt ? (
              <p className="text-xs text-ink/50">Answer recorded {recordedAt}</p>
            ) : null}

            {/* Smart defaults by role · locked 2026-05-23 PM — changing the
                Role snaps these to that role's usual set. */}
            <K.InvitedTo roleSelectId="role" initialRole={guest.role} initialBlocks={initialInvited} />

            <span className="block pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">Seats and food</span>
            <K.Cols className="grid grid-cols-2 gap-2.5">
              {/* ⚖ Owner 2026-09-21: "+1 per guest can be up to number 4". */}
              {isCouple ? (
                <input type="hidden" name="plus_one_count" value={String(seats)} />
              ) : (
                <K.Pick
                  name="plus_one_count"
                  label="Extra seats"
                  value={String(seats)}
                  options={PLUS_ONE_CHOICES.map((n) => ({ key: String(n), label: n === 0 ? 'None' : `+${n}` }))}
                />
              )}
              {/* 🔑 DIETARY BELONGS WITH MEAL — owner 2026-09-22. */}
              <K.Pick
                name="meal_preference"
                label="Meal"
                value={guest.meal_preference ?? 'no_preference'}
                options={MEAL_OPTIONS.map((v) => ({ key: v, label: MEAL_LABELS[v] }))}
              />
            </K.Cols>
            {isCouple ? null : plusOneStateLabel ? (
              <p className="rounded-lg bg-success-50/70 px-3 py-2 text-xs text-success-900">+1: {plusOneStateLabel}</p>
            ) : guest.plus_one_allowed ? (
              <p className="rounded-lg bg-warn-50/70 px-3 py-2 text-xs text-warn-900">Allowed, but no +1 added yet.</p>
            ) : null}
            <K.Field
              id="dietary_restrictions"
              label="Dietary"
              defaultValue={guest.dietary_restrictions ?? ''}
              placeholder="halal · nut allergy · …"
            />
          </K.Fold>

          {/* ── SEAT — the table, in place (never "go edit elsewhere") ──────── */}
          <K.Fold summary="Seat" value={seatSummary}>
            {tables && !guest.passed_away && guest.rsvp_status !== 'declined' ? (
              <>
                <K.Pick
                  name="table_id"
                  label="Table"
                  value={seatTableId ?? ''}
                  options={[
                    { key: '', label: 'Not seated' },
                    ...tables.map((t) => ({ key: t.tableId, label: tableWords(t.label) })),
                  ]}
                />
                <input type="hidden" name="table_posted" value="1" />
              </>
            ) : (
              <p className="text-sm text-ink/70">{seatSummary}</p>
            )}
            <K.Pick
              name="attire"
              label="Attire · 3D seat plan"
              about="Guests see their table on the day, not before. Moving them here moves them on the seat plan too."
              value={guest.attire}
              options={ATTIRE_OPTIONS.map((v) => ({ key: v, label: ATTIRE_LABELS[v] }))}
            />
            {templated ? null : (
              <p className="text-xs text-ink/55">
                Guests see their table on the day, not before. Moving them here moves them on the seat plan too.
              </p>
            )}
          </K.Fold>

          {/* ── PHOTOS — three yes/no answers ───────────────────────────────── */}
          <K.Fold summary="Photos" value={photosSummary}>
            <K.Toggle
              name="photo_consent"
              defaultChecked={guest.photo_consent}
              label="Wants to be tagged in photos"
              note="Their consent (RA 10173)"
            />
            {/* Salamisim P2 (iteration 0012) — the Live Photo Wall then needs a
                server-baked blur on EVERY projected photo, fail-closed. */}
            <K.Toggle
              name="faceblock_enabled"
              defaultChecked={guest.faceblock_enabled}
              label="Blur their face on the Live Wall"
              note="FaceBlock — blurs every face in the shot"
            />
            {/* Minor safeguard (DPIA BV-8, 2026-07-05) — a host attestation. */}
            <K.Toggle
              name="face_recognition_excluded"
              defaultChecked={guest.face_recognition_excluded}
              label="Keep out of face recognition"
              note="e.g. a minor"
            />
          </K.Fold>

          {/* ── PRIVATE NOTE — the couple's own, never the guest's ─────────── */}
          <K.Fold summary="Private note" value={guest.notes?.trim() || null} emptyValue="None" last>
            <K.Field
              id="notes"
              long
              label="Private note"
              defaultValue={guest.notes ?? ''}
              placeholder="e.g. Tito’s driver drops him at the side gate"
              about={`Only you and your co-hosts see this. ${guest.first_name} never sees it.`}
            />
            {/* Said out loud, because until 2026-08-06 it was the opposite of true. */}
            {templated ? null : (
              <p className="text-xs text-ink/50">
                Only you and your co-hosts see this. {guest.first_name} never sees it.
              </p>
            )}
          </K.Fold>
        </div>

        {/* 🔴 The guest's own message. Read-only: it is theirs, not yours to
            edit, and it stays OUT of every drawer — a host must never have to
            guess to open one to read what a guest wrote. */}
        {guest.guest_note?.trim() ? (
          <div className="space-y-1.5 border-l-2 border-ink/15 pl-3">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
              A note from {guest.first_name}
            </span>
            <p className="whitespace-pre-wrap font-display text-[15px] italic text-ink/80">“{guest.guest_note}”</p>
            <p className="text-xs text-ink/50">They wrote this when they replied. Only they can change it.</p>
          </div>
        ) : null}
      </AutosaveForm>

      {/* ── ACCESS — its own actions, so OUTSIDE the autosave form (a nested
          <form> is invalid HTML). Same accordion as the rows above. */}
      <div className="border-y border-ink/10">
        <K.Fold summary="Access" value={accessSummary || null} emptyValue="—">
          {/* A refused read (access === null) shows nothing, never "Guest only". */}
          {access ? (
            <GuestAccessControl
              eventId={eventId}
              guestId={guest.guest_id}
              firstName={guest.first_name}
              initial={access}
              canManage={canManageAccess}
            />
          ) : null}
          {helperAccess ?? null}
          {linked === null ? null : (
            <div className="space-y-0.5 pt-1" data-unlink-account="">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">Account</span>
              <p className="text-sm text-ink">
                {linked ? `Linked${linkedAccount?.email ? ` — ${linkedAccount.email}` : ''}` : 'Not linked'}
              </p>
              <p className="text-xs text-ink/50">
                {linked ? 'Unlink account is in the ⋯ menu at the top.' : 'When they link, it shows here.'}
              </p>
            </div>
          )}

          {/* ── The careful actions — explicit, never autosaved, each its own
              <form>. THE SECOND TAP IS THE GUARD on Remove. */}
          {isCouple ? (
            <div className="space-y-2 border-t border-ink/10 pt-3">
              {/* ✉ THE ONE EMAIL LEFT, AND ONLY HERE — a couple row (owner
                  2026-09-30: no email to GUESTS). It is the only way the
                  partner's own bride / groom row can be claimed by their
                  account (a couple seat refuses every other link;
                  lib/seat-link-approval.ts). Never offered while linked. */}
              {canManageAccess && !linkedAccount && guest.email ? (
                <form action={partnerLinkAction} data-partner-sign-in="">
                  <K.Submit pendingLabel="Sending…">{`Send ${guest.first_name} their sign-in link`}</K.Submit>
                </form>
              ) : null}
              <p className="text-xs text-ink/50">Foundation of the event — can&rsquo;t be removed.</p>
            </div>
          ) : (
            <div className="space-y-2 border-t border-ink/10 pt-3">
              {/* 🔁 GIVE THIS SPOT TO SOMEONE ELSE (owner 2026-09-26) — only for a
                  guest who has NOT replied. Rides the release door (`swap_name`). */}
              {guest.rsvp_status === 'pending' ? (
                <form action={releaseAction} className="space-y-2" data-give-spot="">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <K.Tip label="Give this spot to someone else">
                      The new person takes this guest&rsquo;s table, seats and place in the count.{' '}
                      {name}&rsquo;s link and QR stop working; they are not notified. Guests who
                      already replied cannot be swapped.
                    </K.Tip>
                  </p>
                  <label className="block">
                    <span className="text-xs font-medium text-ink/60">Who takes it?</span>
                    <input
                      name="swap_name"
                      required
                      autoComplete="off"
                      placeholder="First and last name"
                      className="input-field mt-1 w-full"
                    />
                  </label>
                  <K.Submit main pendingLabel="Giving the spot…">
                    Give the spot
                  </K.Submit>
                </form>
              ) : null}
              {/* Owner ruling 2026-08-06: "the couple has full control of their
                  guests." Rotation FIRST, then the claim is let go. */}
              <form action={releaseAction}>
                <K.Submit ariaLabel={`Take back ${name}'s seat — new QR and unlink their account`} pendingLabel="Taking back…">
                  Take this seat back
                </K.Submit>
              </form>
              <p className="text-xs text-ink/50">
                Give this spot: only while they have not replied. Take back: a new QR, and their account is unlinked.
              </p>
            </div>
          )}
        </K.Fold>

        {/* ── TAGS — read-only, made from the fields above; never opens ───── */}
        <div className="flex items-start gap-3 border-t border-ink/[0.06] px-3.5 py-3 text-sm" data-guest-card-tags="">
          <span className="font-medium text-ink">Tags</span>
          <span className="ml-auto min-w-0 text-right text-ink/55">{tagWords.join(' · ')}</span>
        </div>
      </div>
    </div>
  );
}

// ── local pieces ────────────────────────────────────────────────────────────

/**
 * ONE ROW OF THE CARD — closed, with a one-line summary; open, its fields.
 * A native details element in ONE exclusive group (`name="guest-card-row"`), so
 * opening a row closes the one that was open — the card never grows long, and
 * there is no script to load (the card is in the Maker's first load too).
 */
function Fold({ summary, value, emptyValue, open = false, last = false, children }: CardFoldProps) {
  return (
    <details name="guest-card-row" open={open || undefined} className={`group ${last ? '' : 'border-b border-ink/[0.06]'}`}>
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 px-3.5 text-sm text-ink transition-colors hover:bg-ink/[0.03]">
        <span className="font-medium">{summary}</span>
        <span className="ml-auto min-w-0 truncate text-ink/55">
          {value ?? <span className="italic text-ink/40">{emptyValue ?? '—'}</span>}
        </span>
        <span aria-hidden className="text-ink/40 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="gl-disc space-y-3 border-t border-ink/[0.06] bg-ink/[0.02] px-3.5 py-3.5">{children}</div>
    </details>
  );
}

/** A yes/no answer, as a switch. A real checkbox underneath (posts `on`). */
function Toggle({ name, defaultChecked, label, note, soft = false }: CardToggleProps) {
  return (
    <label
      className={`flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
        soft ? 'bg-ink/[0.03] text-ink/75' : 'border border-ink/10 bg-white/70 text-ink'
      }`}
    >
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-ink/55">{note}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="sn-switch" />
    </label>
  );
}

function Field({ id, label, required = false, type = 'text', defaultValue, placeholder, long = false }: CardFieldProps) {
  if (long) {
    return (
      <textarea
        id={id}
        name={id}
        rows={3}
        aria-label={label}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="input-field min-h-[88px] resize-y py-2"
      />
    );
  }
  return (
    <div className="min-w-0 space-y-1">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

/* ── the hand-drawn kit: what the Maker's parent cards draw (the templates are not in the Maker's first load) ────────────────── */

function OldPick({ about, ...pick }: CardPickProps) {
  void about; // the old kit prints the sentence beside the control (the body does), not behind an ⓘ
  return <FormPick {...pick} />;
}
function OldInvitedTo({ roleSelectId, initialRole, initialBlocks }: CardInvitedToProps) {
  return (
    <div className="space-y-1">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">Invited to</span>
      <InvitedToChips roleSelectId={roleSelectId} initialRole={initialRole as GuestRole} initialBlocks={initialBlocks as InvitedToBlock[] | undefined} look="toggles" />
    </div>
  );
}
function OldLocked({ label, value, note }: CardLockedProps) {
  return (
    <div className="space-y-1">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">{label}</span>
      <div className="flex min-h-10 items-center justify-between rounded-full border border-ink/15 bg-ink/[0.03] px-3 text-sm">
        <span className="font-medium text-ink">{value}</span>
        <span className="text-xs text-ink/45">{note}</span>
      </div>
    </div>
  );
}
function OldList({ children }: CardBoxProps) {
  return <div className="space-y-2.5">{children}</div>;
}
function OldCols({ className, children }: CardBoxProps) {
  return <div className={className}>{children}</div>;
}
function OldSubmit({ main = false, pendingLabel, ariaLabel, children }: CardSubmitProps) {
  return (
    <SubmitButton
      className={
        main
          ? 'button-primary w-full'
          : 'block min-h-[44px] w-full rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/75 transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-60'
      }
      aria-label={ariaLabel}
      pendingLabel={pendingLabel}
    >
      {children}
    </SubmitButton>
  );
}
function OldTip({ label, children }: CardTipProps) {
  return (
    <InfoTip label={label} align="start">
      {children}
    </InfoTip>
  );
}
const OLD_KIT: CardKit = {
  Field,
  Toggle,
  Fold,
  Pick: OldPick,
  InvitedTo: OldInvitedTo,
  Locked: OldLocked,
  Submit: OldSubmit,
  Tip: OldTip,
  SaveState: AutosaveState,
  List: OldList,
  Cols: OldCols,
};
