import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { COMMUNITY_KINDS, COMMUNITY_KIND_LABEL } from '@/lib/communities';
import { createCommunity } from '../actions';

export const metadata = {
  title: 'Create a Samahan',
};

// Create flow (plan §5) — one glass card, three fields, zero friction.
// Creating a samahan is free (₱0 rule): the action writes three Postgres rows
// and nothing else. Validation errors round-trip via redirect params
// (create-event precedent).

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please give the samahan a name (2–80 characters).',
  invalid_kind: 'Pick one of the samahan kinds.',
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
      <Link
        href="/dashboard/samahan"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Samahan
      </Link>
      <header className="mb-6 space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          Create a Samahan
        </h1>
        <p className="text-base text-ink/60">
          One shared space for your group — free, private, invite-link-only.
        </p>
      </header>

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
        className="space-y-6 rounded-2xl border border-white/70 bg-white/60 p-6 shadow-[0_18px_40px_-26px_rgba(30,26,18,0.35)]"
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

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Kind</legend>
          <div className="flex flex-wrap gap-2">
            {COMMUNITY_KINDS.map((kind) => (
              <label key={kind} className="cursor-pointer">
                <input
                  className="peer sr-only"
                  defaultChecked={kind === 'barkada'}
                  name="kind"
                  type="radio"
                  value={kind}
                />
                <span className="inline-flex items-center rounded-full border border-ink/15 bg-cream px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 transition peer-checked:border-terracotta-500 peer-checked:text-ink peer-checked:ring-1 peer-checked:ring-terracotta-500 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink/40">
                  {COMMUNITY_KIND_LABEL[kind]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-3 text-sm font-medium text-cream transition hover:bg-mulberry-600 sm:w-auto"
        >
          Create samahan
        </SubmitButton>
      </form>
    </div>
  );
}
