'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clapperboard,
  Images,
  Lock,
  Mail,
  RefreshCcw,
  Sparkles,
  Usb,
} from 'lucide-react';
import {
  LED_DEFAULT_LOOP_SECONDS,
  LED_LOOP_OPTIONS,
  type LedTemplate,
} from '@/lib/led-background';

type QueuedJob = {
  id: string;
  templateName: string;
  loopLabel: string;
  photoPool: boolean;
};

type Props = {
  eventId: string;
  coupleName: string;
  templates: ReadonlyArray<LedTemplate>;
};

// TODO(0005): swap mock job ID for the real render job ID once the
// /api/led-background/render endpoint + Cloudflare Queues worker land.
function generateMockJobId(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LED-${new Date().getFullYear()}-${random}`;
}

export function LedBackgroundMaker({
  eventId,
  coupleName,
  templates,
}: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string>(templates[0]?.slug ?? '');
  const [loopSeconds, setLoopSeconds] = useState<number>(LED_DEFAULT_LOOP_SECONDS);
  const [photoPoolEnabled, setPhotoPoolEnabled] = useState<boolean>(false);
  const [queuedJob, setQueuedJob] = useState<QueuedJob | null>(null);

  const selected = useMemo(
    () => templates.find((t) => t.slug === selectedSlug) ?? templates[0]!,
    [templates, selectedSlug],
  );
  const loopOption = useMemo(
    () =>
      LED_LOOP_OPTIONS.find((o) => o.durationSeconds === loopSeconds) ??
      LED_LOOP_OPTIONS[1]!,
    [loopSeconds],
  );

  function handleRender() {
    // TODO(0005): replace this with a server action that POSTs to
    // /api/led-background/render — enqueues the FFmpeg + Lottie pipeline,
    // returns the real render_id, and routes the couple to a status page.
    setQueuedJob({
      id: generateMockJobId(),
      templateName: selected.name,
      loopLabel: loopOption.label,
      photoPool: photoPoolEnabled,
    });
  }

  function handleReset() {
    setQueuedJob(null);
  }

  if (queuedJob) {
    return (
      <RenderQueuedCard
        eventId={eventId}
        job={queuedJob}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Pick a template
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {templates.length} motifs
          </span>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const isSelected = template.slug === selected.slug;
            return (
              <li key={template.slug}>
                <button
                  type="button"
                  onClick={() => setSelectedSlug(template.slug)}
                  aria-pressed={isSelected}
                  className={`group flex h-full w-full flex-col gap-2 overflow-hidden rounded-xl border bg-cream text-left transition-colors ${
                    isSelected
                      ? 'border-terracotta shadow-sm ring-1 ring-terracotta/30'
                      : 'border-ink/10 hover:border-terracotta/50'
                  }`}
                >
                  <TemplateThumbnail template={template} />
                  <div className="space-y-1 px-3 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink">
                        {template.name}
                      </h3>
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {template.vibe}
                      </span>
                    </div>
                    <p className="text-xs text-ink/60">{template.motif}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5 lg:sticky lg:top-4 lg:self-start">
        <header className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/55">
            Customizing
          </p>
          <h2 className="text-lg font-semibold tracking-tight">{selected.name}</h2>
          <p className="text-xs text-ink/60">{selected.motif}</p>
        </header>

        <div className="space-y-2">
          <label
            htmlFor="loop-duration"
            className="block text-sm font-medium text-ink"
          >
            Master loop length
          </label>
          <div
            id="loop-duration"
            role="radiogroup"
            aria-label="Master loop length"
            className="grid grid-cols-2 gap-2"
          >
            {LED_LOOP_OPTIONS.map((option) => {
              const isActive = option.durationSeconds === loopSeconds;
              const disabled = Boolean(option.customTier);
              return (
                <button
                  key={option.durationSeconds}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) setLoopSeconds(option.durationSeconds);
                  }}
                  className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    isActive
                      ? 'border-terracotta bg-terracotta/5 text-ink'
                      : disabled
                        ? 'cursor-not-allowed border-ink/10 bg-ink/[0.03] text-ink/45'
                        : 'border-ink/10 text-ink/75 hover:border-terracotta/50'
                  }`}
                >
                  <span className="inline-flex items-center gap-1 text-sm font-semibold">
                    {option.label}
                    {option.customTier ? (
                      <Lock
                        aria-hidden
                        className="h-3 w-3"
                        strokeWidth={2}
                      />
                    ) : null}
                  </span>
                  <span className="text-[11px] text-ink/55">
                    {option.approxSize}
                  </span>
                  {option.customTier ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                      Custom tier
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink/55">{loopOption.repeatsOver5h}</p>
        </div>

        <div className="space-y-2 rounded-lg border border-ink/10 bg-cream p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                <Images
                  aria-hidden
                  className="h-3.5 w-3.5 text-terracotta"
                  strokeWidth={1.75}
                />
                Photo Pool blend
              </p>
              <p className="text-[11px] text-ink/60">
                Blend a rotating selection of your engagement + pre-wedding
                photos at 30% opacity behind the monogram. A different random
                set bakes into every loop iteration.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={photoPoolEnabled}
              onClick={() => setPhotoPoolEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                photoPoolEnabled ? 'bg-terracotta' : 'bg-ink/15'
              }`}
            >
              <span
                aria-hidden
                className={`inline-block h-4 w-4 transform rounded-full bg-cream transition-transform ${
                  photoPoolEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
              <span className="sr-only">Toggle Photo Pool blend</span>
            </button>
          </div>
        </div>

        <div className="space-y-1 rounded-lg border border-ink/10 bg-ink/[0.02] p-3 text-[11px] text-ink/60">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Output spec
          </p>
          <p>
            <span className="font-medium text-ink">7680 &times; 4320</span>{' '}
            &middot; H.264 &middot; {loopOption.label} master loop &middot;{' '}
            {loopOption.approxSize}
          </p>
          <p className="text-ink/50">
            Plays continuously on the venue&rsquo;s LED wall via repeat-on
            playback for your full 5-hour reception.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRender}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600"
        >
          <Clapperboard
            aria-hidden
            className="h-4 w-4"
            strokeWidth={1.75}
          />
          Render &amp; queue for USB delivery
        </button>
        <p className="text-center text-[11px] text-ink/50">
          {coupleName ? <>{coupleName} &middot; </> : null}Event{' '}
          {eventId.slice(0, 8)}
        </p>
      </aside>
    </div>
  );
}

