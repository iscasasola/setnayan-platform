import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles, Tv, Usb } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  LED_DEFAULT_LOOP_SECONDS,
  LED_TEMPLATES,
  findLedTemplate,
} from '@/lib/led-background';
import { LedBackgroundMaker } from './_components/led-background-maker';

export const metadata = { title: 'LED Background Maker · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

export default async function LedBackgroundPage({ params }: Props) {
  const { eventId } = await params;
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

  // Load the couple's existing default config (if any) so reopening the
  // editor restores their last draft. Service role since led_background_configs
  // has no couple-readable RLS policy yet (PR 1 shipped RLS-on / no-policies).
  const admin = createAdminClient();
  const { data: existingConfig } = await admin
    .from('led_background_configs')
    .select('config_id, template_id, config_json')
    .eq('event_id', eventId)
    .eq('is_default', true)
    .maybeSingle();
  const draftTemplate =
    findLedTemplate((existingConfig?.template_id as string) ?? '') ?? null;
  const draftConfigJson = (existingConfig?.config_json ?? {}) as Record<string, unknown>;
  const initialConfig = existingConfig
    ? {
        configId: existingConfig.config_id as string,
        templateSlug: draftTemplate?.slug ?? LED_TEMPLATES[0]!.slug,
        loopSeconds: Number(draftConfigJson.loop_duration_s ?? LED_DEFAULT_LOOP_SECONDS),
        photoPoolEnabled: Boolean(draftConfigJson.photo_pool_enabled),
      }
    : null;

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
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Pailaw · LED Background Maker
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          8K loop generators for your venue&rsquo;s LED wall
        </h1>
        <p className="max-w-2xl text-base text-ink/65">
          Pick a motion-graphics template, set your master loop length, and we
          render a seamless 8K MP4 that the venue&rsquo;s tech drops onto a USB
          stick for offline playback &mdash; no venue Wi-Fi required.
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <li className="flex items-start gap-2 rounded-lg border border-ink/10 bg-cream p-3 text-sm text-ink/75">
            <Sparkles
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
              strokeWidth={1.75}
            />
            <span>
              <span className="font-medium text-ink">10 templates</span>
              <span className="block text-xs text-ink/55">
                Filipino heritage, glamour, cinematic, minimal &mdash; each with
                layered motion graphics.
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2 rounded-lg border border-ink/10 bg-cream p-3 text-sm text-ink/75">
            <Tv
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
              strokeWidth={1.75}
            />
            <span>
              <span className="font-medium text-ink">8K master loop</span>
              <span className="block text-xs text-ink/55">
                7680&times;4320 H.264. Loops seamlessly to fill your 5-hour
                reception.
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2 rounded-lg border border-ink/10 bg-cream p-3 text-sm text-ink/75">
            <Usb
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
              strokeWidth={1.75}
            />
            <span>
              <span className="font-medium text-ink">USB delivery</span>
              <span className="block text-xs text-ink/55">
                We mail a venue-ready USB master so the LED tech plays it
                offline &mdash; no internet at the venue needed.
              </span>
            </span>
          </li>
        </ul>
      </header>

      <LedBackgroundMaker
        eventId={eventId}
        coupleName={event?.display_name ?? ''}
        templates={LED_TEMPLATES}
        initialConfig={initialConfig}
      />
    </section>
  );
}
