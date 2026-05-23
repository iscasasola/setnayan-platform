import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Camera, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchGuestById,
  fetchSingletonRoleHolders,
  guestDisplayName,
  GROUP_CATEGORY_LABELS,
  INVITED_TO_BLOCKS,
  MEAL_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type InvitedToBlock,
  type MealPreference,
  type RsvpStatus,
} from '@/lib/guests';
import { SubmitButton } from '@/app/_components/submit-button';
import { InvitedToChips } from '../_components/invited-to-chips';
import { softDeleteGuest, updateGuest } from './actions';

export const metadata = { title: 'Guest detail' };

/**
 * Guest detail edit page — owner directive 2026-05-23 PM:
 * "we need us to simplify this for easier management. for both desktop
 * and mobile version."
 *
 * Re-organized into ESSENTIAL fields (always visible) + a "More details"
 * disclosure for the 5 rarely-edited fields (display name, contact,
 * dietary, tags, notes). Combined with a sticky bottom action bar so
 * mobile users never have to scroll the full form to reach Save. The
 * data model + server action are unchanged — this is pure UX.
 *
 * Layout decisions:
 *   - 2-col grid on desktop for paired fields (First/Last name, Email/Mobile)
 *   - 3-col grid on desktop for the Categorization trio (Side · Group · Role)
 *   - RSVP becomes a 4-button segmented pill (no dropdown — one tap to
 *     change the most-frequently-edited field)
 *   - Photo consent toggle moved up next to RSVP (was buried at form
 *     bottom; matters for every guest so deserves prominent placement)
 *   - "More details" collapsible disclosure hides 5 rare fields
 *   - Sticky bottom action bar with Save/Cancel/Remove so mobile users
 *     don't scroll to save
 *
 * What this page does NOT change:
 *   - The server action (updateGuest, softDeleteGuest) — same FormData
 *     contract, same column writes
 *   - The smart-defaults `<InvitedToChips>` client island from PR #433
 *   - The singleton-role exclusion logic (bride/groom hidden when taken)
 *   - Any RLS or DB-level rule
 */

const ROLE_OPTIONS: GuestRole[] = [
  'guest',
  'bride',
  'groom',
  // VIP family — owner directive 2026-05-23 PM (PR #424 lock).
  'bride_parents',
  'groom_parents',
  'bride_immediate_family',
  'groom_immediate_family',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];
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

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please enter both first and last name.',
  missing_side: 'Choose which side this guest is on.',
  missing_group: 'Choose a group category for this guest.',
  invalid_role: 'Invalid role selection.',
  invalid_rsvp: 'Invalid RSVP status.',
  invalid_meal: 'Invalid meal preference.',
};

// Tailwind ring-tone per RSVP value, used by the segmented pill so the
// selected state reads at a glance. Attending = positive · Pending =
// neutral · Maybe = caution · Declined = muted-warm. Mirrors the
// StatsStrip tints on the guest list page for visual continuity.
const RSVP_PILL_CLASS: Record<RsvpStatus, string> = {
  attending:
    'has-[:checked]:bg-emerald-600 has-[:checked]:text-cream has-[:checked]:border-emerald-700',
  pending:
    'has-[:checked]:bg-amber-100 has-[:checked]:text-amber-900 has-[:checked]:border-amber-400',
  maybe:
    'has-[:checked]:bg-sky-100 has-[:checked]:text-sky-900 has-[:checked]:border-sky-400',
  declined:
    'has-[:checked]:bg-rose-100 has-[:checked]:text-rose-900 has-[:checked]:border-rose-400',
};

