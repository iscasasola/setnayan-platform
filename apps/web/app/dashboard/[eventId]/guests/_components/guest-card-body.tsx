import Link from 'next/link';
import {
  Armchair,
  ArrowRight,
  Camera,
  Check,
  EyeOff,
  Tag,
  Users,
  UserX,
} from 'lucide-react';
import { SIDE_CHIP_SOFT } from '@/lib/side-colors';
import {
  guestDisplayName,
  guestInitials,
  GROUP_CATEGORY_LABELS,
  MEAL_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  type GuestGroupCategory,
  type GuestSide,
  type GuestAttire,
  type MealPreference,
  type RsvpStatus,
  PLUS_ONE_CHOICES,
  plusOneSeats,
} from '@/lib/guests';
import { SubmitButton } from '@/app/_components/submit-button';
import { InvitedToChips } from './invited-to-chips';
import { GuestQrCard } from './guest-detail-body';
import { RemoveGuestConfirm } from './remove-guest-confirm';
import { AutosaveForm, AutosaveState } from './guest-card-autosave';
import type { GuestCardData } from './guest-card-data';
import {
  inviteGuestByEmailAction,
  releaseGuestClaim,
  updateGuest,
} from '../[guestId]/actions';

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
 * ── The arrangement, and why it is this ─────────────────────────────────────
 * Ordered by what the couple actually does, then corrected by the owner on the
 * prototype (`Setnayan/prototypes/guest_card_panel_2026-09-22.html`):
 *
 *   1 Invitation — the QR sits ABOVE the name. It is the thing you send them.
 *   2 Details    — name · email & mobile · private note, one line each
 *   3 RSVP       — status · invited to · meal · DIETARY
 *   4 Seat       — table · extra seats · attire
 *   5 Party      — side · group · role
 *   6 Privacy    — photo consent · FaceBlock · face recognition
 *   7 Tags       — read-only, derived from everything above
 *   8 Remove     — never autosaved
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
const GROUP_OPTIONS: GuestGroupCategory[] = [
  'family',
  'friends',
  'work',
  'school',
  'officiant',
  'other',
];
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

const SIDE_CHIP_TINT = SIDE_CHIP_SOFT;

const RSVP_PILL_CLASS: Record<RsvpStatus, string> = {
  attending:
    'has-[:checked]:bg-success-600 has-[:checked]:text-cream has-[:checked]:border-success-700',
  pending:
    'has-[:checked]:bg-warn-100 has-[:checked]:text-warn-900 has-[:checked]:border-warn-400',
  maybe:
    'has-[:checked]:bg-warn-100 has-[:checked]:text-warn-900 has-[:checked]:border-warn-400',
  declined:
    'has-[:checked]:bg-danger-100 has-[:checked]:text-danger-900 has-[:checked]:border-danger-400',
};

export const GUEST_CARD_ERROR_COPY: Record<string, string> = {
  missing_name: 'Please enter both first and last name.',
  missing_side: 'Choose which side this guest is on.',
  missing_group: 'Choose a group category for this guest.',
  invalid_role: 'Invalid role selection.',
  invalid_rsvp: 'Invalid RSVP status.',
  invalid_meal: 'Invalid meal preference.',
};

