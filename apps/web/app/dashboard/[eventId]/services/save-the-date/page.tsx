import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles, Video } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  SAVE_THE_DATE_TEMPLATES,
  STD_PRICE_PHP,
  type SaveTheDateTemplate,
} from '@/lib/save-the-date';
import { formatPhp } from '@/lib/orders';
import { createOrder } from '../../orders/actions';

export const metadata = { title: 'Save the Date · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

export default async function SaveTheDateGallery({ params }: Props) {
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
        href={`/dashboard/${eventId}/services`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to services
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Save the Date
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Pick a template, send us 3–8 video clips of you two, and we render a
          60-second Save the Date video — vertical, square, and horizontal formats so it
          fits any feed.{' '}
          <span className="font-mono text-ink">{formatPhp(STD_PRICE_PHP)}</span> per render.
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          12 templates · more curated every month
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-900">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          How it works
        </p>
        <ol className="ml-5 list-decimal space-y-1 text-sm text-amber-900/90">
          <li>Pick a template below — opens an order in your Orders tab.</li>
          <li>
            Setnayan team confirms the price + arranges video clip handoff (Drive / WeTransfer).
          </li>
          <li>
            Pay via BDO or GCash using the reference code on your order. Render delivered
            within 5 business days.
          </li>
        </ol>
      </section>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SAVE_THE_DATE_TEMPLATES.map((t) => (
          <li key={t.slug}>
            <TemplateCard
              eventId={eventId}
              template={t}
              coupleName={event?.display_name ?? ''}
              eventDate={event?.event_date ?? null}
            />
          </li>
        ))}
      </ul>

      <p className="text-xs text-ink/55">
        Need something off-list? Open a{' '}
        <Link
          href={`/dashboard/${eventId}/orders/new?service=save-the-date-custom`}
          className="text-terracotta hover:underline"
        >
          custom request
        </Link>
        {' '}
        — describe the vibe + reference links and our team will quote.
      </p>
    </section>
  );
}

function TemplateCard({
  eventId,
  template,
  coupleName,
  eventDate,
}: {
  eventId: string;
  template: SaveTheDateTemplate;
  coupleName: string;
  eventDate: string | null;
}) {
  const description = [
    `Save the Date video — ${template.name} template`,
    coupleName ? `Couple: ${coupleName}` : null,
    eventDate ? `Wedding date: ${eventDate}` : null,
    'Format: 60 seconds, vertical + square + horizontal',
    'I have 3–8 video clips to share with the team (we will coordinate handoff after the quote is confirmed).',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <article className="flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-ink/10 bg-cream">
      <Preview template={template} coupleName={coupleName} />
      <div className="space-y-2 px-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{template.name}</h2>
            <p className="text-xs text-ink/55">{template.bestFor}</p>
          </div>
          <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
            {formatPhp(STD_PRICE_PHP)}
          </span>
        </div>
        <p className="text-xs text-ink/70">{template.vibe}</p>
        <form action={createOrder} className="pt-2">
          <input type="hidden" name="event_id" value={eventId} />
          <input
            type="hidden"
            name="service_key"
            value={`save-the-date:${template.slug}`}
          />
          <input type="hidden" name="description" value={description} />
          <input type="hidden" name="requested_total_php" value={STD_PRICE_PHP} />
          <SubmitButton
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-600 disabled:opacity-70"
            pendingLabel="Requesting…"
          >
            <Video className="h-4 w-4" strokeWidth={1.75} />
            Request this template
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}

function Preview({
  template,
  coupleName,
}: {
  template: SaveTheDateTemplate;
  coupleName: string;
}) {
  const [bg, accent1, accent2, dark] = template.palette;
  const display =
    coupleName.length > 0 ? coupleName : 'Your name & Their name';
  return (
    <div
      aria-hidden
      className="relative flex aspect-[4/5] items-center justify-center"
      style={{ backgroundColor: bg }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: accent1 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex h-2 items-stretch"
        style={{ backgroundColor: dark }}
      >
        <span className="block flex-1" style={{ backgroundColor: accent1 }} />
        <span className="block flex-1" style={{ backgroundColor: accent2 }} />
        <span className="block flex-1" style={{ backgroundColor: dark }} />
        <span className="block flex-1" style={{ backgroundColor: bg }} />
      </div>
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.3em]"
          style={{ color: dark }}
        >
          Save the Date
        </p>
        <p
          className={`text-xl tracking-tight ${template.fontClass}`}
          style={{ color: dark }}
        >
          {display}
        </p>
        <span
          className="inline-block h-px w-12"
          style={{ backgroundColor: accent2 }}
        />
        <p
          className="font-mono text-[9px] uppercase tracking-[0.25em]"
          style={{ color: accent2 }}
        >
          {template.name}
        </p>
      </div>
    </div>
  );
}
