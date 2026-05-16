import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CloudUpload, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PhotoDeliveryPanel } from './_components/photo-delivery-panel';

export const metadata = { title: 'Photo Delivery · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Iteration 0009 — Photo Delivery (V1.5+ scaffold).
 *
 * Server component shell:
 *  - auth-gates the route (couples only — RLS handles the rest if the eventId
 *    doesn't belong to them, the layout one level up already enforces couple
 *    membership so we just defer to it).
 *  - reads the event's display name so the panel can render "Maria & Juan ·
 *    Lead photographer · 1,247 photos" without an extra fetch.
 *
 * The interactive Connect → Connected → Downloaded state machine lives in the
 * client component below. The real Drive OAuth + Drive API + compression-cron
 * pipeline is STUBBED — see `// TODO(0009):` markers in the panel.
 */
export default async function PhotoDeliveryPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('display_name, event_date')
    .eq('event_id', eventId)
    .maybeSingle();

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-3">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <CloudUpload aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Photo Delivery · Web V1
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Send your finalized photos to Google Drive
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Once your photographers and videographers finish their post-event edits,
          Setnayan pushes the full-resolution archive straight to a Drive folder you
          control — no hard drives changing hands, no &ldquo;wait for the photographer
          to upload&rdquo; back-and-forth.
        </p>
      </header>

      {/* The standing 30-day compression rule — visible at the top of the page so
          couples see it before they ever click Connect. Repeated as per-folder
          countdown badges once a folder is downloaded. */}
      <aside
        role="note"
        aria-label="30-day post-download compression rule"
        className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-950 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-200/80 text-amber-900">
            <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="space-y-1.5">
            <p className="font-semibold tracking-tight">
              30-day window for full-resolution originals
            </p>
            <p className="text-amber-900/85">
              Once a folder is downloaded, you have <span className="font-mono font-semibold">30 days</span> to
              copy or back up the full-resolution files. After that, Setnayan
              compresses the Drive originals to web-quality JPEGs to keep
              your storage tidy — your Setnayan-side 5-year backup stays intact.
            </p>
          </div>
        </div>
      </aside>

      <PhotoDeliveryPanel
        eventId={eventId}
        eventName={event?.display_name ?? null}
        eventDate={event?.event_date ?? null}
      />
    </section>
  );
}