export function GuestCardBody({
  eventId,
  data,
  invitationBase,
  brandedQrActive,
  photoDisplayUrl,
  returnTo,
  errorMessage,
  inviteFlash,
}: {
  eventId: string;
  data: GuestCardData;
  /** The event's public address WITHOUT the guest's token. Null before the
   *  event has a slug, in which case the QR card keeps its Invitation-page
   *  doorway instead of the Download · NFC · Copy strip. */
  invitationBase: string | null;
  brandedQrActive: boolean;
  photoDisplayUrl: string | null;
  /** Where a FAILED save should land — the surface this card is open on. */
  returnTo: string;
  errorMessage: string | null;
  inviteFlash: { ok: boolean; msg: string } | null;
}) {
  const {
    guest,
    isCouple,
    hasSides,
    availableRoles,
    isIncWedding,
    showTeaCeremony,
    plusOneStateLabel,
    plusOneGuestId,
    initialInvited,
    seatedAt,
    customGroups,
    recordedAt,
  } = data;

  const updateAction = updateGuest.bind(null, eventId, guest.guest_id);
  const releaseAction = releaseGuestClaim.bind(null, eventId, guest.guest_id);
  const inviteAction = inviteGuestByEmailAction.bind(null, eventId, guest.guest_id);

  const contactSummary = guest.email ?? guest.mobile ?? null;

  return (
    <div className="space-y-5">
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-2.5 text-sm text-terracotta-700"
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
              : 'rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-2.5 text-sm text-terracotta-700'
          }
        >
          {inviteFlash.msg}
        </p>
      ) : null}

      {/* Identity. The NAME is above the QR; the editable name FIELDS are
          below it, under Details — which is what "place the QR on top of the
          name" asked for. */}
      <div className="flex items-center gap-3">
        {photoDisplayUrl ? (
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-terracotta/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL, resolved by the loader */}
            <img src={photoDisplayUrl} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-sm font-semibold text-terracotta-700">
            {guestInitials(guest)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-ink">
            {guestDisplayName(guest)}
          </h2>
          <p className="mt-0.5 truncate text-xs text-ink/55">
            {[
              RSVP_LABELS[guest.rsvp_status],
              hasSides ? SIDE_LABELS[guest.side] : null,
              ROLE_LABELS[guest.role],
              seatedAt,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/35 sm:block">
          {guest.public_id}
        </span>
      </div>

      {/* ── 1 · INVITATION ─────────────────────────────────────────────────
          The QR is above the name (owner 2026-09-22). Its own <form> for the
          sign-in link, and it must stay OUTSIDE the autosave form below —
          a nested <form> is invalid HTML and the repo lints against it. */}
      <section className="space-y-3">
        <GuestQrCard
          guest={guest}
          eventId={eventId}
          invitationBase={invitationBase}
          brandedQrActive={brandedQrActive}
        />
        <div className="overflow-hidden rounded-lg border border-ink/10">
          {guest.email ? (
            <form action={inviteAction}>
              <SubmitButton
                className="flex w-full items-center gap-3 border-b border-ink/[0.06] px-3.5 py-3 text-left text-sm text-ink transition-colors hover:bg-ink/[0.03] disabled:opacity-60"
                pendingLabel="Sending…"
              >
                <span>Email a sign-in link</span>
                <span className="ml-auto truncate text-ink/50">{guest.email}</span>
              </SubmitButton>
            </form>
          ) : (
            // Said, not hidden: `inviteGuestByEmailAction` redirects with
            // ?invite=no_email when there is no address, so the row says so
            // up front rather than failing after the tap.
            <p className="flex items-center gap-3 border-b border-ink/[0.06] px-3.5 py-3 text-sm text-ink/45">
              <span>Email a sign-in link</span>
              <span className="ml-auto italic">No email yet</span>
            </p>
          )}
          <Link
            href={`/dashboard/${eventId}/studio/custom-qr-guest`}
            className="flex items-center gap-3 px-3.5 py-3 text-sm text-ink transition-colors hover:bg-ink/[0.03]"
          >
            <span>Customize guest QRs</span>
            <span className="ml-auto text-ink/50">Your colours</span>
            <ArrowRight aria-hidden className="h-3.5 w-3.5 text-ink/40" strokeWidth={1.75} />
          </Link>
        </div>
      </section>

      <AutosaveForm action={updateAction} returnTo={returnTo} className="space-y-5">
        <div className="flex justify-end">
          <AutosaveState />
        </div>

        {/* ── 2 · DETAILS — name, contact, private note: one line each ───── */}
        <Section title="Details">
          <div className="overflow-hidden rounded-lg border border-ink/10">
            <Disclosure summary="Name" value={guestDisplayName(guest)}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field id="name_prefix" label="Prefix" defaultValue={guest.name_prefix ?? ''} />
                <Field id="first_name" label="First name *" required defaultValue={guest.first_name} />
                <Field id="middle_name" label="Middle name" defaultValue={guest.middle_name ?? ''} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field id="last_name" label="Last name *" required defaultValue={guest.last_name} />
                <Field id="name_suffix" label="Suffix" defaultValue={guest.name_suffix ?? ''} />
                <Field
                  id="display_name"
                  label="Display name"
                  defaultValue={guest.display_name ?? ''}
                  placeholder="e.g. Tito Boy & Tita Cora"
                />
              </div>
            </Disclosure>

            <Disclosure
              summary="Email & mobile"
              value={contactSummary}
              emptyValue="No email or mobile yet"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="email" label="Email" type="email" defaultValue={guest.email ?? ''} />
                <Field id="mobile" label="Mobile" defaultValue={guest.mobile ?? ''} placeholder="+63 …" />
              </div>
            </Disclosure>

            <Disclosure summary="Private note" value={guest.notes?.trim() || null} emptyValue="None" last>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={guest.notes ?? ''}
                className="input-field min-h-[88px] resize-y py-2"
              />
              {/* Said out loud, because until 2026-08-06 it was the opposite of
                  true: this box was rendered on the guest's own invitation page
                  and their RSVP overwrote whatever was here. */}
              <p className="text-xs text-ink/50">
                Only you and your co-hosts can see this. {guest.first_name} never sees it.
              </p>
            </Disclosure>
          </div>
        </Section>

        {/* ── 3 · RSVP — coming, to what, and what they eat ──────────────── */}
        <Section title="RSVP">
          {isCouple ? (
            <>
              <div className="inline-flex h-11 items-center gap-2 rounded-md border border-success-300 bg-success-50 px-4 text-sm font-medium text-success-800">
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Attending · always
              </div>
              <p className="text-xs text-ink/50">
                The couple is the foundation of the event — always attending.
              </p>
              {/* 🔴 AND NO "Answer recorded" LINE. There is no answer to record:
                  the action COERCES bride and groom to attending, so their stamp
                  only ever says when a host last pressed Save. */}
              <input type="hidden" name="rsvp_status" value="attending" />
            </>
          ) : (
            <>
              <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <legend className="sr-only">RSVP status</legend>
                {RSVP_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className={`relative flex h-11 cursor-pointer items-center justify-center rounded-md border border-ink/20 bg-cream text-sm font-medium text-ink/75 transition-colors hover:border-ink/40 ${RSVP_PILL_CLASS[status]}`}
                  >
                    <input
                      type="radio"
                      name="rsvp_status"
                      value={status}
                      defaultChecked={guest.rsvp_status === status}
                      className="sr-only"
                    />
                    {RSVP_LABELS[status]}
                  </label>
                ))}
              </fieldset>
              {/* Deliberately "recorded", not "replied": three of this column's
                  four writers are host-side dashboard paths. Rendered only when
                  there IS one — the writers clear it to null on pending and
                  maybe, so an absent value means "no answer on record". */}
              {recordedAt ? (
                <p className="text-xs text-ink/50">Answer recorded {recordedAt}</p>
              ) : null}
            </>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">Invited to</label>
            {/* Smart defaults by role · locked 2026-05-23 PM. Chips populate
                from the guest's saved value; changing Role below snaps them to
                that role's defaults. */}
            <InvitedToChips
              roleSelectId="role"
              initialRole={guest.role}
              initialBlocks={initialInvited}
            />
          </div>

          {/* 🔑 DIETARY BELONGS WITH MEAL — owner 2026-09-22. It sat under
              "More details" next to email and mobile, which it is not. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id="meal_preference"
              label="Meal preference"
              defaultValue={guest.meal_preference ?? 'no_preference'}
              options={MEAL_OPTIONS.map((v) => ({ value: v, label: MEAL_LABELS[v] }))}
            />
            <Field
              id="dietary_restrictions"
              label="Dietary restrictions"
              defaultValue={guest.dietary_restrictions ?? ''}
              placeholder="halal · nut allergy · …"
            />
          </div>

          {/* 🔴 The guest's own message. Read-only: it is theirs, not yours to
              edit. The separate column exists precisely so that saving your
              private note cannot erase what they wrote, and vice versa. */}
          {guest.guest_note?.trim() ? (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-ink">
                A note from {guest.first_name}
              </span>
              <p className="whitespace-pre-wrap rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2 text-sm text-ink/80">
                {guest.guest_note}
              </p>
              <p className="text-xs text-ink/50">
                They wrote this when they replied. Only they can change it.
              </p>
            </div>
          ) : null}
        </Section>

        {/* ── 4 · SEAT — where they sit, how many seats, what they wear ──── */}
        <Section title="Seat">
          <Link
            href={`/dashboard/${eventId}/seating`}
            className="flex items-center gap-3 rounded-lg border border-ink/10 px-3.5 py-3 text-sm text-ink transition-colors hover:bg-ink/[0.03]"
          >
            <span>Table</span>
            <span className="ml-auto text-ink/55">
              {seatedAt ?? <span className="italic text-ink/40">Not seated yet</span>}
            </span>
            <ArrowRight aria-hidden className="h-3.5 w-3.5 text-ink/40" strokeWidth={1.75} />
          </Link>

          {/* ⚖ Owner 2026-09-21: "+1 per guest can be up to number 4. can be
              +1/+2/+3/+4. these are for the additional seats." */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Extra seats</legend>
            <span className="flex flex-wrap gap-2">
              {PLUS_ONE_CHOICES.map((n) => (
                <label
                  key={n}
                  className="cursor-pointer rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/80 transition-colors has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5 has-[:checked]:font-medium has-[:checked]:text-ink hover:border-ink/30"
                >
                  <input
                    type="radio"
                    name="plus_one_count"
                    value={n}
                    defaultChecked={plusOneSeats(guest) === n}
                    className="sr-only"
                  />
                  {n === 0 ? 'None' : `+${n}`}
                </label>
              ))}
            </span>
            <span className="block text-xs text-ink/60">
              Your guest confirms on their invitation, and fills in their
              plus-one&rsquo;s name when they RSVP.
            </span>
          </fieldset>
          {plusOneStateLabel ? (
            <p className="rounded-md border border-success-200/60 bg-success-50/70 px-3 py-2 text-xs text-success-900">
              <span className="font-medium">+1 status:</span> {plusOneStateLabel}
              {plusOneGuestId ? (
                <>
                  {' · '}
                  <Link
                    href={`/dashboard/${eventId}/guests/${plusOneGuestId}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    Open +1 detail
                  </Link>
                </>
              ) : null}
            </p>
          ) : guest.plus_one_allowed ? (
            <p className="rounded-md border border-warn-200/60 bg-warn-50/70 px-3 py-2 text-xs text-warn-900">
              Allowed but no +1 has been added to the list yet.
            </p>
          ) : null}

          <Select
            id="attire"
            label="Attire · 3D seat plan"
            defaultValue={guest.attire}
            options={ATTIRE_OPTIONS.map((v) => ({ value: v, label: ATTIRE_LABELS[v] }))}
          />
        </Section>

        {/* ── 5 · PARTY — side, group, role ──────────────────────────────── */}
        <Section title="Party">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hasSides ? (
              <Select
                id="side"
                label="Side *"
                required
                defaultValue={guest.side}
                options={SIDE_OPTIONS.map((v) => ({ value: v, label: SIDE_LABELS[v] }))}
              />
            ) : null}
            <Select
              id="group_category"
              label="Group *"
              required
              defaultValue={guest.group_category}
              options={GROUP_OPTIONS.map((v) => ({ value: v, label: GROUP_CATEGORY_LABELS[v] }))}
            />
            {isCouple ? (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-ink">
                  {hasSides ? 'Role in wedding' : 'Role'}
                </label>
                <div className="flex h-10 items-center justify-between rounded-md border border-ink/15 bg-ink/[0.03] px-3 text-sm">
                  <span className="font-medium text-ink">{ROLE_LABELS[guest.role]}</span>
                  <span className="text-xs text-ink/45">Foundation · locked</span>
                </div>
                <input type="hidden" name="role" value={guest.role} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Select
                  id="role"
                  label={hasSides ? 'Role in wedding' : 'Role'}
                  defaultValue={guest.role}
                  options={availableRoles.map((v) => ({ value: v, label: ROLE_LABELS[v] }))}
                />
                {isIncWedding ? (
                  <p className="text-xs text-ink/55">
                    INC note: non-member principal sponsors (Ninong/Ninang) are
                    limited to one pair. Member sponsors aren&rsquo;t capped.
                  </p>
                ) : null}
              </div>
            )}
            {/* Chinese / Tsinoy rites only. Fails CLOSED: a refused ceremony read
                degrades to null and this hides, because showing it on every
                event is the reported bug — the owner found it on his CATHOLIC
                wedding and asked why a Chinese-wedding field was there. */}
            {showTeaCeremony ? (
              <Field
                id="seniority_rank"
                label="Tea-ceremony order"
                type="number"
                defaultValue={guest.seniority_rank !== null ? String(guest.seniority_rank) : ''}
                placeholder="Lower serves first"
              />
            ) : (
              // Hidden ≠ cleared. See the note on `relation` below: this form
              // posts every column, so a field that is not rendered is a field
              // that gets written as null.
              <input
                type="hidden"
                name="seniority_rank"
                value={guest.seniority_rank !== null ? String(guest.seniority_rank) : ''}
              />
            )}
          </div>
          {/*
            🚨 RELATION IS CARRIED, NOT EDITED — and this hidden input is load-
            bearing, not tidiness.

            The owner removed the free-text Relationship field from this card on
            2026-09-22. `updateGuest` writes EVERY column it reads out of this
            form, so a field that stops being rendered stops being posted and is
            written as NULL. With autosave that is not a rare accident on Save —
            it is every keystroke. Dropping the input would have quietly erased
            `guests.relation` for every guest a host so much as looked at.

            The column is still alive: `/guests/new` writes it, and the
            tea-ceremony page READS it to label each elder in serving order. So
            the card carries the current value through untouched. It can no
            longer be corrected here, which is what was asked; it cannot be
            destroyed here either, which was not.
          */}
          <input type="hidden" name="relation" value={guest.relation ?? ''} />
        </Section>

        {/* ── 6 · PRIVACY ────────────────────────────────────────────────── */}
        <Section title="Privacy">
          <Toggle
            name="photo_consent"
            defaultChecked={guest.photo_consent}
            icon={<Camera aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />}
            label="OK to tag in photos"
            note="RA 10173"
          />
          {/* Salamisim P2 (iteration 0012). The Live Photo Wall then requires a
              server-baked blur derivative on EVERY projected photo, fail-closed. */}
          <Toggle
            name="faceblock_enabled"
            defaultChecked={guest.faceblock_enabled}
            icon={<EyeOff aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />}
            label="Blur faces on the Live Wall"
            note="FaceBlock — blurs every face in the shot"
          />
          {/* Minor safeguard (DPIA BV-8, 2026-07-05). Face recognition is
              adult-only opt-in; a host attestation, collecting no age. */}
          <Toggle
            name="face_recognition_excluded"
            defaultChecked={guest.face_recognition_excluded}
            icon={<UserX aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />}
            label="Exclude from face recognition"
            note="e.g. a minor"
          />
        </Section>

        {/* ── 7 · TAGS — read-only, derived from everything above ────────── */}
        <Section title="Tags">
          <div className="flex flex-wrap gap-2">
            <TagChip
              icon={<Users aria-hidden className="h-3 w-3" strokeWidth={2} />}
              label={SIDE_LABELS[guest.side]}
              tint={SIDE_CHIP_TINT[guest.side]}
            />
            <TagChip
              icon={<Tag aria-hidden className="h-3 w-3" strokeWidth={2} />}
              label={GROUP_CATEGORY_LABELS[guest.group_category]}
            />
            <TagChip
              icon={<Tag aria-hidden className="h-3 w-3" strokeWidth={2} />}
              label={ROLE_LABELS[guest.role]}
            />
            {seatedAt ? (
              <TagChip
                icon={<Armchair aria-hidden className="h-3 w-3" strokeWidth={2} />}
                label={seatedAt}
                tint="bg-warn-50 text-warn-900 ring-1 ring-warn-200"
              />
            ) : null}
            {customGroups.map((g) => (
              <TagChip
                key={g.label}
                icon={<Users aria-hidden className="h-3 w-3" strokeWidth={2} />}
                label={g.label}
                tint={SIDE_CHIP_TINT[g.teamSide]}
              />
            ))}
          </div>
          <p className="text-xs text-ink/55">
            Set automatically from the fields above, the seating chart and
            Groups — not typed.
          </p>
        </Section>

      </AutosaveForm>

      {/* ── 8 · REMOVE — explicit, never autosaved, and never nested inside the
          autosave form: each of these actions brings its own <form>.
          THE SECOND TAP IS THE GUARD. `RemoveGuestConfirm` arms and disarms on a
          timer; see the-quick-view-can-act.test.ts for why one tap was wrong. */}
      {isCouple ? (
        <p className="border-t border-ink/10 pt-4 text-xs text-ink/50">
          Foundation of the event — can&rsquo;t be removed.
        </p>
      ) : (
        <div className="space-y-2">
          <RemoveGuestConfirm
            eventId={eventId}
            guestId={guest.guest_id}
            guestName={guestDisplayName(guest)}
          />
          {/* Owner ruling 2026-08-06: "the couple has full control of their
              guests." A personal invitation link is a bearer credential.
              Re-issuing the QR does NOT undo that: rotation writes qr_token and
              never person_id or email, so the link dies while the account keeps
              the seat. This does both, rotation FIRST. */}
          <form action={releaseAction}>
            <SubmitButton
              className="block w-full rounded-lg border border-ink/15 px-3.5 py-2.5 text-left text-sm font-medium text-ink/70 transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-60"
              aria-label={`Take back ${guestDisplayName(guest)}'s seat — new QR and unlink their account`}
              pendingLabel="Taking back…"
            >
              Take this seat back
            </SubmitButton>
          </form>
          <p className="text-xs text-ink/50">
            Taking the seat back issues a new QR and unlinks their account.
          </p>
        </div>
      )}
    </div>
  );
}

// ── local pieces ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * A one-line row that opens. Native `<details>` — no client component, so the
 * whole card stays server-rendered and it works with the keyboard for free.
 * The `.gl-disc` animation in globals.css gives the open a bit of motion;
 * height itself cannot be animated on a native disclosure.
 */
function Disclosure({
  summary,
  value,
  emptyValue,
  last = false,
  children,
}: {
  summary: string;
  value: string | null;
  emptyValue?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className={`group ${last ? '' : 'border-b border-ink/[0.06]'}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 text-sm text-ink transition-colors hover:bg-ink/[0.03]">
        <span>{summary}</span>
        <span className="ml-auto truncate text-ink/55">
          {value ?? <span className="italic text-ink/40">{emptyValue ?? '—'}</span>}
        </span>
        <span
          aria-hidden
          className="text-ink/40 transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="gl-disc space-y-3 border-t border-ink/[0.06] bg-ink/[0.02] px-3.5 py-3.5">
        {children}
      </div>
    </details>
  );
}

function Toggle({
  name,
  defaultChecked,
  icon,
  label,
  note,
}: {
  name: string;
  defaultChecked: boolean;
  icon: React.ReactNode;
  label: string;
  note: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-ink/20 bg-cream px-3 py-2.5 text-sm text-ink transition-colors has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5 hover:border-ink/40">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-5 w-5 shrink-0 rounded border-ink/30 text-terracotta focus:ring-terracotta"
      />
      {icon}
      <span className="min-w-0">
        <span className="block">{label}</span>
        <span className="block text-xs text-ink/55">{note}</span>
      </span>
    </label>
  );
}

function TagChip({
  icon,
  label,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  tint?: string;
}) {
  const baseClass = tint ?? 'bg-cream text-ink/80 ring-1 ring-ink/15';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${baseClass}`}
    >
      {icon}
      {label}
    </span>
  );
}

function Field({
  id,
  label,
  required = false,
  type = 'text',
  defaultValue,
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink" htmlFor={id}>
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

function Select({
  id,
  label,
  required = false,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  required?: boolean;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={id}
        required={required}
        defaultValue={defaultValue}
        className="input-field"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
