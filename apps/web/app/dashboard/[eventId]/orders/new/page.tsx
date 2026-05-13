import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createOrder } from '../actions';

export const metadata = { title: 'New order' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ service?: string }>;
};

export default async function NewOrderPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const prefillService = typeof search.service === 'string' ? search.service : '';

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={`/dashboard/${eventId}/orders`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to orders
      </Link>

      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">New order</h1>
        <p className="text-base text-ink/65">
          Describe what you need and propose a budget. The Setnayan team confirms the price
          before payment — you only pay what you&rsquo;ve agreed on.
        </p>
      </header>

      <form action={createOrder} className="space-y-5 rounded-2xl border border-ink/10 bg-cream p-5">
        <input type="hidden" name="event_id" value={eventId} />
        {prefillService ? (
          <input type="hidden" name="service_key" value={prefillService} />
        ) : null}

        <label htmlFor="description" className="block space-y-1">
          <span className="block text-sm font-medium text-ink">Description</span>
          <textarea
            id="description"
            name="description"
            required
            rows={5}
            maxLength={2000}
            placeholder="What do you need? e.g. Save the Date video render — 60 seconds, 3 video clips, vertical format for IG Story."
            className="input-field min-h-[120px] py-2"
            defaultValue={
              prefillService === 'mood-board'
                ? 'I want help curating the palette for our wedding.'
                : prefillService === 'led'
                  ? 'LED background render for our reception entrance.'
                  : prefillService === 'papic'
                    ? 'Papic capture setup for our wedding day.'
                    : ''
            }
          />
          <span className="block text-xs text-ink/55">
            Max 2,000 characters. Include event date, format, deliverables, deadlines.
          </span>
        </label>

        <label htmlFor="requested_total_php" className="block space-y-1">
          <span className="block text-sm font-medium text-ink">Your proposed budget (PHP)</span>
          <input
            id="requested_total_php"
            name="requested_total_php"
            type="number"
            min={0}
            step="0.01"
            required
            placeholder="0"
            className="input-field"
          />
          <span className="block text-xs text-ink/55">
            We&rsquo;ll come back with a confirmed price — could be lower or higher depending
            on the scope.
          </span>
        </label>

        <button type="submit" className="button-primary">
          Submit order
        </button>
      </form>
    </div>
  );
}
