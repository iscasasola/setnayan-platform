import Link from 'next/link';
import {
  GROUP_CATEGORY_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type RsvpStatus,
} from '@/lib/guests';
import { createGuest } from './actions';

export const metadata = { title: 'Add guest' };

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please enter both first and last name.',
  missing_side: 'Choose which side this guest is on.',
  missing_group: 'Choose a group category for this guest.',
  invalid_role: 'Invalid role selection.',
  invalid_rsvp: 'Invalid RSVP status.',
  invalid_meal: 'Invalid meal preference.',
};

const SIDE_OPTIONS: GuestSide[] = ['bride', 'groom', 'both'];
const GROUP_OPTIONS: GuestGroupCategory[] = ['family', 'friends', 'work', 'school', 'officiant', 'other'];
const RSVP_OPTIONS: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];
const ROLE_OPTIONS: GuestRole[] = [
  'guest',
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

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function NewGuestPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const rawError = search.error ? decodeURIComponent(search.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;

  const action = createGuest.bind(null, eventId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <Link
          href={`/dashboard/${eventId}/guests`}
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to guest list
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Add a guest</h1>
        <p className="text-sm text-ink/60">
          The first 7 fields are the minimum. Plus-one, address, dietary, and tags will land in a follow-up.
        </p>
      </header>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <form action={action} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="first_name" label="First name *" required placeholder="Maria" />
          <Field id="last_name" label="Last name *" required placeholder="de la Cruz" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="side"
            label="Side *"
            required
            options={SIDE_OPTIONS.map((v) => ({ value: v, label: SIDE_LABELS[v] }))}
          />
          <Select
            id="group_category"
            label="Group *"
            required
            options={GROUP_OPTIONS.map((v) => ({
              value: v,
              label: GROUP_CATEGORY_LABELS[v],
            }))}
          />
        </div>

        <Select
          id="role"
          label="Role in wedding"
          defaultValue="guest"
          options={ROLE_OPTIONS.map((v) => ({ value: v, label: ROLE_LABELS[v] }))}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="email" label="Email" type="email" placeholder="maria@example.com" />
          <Field id="mobile" label="Mobile" placeholder="+63 …" />
        </div>

        <Select
          id="rsvp_status"
          label="RSVP status"
          defaultValue="pending"
          options={RSVP_OPTIONS.map((v) => ({ value: v, label: RSVP_LABELS[v] }))}
        />

        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="photo_consent"
              defaultChecked
              className="h-5 w-5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
            />
            <span>
              <span className="font-medium">Photo consent</span>{' '}
              <span className="text-ink/60">
                — guest agrees to be tagged in the event gallery (per RA 10173).
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-medium text-ink">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Private to you — dietary notes, mobility needs, anything else."
            className="input-field min-h-[88px] resize-y py-2"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className="button-primary w-full sm:w-auto">
            Save guest
          </button>
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="button-secondary w-full sm:w-auto"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  required = false,
  type = 'text',
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
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
        {!required && !defaultValue ? <option value="">—</option> : null}
        {required && !defaultValue ? <option value="">Choose…</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
