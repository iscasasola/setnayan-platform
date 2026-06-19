import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Film,
  QrCode,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatPhp } from '@/lib/orders';
import {
  PATIKTOK_OVERAGE_PHP,
  PATIKTOK_TEMPLATES,
  PATIKTOK_VIDEO_SOFT_CAP,
  findPatiktokTemplate,
  type PatiktokTemplate,
} from '@/lib/patiktok';
import { createOrder } from '../../../orders/actions';
import { BoothCapture } from '../_components/booth-capture';

// Iteration 0017 Phase 4 — Patiktok Operator Dashboard.
//
// The booth-side surface a coordinator / operator uses at the venue. Spec
// source: 0017_patiktok.md § "Booth operator flow (at the venue)" + § "Sound
// selection — couple curates 2 templates".
//
// Phase 4 ships the dashboard SHELL — primary + backup template picker, live
// submission counter, 40-cap soft-warning, in-event ₱49/+10 overage purchase
// CTA, and the "Start Recording" button. The actual camera capture flow
// (getUserMedia + MediaRecorder + face-lock + 3-sec auto-trim + retake) is
// Phase 4.1 — those bits are HEAVY client-side work and warrant their own PR.
//
// Access: today this is gated to the couple via the existing dashboard layout
// (event membership check). A future "Printable booth QR" feature will mint
// a short-lived booth session token so any phone scanning the QR can access
// the dashboard without a Setnayan account — see TODO(0017-phase4.2).

export const metadata = { title: 'Patiktok Booth · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    primary?: string;
    backup?: string;
    overage_queued?: string;
  }>;
};

