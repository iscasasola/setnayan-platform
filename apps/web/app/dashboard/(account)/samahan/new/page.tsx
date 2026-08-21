import { SubmitButton } from '@/app/_components/submit-button';
import { } from '@/lib/communities';
import { createCommunity } from '../actions';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = {
  title: 'Create a Samahan',
};

// Create flow (plan §5) — one glass card, three fields, zero friction.
// Creating a samahan is free (₱0 rule): the action writes three Postgres rows
// and nothing else. Validation errors round-trip via redirect params
// (create-event precedent).

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please give the samahan a name (2–80 characters).',
  description_too_long: 'Keep the description under 280 characters.',
};

export default async function NewSamahanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const rawError = sp.error ? decodeURIComponent(sp.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="Create a Samahan"
      />

      {errorMessage ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <form
        action={createCommunity}
        className="sn-tile space-y-6 p-6"
      >
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="name">
            Name <span className="text-terracotta">*</span>
          </label>
          <input
            autoComplete="off"
            className="input-field"
            id="name"
            maxLength={80}
            minLength={2}
            name="name"
            placeholder="Barkada ni Ice · San Roque Parish Youth · Clan Casasola"
            required
            type="text"
          />
        </div>


        <div className="space-y-1.5">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor="description"
          >
            Description <span className="text-ink/45">(optional)</span>
          </label>
          <textarea
            className="input-field min-h-24"
            id="description"
            maxLength={280}
            name="description"
            placeholder="Ano'ng samahan 'to? (optional)"
          />
        </div>

        <SubmitButton
          pendingLabel="Creating…"
          className="button-primary w-full sm:w-auto"
        >
          Create samahan
        </SubmitButton>
      </form>
    </div>
  );
}
