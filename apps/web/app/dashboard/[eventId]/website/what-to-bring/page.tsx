import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { updateWhatToBring } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Edit what to bring · Setnayan' };

/**
 * /dashboard/[eventId]/website/what-to-bring — host-curated gift / registry
 * note (Increment A.3). Sibling of the special-message / dress-code editors.
 * WhatToBringWidget in apps/web/app/[slug]/page.tsx reads events.what_to_bring
 * and hides the section when it's blank.
 */
export default async function WhatToBringEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, slug, what_to_bring')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  const updateAction = updateWhatToBring.bind(null, eventId);
  const note = typeof event.what_to_bring === 'string' ? event.what_to_bring : '';
  const saved = search.saved === '1';
  const error = search.error;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <Link
          href={`/dashboard/${eventId}/website`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to website
        </Link>
        <div>
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            <Gift aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            What to bring
          </p>
          <h1 className="mt-1 font-serif text-3xl italic tracking-tight sm:text-4xl">
            Gifts, registry, or a kind note
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink/65">
            Let guests know about gifts — a registry, a honeymoon fund, or simply that
            their presence is the only present you need. Leave it blank to hide the section.
          </p>
        </div>

        {saved ? (
          <div
            role="status"
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Saved — your guests will see this on the wedding website.
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}
      </header>

      <form action={updateAction} className="space-y-4">
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Your note
          </span>
          <textarea
            name="note"
            rows={5}
            maxLength={600}
            defaultValue={note}
            placeholder="Your presence is the only present we need — but if you wish, a contribution to our honeymoon fund is warmly welcomed."
            className="mt-2 w-full rounded-lg border border-ink/15 bg-cream p-3 text-base leading-relaxed text-ink focus:border-terracotta focus:outline-none"
          />
          <span className="mt-1 block text-xs text-ink/45">Up to 600 characters.</span>
        </label>
        <SubmitButton pendingLabel="Saving…" className="button-primary">Save note</SubmitButton>
      </form>
    </section>
  );
}