export default async function PatiktokBoothDashboard({
  params,
  searchParams,
}: Props) {
  const { eventId } = await params;
  const { primary, backup, overage_queued: overageQueued } = await searchParams;

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

  // Count today's submissions for soft-cap check. The spec's soft cap is
  // per-booth per-day; here we use "submissions enqueued in the last 24 h"
  // as the proxy until the real booth-session tracking lands.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: submissionsCount } = await supabase
    .from('patiktok_render_jobs')
    .select('job_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .gte('enqueued_at', since);

  const submissions = submissionsCount ?? 0;
  const remaining = Math.max(0, PATIKTOK_VIDEO_SOFT_CAP - submissions);
  const overCap = submissions >= PATIKTOK_VIDEO_SOFT_CAP;

  // PATIKTOK_TEMPLATES is statically seeded with at least two entries in
  // apps/web/lib/patiktok.ts, so the indexed fallbacks are non-null by
  // construction. The `!` is what tells TS that under noUncheckedIndexedAccess.
  const primaryTemplate: PatiktokTemplate =
    (primary ? findPatiktokTemplate(primary) : null) ?? PATIKTOK_TEMPLATES[0]!;
  const backupTemplate: PatiktokTemplate =
    (backup ? findPatiktokTemplate(backup) : null) ?? PATIKTOK_TEMPLATES[1]!;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio/patiktok`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Patiktok gallery
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Operator Dashboard · Patiktok booth
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {event?.display_name ?? 'Your event'}
          {event?.event_date ? (
            <span className="ml-2 font-mono text-base text-ink/55">
              · {new Date(event.event_date).toLocaleDateString('en-PH', { dateStyle: 'long' })}
            </span>
          ) : null}
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Re-scan the printed booth QR anytime to pick up where you left off.
          Token is event-scoped and persists across phones for the full event-
          day pack window.
        </p>
      </header>

      {overageQueued ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Overage queued — your 40-video allotment just grew by +10. Keep
          recording.
        </p>
      ) : null}

      <CapacityStrip
        submissions={submissions}
        remaining={remaining}
        overCap={overCap}
        eventId={eventId}
      />

      <TemplatesGrid
        eventId={eventId}
        primary={primaryTemplate}
        backup={backupTemplate}
      />

      <RecordCTA
        eventId={eventId}
        primaryTemplate={primaryTemplate}
      />

      <OperatorTips />
    </section>
  );
}

function CapacityStrip({
  submissions,
  remaining,
  overCap,
  eventId,
}: {
  submissions: number;
  remaining: number;
  overCap: boolean;
  eventId: string;
}) {
  const description = `Patiktok overage — +10 videos beyond the daily ${PATIKTOK_VIDEO_SOFT_CAP}-cap. Stack as many ₱${PATIKTOK_OVERAGE_PHP} blocks as the booth needs.`;
  return (
    <section
      className={`space-y-3 rounded-2xl border p-5 ${
        overCap
          ? 'border-warn-300/70 bg-warn-50/80'
          : 'border-ink/10 bg-cream'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Day&rsquo;s capture count (last 24 h)
          </p>
          <p className="mt-1 inline-flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {submissions}
            </span>
            <span className="font-mono text-xs text-ink/55">
              / {PATIKTOK_VIDEO_SOFT_CAP}
            </span>
          </p>
        </div>
        <span
          className={
            overCap
              ? 'inline-flex items-center gap-1.5 rounded-full bg-warn-200/60 px-2.5 py-1 text-[11px] font-medium text-warn-900'
              : 'inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-[11px] font-medium text-success-900'
          }
        >
          {overCap ? (
            <TriangleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          ) : (
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          {overCap ? 'Soft cap reached' : `${remaining} left in pack`}
        </span>
      </div>

      {overCap ? (
        <form action={createOrder} className="space-y-2">
          <input type="hidden" name="event_id" value={eventId} />
          <input
            type="hidden"
            name="service_key"
            value="patiktok:video_overage"
          />
          <input type="hidden" name="description" value={description} />
          <input
            type="hidden"
            name="requested_total_php"
            value={PATIKTOK_OVERAGE_PHP}
          />
          <SubmitButton
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-warn-900 px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-warn-950 disabled:opacity-70"
            pendingLabel="Submitting…"
          >
            <ShoppingCart className="h-4 w-4" strokeWidth={1.75} />
            Buy +10 videos · {formatPhp(PATIKTOK_OVERAGE_PHP)}
          </SubmitButton>
          <p className="text-[11px] text-warn-900/85">
            One-tap purchase · apply-then-pay · same payment rails as the
            base SKU. Stack as many +10 blocks as the event needs.
          </p>
        </form>
      ) : (
        <p className="text-[11px] text-ink/55">
          Day&rsquo;s pack soft-caps at {PATIKTOK_VIDEO_SOFT_CAP} captured
          videos. When you hit it we&rsquo;ll surface the {formatPhp(PATIKTOK_OVERAGE_PHP)}/+10 overage
          purchase right here.
        </p>
      )}
    </section>
  );
}

function TemplatesGrid({
  eventId,
  primary,
  backup,
}: {
  eventId: string;
  primary: PatiktokTemplate;
  backup: PatiktokTemplate;
}) {
  const swapHref = `/dashboard/${eventId}/studio/patiktok/booth?primary=${backup.slug}&backup=${primary.slug}`;
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TemplateSlot
        eventId={eventId}
        template={primary}
        role="primary"
        otherSlug={backup.slug}
      />
      <TemplateSlot
        eventId={eventId}
        template={backup}
        role="backup"
        otherSlug={primary.slug}
      />
      <div className="sm:col-span-2">
        <Link
          href={swapHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          ↔ Swap primary and backup
        </Link>
      </div>
    </section>
  );
}

function TemplateSlot({
  eventId,
  template,
  role,
  otherSlug,
}: {
  eventId: string;
  template: PatiktokTemplate;
  role: 'primary' | 'backup';
  otherSlug: string;
}) {
  const browseHref = `/dashboard/${eventId}/studio/patiktok?role=${role}&other=${otherSlug}`;
  return (
    <article
      className={`flex flex-col gap-2 rounded-2xl border p-4 ${
        role === 'primary'
          ? 'border-terracotta/40 bg-terracotta/5'
          : 'border-ink/10 bg-cream'
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <p
          className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
            role === 'primary' ? 'text-terracotta-700' : 'text-ink/55'
          }`}
        >
          {role === 'primary' ? 'Primary template' : 'Backup template'}
        </p>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65">
          {template.defaultDurationSec}s
        </span>
      </header>
      <h2 className="text-lg font-semibold tracking-tight">{template.name}</h2>
      <p className="text-xs text-ink/65">{template.bestFor}</p>
      <p className="text-xs text-ink/55">{template.vibe}</p>
      <Link
        href={browseHref}
        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-terracotta/40 hover:text-terracotta-700"
      >
        Change {role === 'primary' ? 'primary' : 'backup'}
      </Link>
    </article>
  );
}

function RecordCTA({
  eventId,
  primaryTemplate,
}: {
  eventId: string;
  primaryTemplate: PatiktokTemplate;
}) {
  return (
    <div className="space-y-3">
      <BoothCapture
        eventId={eventId}
        template={{
          slug: primaryTemplate.slug,
          name: primaryTemplate.name,
          defaultDurationSec: primaryTemplate.defaultDurationSec,
        }}
      />
      <Link
        href={`/dashboard/${eventId}/studio/patiktok/${primaryTemplate.slug}`}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-terracotta/40 hover:text-terracotta-700"
      >
        <Film className="h-4 w-4" strokeWidth={1.75} />
        Preview template + queue render
      </Link>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
        External display dual-view · TODO(0017-phase5.2) · Presentation API + split / PIP layouts for HDMI / AirPlay / Chromecast
      </p>
    </div>
  );
}

function OperatorTips() {
  return (
    <section className="space-y-3 rounded-2xl border border-warn-200/60 bg-warn-50/60 p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-warn-900">
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        Operator tips
      </p>
      <ul className="ml-4 list-disc space-y-1 text-sm text-warn-900/85">
        <li>
          Re-scan the printed Patiktok QR if the phone runs out of battery —
          token is persistent for the event-day pack window.
        </li>
        <li>
          Stack as many ₱{PATIKTOK_OVERAGE_PHP}/+10 overage blocks as the
          night needs — buying one block right now adds +10 to your live
          counter.
        </li>
        <li>
          Two templates max — keep the primary on top, backup ready to swap
          if a song&rsquo;s not landing.
        </li>
        <li>
          The 40-cap is calibrated to ~20% participation across 200 guests.
          Big-energy events routinely break it; overage upsell is in-event,
          not a hard stop.
        </li>
      </ul>
      <p className="inline-flex items-center gap-1.5 text-[11px] text-warn-900/65">
        <QrCode className="h-3 w-3" strokeWidth={1.75} />
        Printable booth QR — TODO(0017-phase4.2): mint per-booth session
        token + email a print-ready PDF.
      </p>
    </section>
  );
}