function TemplateThumbnail({ template }: { template: LedTemplate }) {
  const [bg, accent1, accent2] = template.palette;
  // Placeholder gradient thumbnail — production swaps in the looping
  // `/templates/{slug}/thumb.mp4` once the FFmpeg + Lottie pipeline ships.
  // TODO(0005): replace with real looping thumb.mp4 preview.
  const gradient = `radial-gradient(120% 80% at 30% 30%, ${accent2} 0%, transparent 55%), radial-gradient(80% 60% at 70% 80%, ${accent1} 0%, transparent 50%), ${bg}`;
  return (
    <div
      aria-hidden
      className="relative flex aspect-[16/9] items-center justify-center overflow-hidden"
      style={{ background: gradient }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.08),_transparent_70%)]" />
      <span
        className="relative font-mono text-[10px] uppercase tracking-[0.3em]"
        style={{ color: accent2 }}
      >
        {template.name}
      </span>
    </div>
  );
}

function RenderQueuedCard({
  eventId,
  job,
  onReset,
}: {
  eventId: string;
  job: QueuedJob;
  onReset: () => void;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-emerald-300/50 bg-emerald-50/60 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden
          className="mt-0.5 h-6 w-6 text-emerald-700"
          strokeWidth={1.75}
        />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-emerald-900">
            Render queued
          </h2>
          <p className="text-sm text-emerald-900/80">
            Your 8K master loop is in the queue. We&rsquo;ll email you once the
            file is finalised and the USB master is being mailed to your venue
            contact.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-xl bg-cream/80 p-4 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Job ID
          </dt>
          <dd className="mt-1 font-mono text-sm font-medium text-ink">
            {job.id}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Template
          </dt>
          <dd className="mt-1 text-sm font-medium text-ink">
            {job.templateName}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Master loop
          </dt>
          <dd className="mt-1 text-sm font-medium text-ink">
            {job.loopLabel}
            {job.photoPool ? ' · Photo Pool blend' : ''}
          </dd>
        </div>
      </dl>

      <ul className="space-y-2 text-sm text-emerald-900/85">
        <li className="flex items-start gap-2">
          <Sparkles
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            strokeWidth={1.75}
          />
          <span>
            Render time runs ~25 minutes per 10-minute loop at 8K. Larger loops
            and Photo Pool blend extend that by ~30%.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Mail
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            strokeWidth={1.75}
          />
          <span>
            We&rsquo;ll email you when your USB master is ready &mdash;
            typically within 3 business days, in time for your venue tech to
            soak-test the loop pre-event.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Usb
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            strokeWidth={1.75}
          />
          <span>
            The USB is preloaded with the MP4 + a one-page LED-tech checklist
            (repeat-on, fullscreen, no audio). Backup copies of the file ship
            on a second USB and your Setnayan dashboard.
          </span>
        </li>
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-md border border-emerald-700/30 bg-cream px-3 py-1.5 text-xs font-medium text-emerald-900 hover:border-emerald-700/60"
        >
          <RefreshCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Render another loop
        </button>
        <a
          href={`/dashboard/${eventId}/orders`}
          className="text-xs font-medium text-emerald-900 underline-offset-4 hover:underline"
        >
          Track render status in Orders &rsaquo;
        </a>
      </div>
    </section>
  );
}
