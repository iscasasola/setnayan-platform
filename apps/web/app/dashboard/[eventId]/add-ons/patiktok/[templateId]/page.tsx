import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Music, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  categoryLabel,
  findPatiktokTemplate,
  type PatiktokTemplate,
} from '@/lib/patiktok';
import { RenderForm } from '../_components/render-form';

type Props = {
  params: Promise<{ eventId: string; templateId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { templateId } = await params;
  const t = findPatiktokTemplate(templateId);
  return {
    title: t ? `${t.name} · Patiktok · Setnayan` : 'Patiktok · Setnayan',
  };
}

export default async function PatiktokTemplateDetail({ params }: Props) {
  const { eventId, templateId } = await params;
  const template = findPatiktokTemplate(templateId);
  if (!template) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons/patiktok`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to templates
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          {categoryLabel(template.category)} · Patiktok template
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {template.name}
        </h1>
        <p className="max-w-prose text-base text-ink/65">{template.vibe}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="space-y-3">
          <Preview
            template={template}
            coupleName={event?.display_name ?? ''}
          />
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
            9:16 · 1080×1920 · {template.defaultDurationSec}s default
          </p>
        </div>

        <div className="space-y-5">
          <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              Render this reel
            </h2>
            <p className="text-sm text-ink/65">
              Pick the mimic duration — guests will perform for this length on
              the X-mark. We&rsquo;ll auto-trim each clip to beat sync during
              compilation.
            </p>
            <RenderForm
              templateSlug={template.slug}
              templateName={template.name}
              defaultDurationSec={template.defaultDurationSec}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Music aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
              Paired music
            </h2>
            <p className="text-sm text-ink/65">
              This template pairs with a Setnayan-owned AI-generated track from
              our Suno Premier catalogue (Bridgerton · Pop · Hip-hop · Jazz ·
              Acoustic). Music loops seamlessly across the full compilation —
              no per-clip restart.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
              Music selection UI · TODO(0017)
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Sparkles aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
              What ships in the Station Pack
            </h2>
            <ul className="ml-4 list-disc space-y-1 text-sm text-ink/70">
              <li>Physical X-mark floor sticker (50×50 cm vinyl, shipped 3–5 days)</li>
              <li>Companion signage card explaining the mimic flow</li>
              <li>Printable booth-operator QR (re-scannable anytime mid-event)</li>
              <li>9:16 vertical compilation export, 1080p (or 4K with the 4K Upgrade)</li>
              <li>Downloadable MP4 backup with Setnayan-owned music</li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}

function Preview({
  template,
  coupleName,
}: {
  template: PatiktokTemplate;
  coupleName: string;
}) {
  const [bg, accent1, accent2, dark] = template.palette;
  const display = coupleName.length > 0 ? coupleName : 'Your name & Their name';
  return (
    <div
      aria-hidden
      className="relative mx-auto flex w-full max-w-[360px] aspect-[9/16] items-center justify-center overflow-hidden rounded-2xl border border-ink/10"
      style={{ backgroundColor: bg }}
    >
      <div
        className="absolute inset-x-0 top-0 h-2"
        style={{ backgroundColor: accent1 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex h-3 items-stretch"
        style={{ backgroundColor: dark }}
      >
        <span className="block flex-1" style={{ backgroundColor: accent1 }} />
        <span className="block flex-1" style={{ backgroundColor: accent2 }} />
        <span className="block flex-1" style={{ backgroundColor: dark }} />
        <span className="block flex-1" style={{ backgroundColor: bg }} />
      </div>
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.3em]"
          style={{ color: dark }}
        >
          Patiktok · 9:16
        </p>
        <p
          className={`text-3xl tracking-tight ${template.fontClass}`}
          style={{ color: dark }}
        >
          {display}
        </p>
        <span
          className="inline-block h-px w-16"
          style={{ backgroundColor: accent2 }}
        />
        <p
          className="font-mono text-[10px] uppercase tracking-[0.25em]"
          style={{ color: accent2 }}
        >
          {template.name}
        </p>
        <p
          className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em]"
          style={{ color: dark, opacity: 0.55 }}
        >
          [preview placeholder]
        </p>
      </div>
    </div>
  );
}
