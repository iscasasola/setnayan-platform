import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { updateSpecialMessage } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Edit special message · Setnayan' };

/**
 * /dashboard/[eventId]/website/special-message — host-curated note to guests
 * (Increment A.1 · Wedding_Website_Lifecycle_Spec_2026-06-07 §6.5). Sibling of
 * the dress-code / photo-moments editors. The SpecialMessageWidget in
 * apps/web/app/[slug]/page.tsx reads events.special_message and hides the
 * section entirely when it's blank.
 */
export default async function SpecialMessageEditorPage({
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
    .select('event_id, display_name, slug, special_message')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  const updateAction = updateSpecialMessage.bind(null, eventId);
  const message = typeof event.special_message === 'string' ? event.special_message : '';
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
            <Heart aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Special message
          </p>
          <h1 className="mt-1 font-serif text-3xl italic tracking-tight sm:text-4xl">
            A note to your guests
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink/65">
            A few heartfelt lines from the two of you — shown on your wedding website.
            Leave it blank to hide the section.
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
            Your message
          </span>
          <textarea
            name="message"
            rows={5}
            maxLength={600}
            defaultValue={message}
            placeholder="Two families, one beautiful beginning — thank you for being part of our story."
            className="mt-2 w-full rounded-lg border border-ink/15 bg-cream p-3 font-serif text-lg italic leading-relaxed text-ink focus:border-terracotta focus:outline-none"
          />
          <span className="mt-1 block text-xs text-ink/45">Up to 600 characters.</span>
        </label>
        <SubmitButton pendingLabel="Saving…" className="button-primary">Save message</SubmitButton>
      </form>
    </section>
  );
}