type Props = {
  params: Promise<{ eventId: string; guestId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function GuestDetailPage({ params, searchParams }: Props) {
  const { eventId, guestId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const guest = await fetchGuestById(supabase, eventId, guestId);
  if (!guest) notFound();

  // Hide bride/groom from the role dropdown if someone else already has
  // them — DB partial unique indexes enforce this regardless, but the UI
  // shouldn't offer an option that will fail on save.
  const singletonHolders = await fetchSingletonRoleHolders(supabase, eventId, guestId);
  const availableRoles = ROLE_OPTIONS.filter(
    (r) => !(r in singletonHolders) || r === guest.role,
  );

  const rawError = search.error ? decodeURIComponent(search.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const saved = search.saved === '1';

  const updateAction = updateGuest.bind(null, eventId, guestId);
  const deleteAction = softDeleteGuest.bind(null, eventId, guestId);

  // Filter to known valid InvitedToBlock values — schema column is
  // string[] so legacy data could contain stale block names.
  const initialInvited = (guest.invited_to_blocks ?? []).filter(
    (b): b is InvitedToBlock =>
      (INVITED_TO_BLOCKS as readonly string[]).includes(b),
  );
  const tagsValue = guest.custom_tags.join(', ');

  // Check whether ANY of the "More details" fields has a non-empty value.
  // If yes, expand the disclosure by default so existing data stays
  // visible without the host having to remember to expand it.
  const hasMoreDetails =
    !!guest.display_name?.trim() ||
    !!guest.email?.trim() ||
    !!guest.mobile?.trim() ||
    !!guest.dietary_restrictions?.trim() ||
    guest.custom_tags.length > 0 ||
    !!guest.notes?.trim();

  return (
    // pb-28 reserves clearance for the sticky action bar so the form's
    // last field is never hidden behind the bar even on the shortest
    // viewport. max-w-3xl + mx-auto centers the form on wide screens
    // while letting the sticky bar span the full width.
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-28">
      <header className="space-y-1">
        <Link
          href={`/dashboard/${eventId}/guests`}
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to guest list
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {guestDisplayName(guest)}
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">
            {guest.public_id}
          </p>
        </div>
      </header>

      {saved ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
        >
          Saved.
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-2.5 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <form action={updateAction} className="space-y-6">
        {/* Identity · Name fields. Display name moved to More details
            (used rarely — only when a guest's preferred display differs
            from their formal first + last). */}
        <Section title="Identity">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="first_name" label="First name *" required defaultValue={guest.first_name} />
            <Field id="last_name" label="Last name *" required defaultValue={guest.last_name} />
          </div>
        </Section>

        {/* Categorization · 3 selects in a row on desktop, stacks on
            mobile. Role drives smart Invited-to defaults via the
            InvitedToChips client island (PR #433 lock). */}
        <Section title="Categorization">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              id="side"
              label="Side *"
              required
              defaultValue={guest.side}
              options={SIDE_OPTIONS.map((v) => ({ value: v, label: SIDE_LABELS[v] }))}
            />
            <Select
              id="group_category"
              label="Group *"
              required
              defaultValue={guest.group_category}
              options={GROUP_OPTIONS.map((v) => ({ value: v, label: GROUP_CATEGORY_LABELS[v] }))}
            />
            <Select
              id="role"
              label="Role in wedding"
              defaultValue={guest.role}
              options={availableRoles.map((v) => ({ value: v, label: ROLE_LABELS[v] }))}
            />
          </div>
        </Section>

        {/* RSVP + meal + invited-to + photo consent — the cluster of
            fields a host edits most frequently. Photo consent lives here
            (was buried at the form bottom) because RA 10173 makes it a
            load-bearing per-guest setting. */}
        <Section title="RSVP & meal">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">
              RSVP status
            </label>
            <SegmentedRsvp current={guest.rsvp_status} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id="meal_preference"
              label="Meal preference"
              defaultValue={guest.meal_preference ?? 'no_preference'}
              options={MEAL_OPTIONS.map((v) => ({ value: v, label: MEAL_LABELS[v] }))}
            />
            <PhotoConsent defaultChecked={guest.photo_consent} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">Invited to</label>
            {/*
              Smart defaults by role · locked 2026-05-23 PM. On the edit
              form, chips populate from the guest's saved value (no
              snap on initial render). If the host changes the Role
              dropdown above after mount, the chips snap to the new
              role's smart defaults.
            */}
            <InvitedToChips
              roleSelectId="role"
              initialRole={guest.role}
              initialBlocks={initialInvited}
            />
          </div>
        </Section>

        {/* More details disclosure — collapsed by default unless any
            field inside already has data (`hasMoreDetails`). Cuts the
            form's visual length ~40% for the common case of a guest
            with just a name + RSVP. The 5 fields inside are display
            name, email, mobile, dietary restrictions, custom tags,
            and notes. Each is supported in the same server action,
            no schema changes. */}
        <details
          open={hasMoreDetails}
          className="group rounded-lg border border-ink/10 bg-cream/40 [&[open]>summary]:border-b [&[open]>summary]:border-ink/10"
        >
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-ink/80 hover:text-ink">
            <span>More details</span>
            <span className="flex items-center gap-2 text-xs font-normal text-ink/55">
              <span className="hidden sm:inline">
                Display name · contact · dietary · tags · notes
              </span>
              <ChevronDown
                aria-hidden
                className="h-4 w-4 transition-transform group-open:rotate-180"
                strokeWidth={1.75}
              />
            </span>
          </summary>
          <div className="space-y-4 px-4 py-4">
            <Field
              id="display_name"
              label="Display name"
              defaultValue={guest.display_name ?? ''}
              placeholder="e.g. Tito Boy & Tita Cora"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="email" label="Email" type="email" defaultValue={guest.email ?? ''} />
              <Field id="mobile" label="Mobile" defaultValue={guest.mobile ?? ''} placeholder="+63 …" />
            </div>
            <Field
              id="dietary_restrictions"
              label="Dietary restrictions"
              defaultValue={guest.dietary_restrictions ?? ''}
              placeholder="halal · nut allergy · …"
            />
            <Field
              id="custom_tags"
              label="Custom tags (comma-separated)"
              defaultValue={tagsValue}
              placeholder="vip, college-friends, ninang"
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink" htmlFor="notes">
                Notes (private)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={guest.notes ?? ''}
                className="input-field min-h-[88px] resize-y py-2"
              />
            </div>
          </div>
        </details>

        {/* Sticky bottom action bar — owner directive 2026-05-23 PM:
            mobile users shouldn't scroll the full form to reach Save.
            Uses sticky bottom-0 so the bar floats above content while
            scrolling and settles at the form's natural end on short
            forms. Cream backdrop-blur reads cleanly over light
            backgrounds.

            All three buttons live INSIDE the main form so SubmitButton's
            useFormStatus hook correctly reads the form's pending state.
            The Remove button overrides via `formAction={deleteAction}`
            — React 19 supports server-action functions on the
            button-level formAction attribute. Tradeoff: when EITHER
            button is clicked, BOTH show pending state because they
            share useFormStatus on the same form. Acceptable because
            (a) the user only clicks one button at a time, (b) both
            pendingLabels read sensibly, (c) the redirect lands in
            <1s so the dual-pending window is invisible in practice. */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-lg sm:border sm:px-4 sm:shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <SubmitButton
              formAction={deleteAction}
              className="text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline disabled:opacity-60"
              aria-label={`Remove ${guestDisplayName(guest)}`}
              pendingLabel="Removing…"
            >
              Remove guest
            </SubmitButton>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/${eventId}/guests`}
                className="inline-flex h-10 items-center justify-center rounded-md border border-ink/20 bg-cream px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40"
              >
                Cancel
              </Link>
              <SubmitButton
                className="inline-flex h-10 items-center justify-center rounded-md bg-terracotta px-5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
                pendingLabel="Saving…"
              >
                Save changes
              </SubmitButton>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * Visual section wrapper. Replaces the `<fieldset>` + `<legend>` pattern
 * from the prior layout — those were semantically heavy for what's
 * really just a visual grouping. The fieldset/legend pattern is right
 * for radiogroups (which we still use inside the RSVP segmented pill),
 * but it added unnecessary borders + spacing to every section.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-ink/55">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * RSVP segmented pill — 4-button radio group rendered as side-by-side
 * pills with the selected state lit up in the per-status tint. Replaces
 * the prior `<select>` dropdown for the field hosts edit most often.
 *
 * One click changes the RSVP status (visual + form value); the Save
 * button on the sticky bar commits the change to the DB. Pure CSS via
 * `has-[:checked]` — no client component, no JS.
 */
function SegmentedRsvp({ current }: { current: RsvpStatus }) {
  return (
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
            defaultChecked={current === status}
            className="sr-only"
          />
          {RSVP_LABELS[status]}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Photo consent toggle — promoted from the form bottom to the RSVP
 * cluster. RA 10173 makes this per-guest setting load-bearing for the
 * photo-tagging pipeline; placing it next to RSVP (the other
 * per-guest-frequently-edited field) means hosts don't have to hunt
 * for it.
 */
function PhotoConsent({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink">Photo consent</label>
      <label className="flex h-11 items-center gap-3 rounded-md border border-ink/20 bg-cream px-3 text-sm text-ink transition-colors has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5 hover:border-ink/40">
        <input
          type="checkbox"
          name="photo_consent"
          defaultChecked={defaultChecked}
          className="h-5 w-5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
        />
        <Camera aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />
        <span className="text-sm">
          OK to tag in photos
          <span className="ml-1 text-xs text-ink/55">(RA 10173)</span>
        </span>
      </label>
    </div>
  );
}

function Field({
  id,
  label,
  required = false,
  type = 'text',
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <input
        className="input-field"
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </div>
  );
}

function Select({
  id,
  label,
  options,
  required = false,
  defaultValue,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        required={required}
        className="input-field appearance-none bg-cream pr-8"
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
