import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { registerGatesEnabled } from '@/lib/register-gates';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram } from '@/lib/monogram';
import { VectorStudio } from './studio';
import { sanitizeStudioConfig } from '@/lib/monogram-studio-shared';
import { MonogramDraftRestore } from './draft-restore';

export const metadata = { title: 'Monogram Maker · Setnayan' };

export const maxDuration = 60;

/**
 * /dashboard/[eventId]/monogram — the couple's standalone Monogram Maker.
 *
 * The wedding mark is set ONE way: the **Vector Studio** — compose it from
 * scratch with real font outlines, boolean interlock, and a mirrored pen (owner
 * 2026-06-21 "make the vector monogram the only screen for the monogram"). It
 * persists `events.monogram_custom_svg` (+ a re-editable `monogram_studio_config`),
 * the single canonical mark every surface reads — chrome switcher, QR centre,
 * landing hero, save-the-date. The free static mark is never gated.
 *
 * The page is intentionally studio-only: the prior "upload your own" path, the
 * Feature-Us opt-in, and the paid Animated-Monogram upsell were all removed. The
 * Animated Monogram SKU stays discoverable from the Studio add-ons hub.
 */

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    studio?: string;
    studio_error?: string;
  }>;
};

// Customer-safe status lines for the vector studio's redirect flags.
const STUDIO_NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  saved: { tone: 'ok', text: 'Your studio monogram is now your mark everywhere.' },
  cleared: { tone: 'ok', text: 'Removed your studio mark — back to your Setnayan mark.' },
  invalid: { tone: 'error', text: 'That design could not be read — please try again.' },
  render: { tone: 'error', text: 'That design could not be saved — please adjust and retry.' },
  save: { tone: 'error', text: 'Something went wrong saving — please try again.' },
  'not-found': { tone: 'error', text: 'This page is for the couple’s account.' },
};

export default async function MonogramMakerPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Register-to-use gate (flag-gated · owner 2026-06-21): the monogram is a public-identity
  // surface — an anonymous (unsecured) couple must create a free account to design it. The
  // signup flow converts the SAME anon session in place, then returns here. OFF → no gate.
  if (registerGatesEnabled() && user.is_anonymous) {
    redirect(`/signup?next=${encodeURIComponent(`/dashboard/${eventId}/monogram`)}`);
  }
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_motion_key, monogram_custom_svg, monogram_studio_config',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const monogram = resolveMonogram(event);

  // The EFFECTIVE custom mark (the Vector Studio mark) — drives the draft-restore
  // one-shot (it hides once a mark exists). Every downstream surface (chrome icon,
  // QR centre, website hero) reads the same `events.monogram_custom_svg`.
  const customSvg =
    typeof event.monogram_custom_svg === 'string' && event.monogram_custom_svg
      ? event.monogram_custom_svg
      : null;

  // ── Vector studio state (the from-scratch composer). hasStudio = a saved
  // studio mark exists (re-editable config present + a custom svg).
  const studioConfig = sanitizeStudioConfig(event.monogram_studio_config);
  const hasStudio = Boolean(studioConfig && event.monogram_custom_svg);
  const studioNotice = STUDIO_NOTICES[sp.studio_error ?? ''] ?? STUDIO_NOTICES[sp.studio ?? ''] ?? null;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Monogram maker
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your wedding monogram
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Design your mark from scratch in the Vector Studio. It shows on your
          wedding website, your QR codes, and across your dashboard.
        </p>
      </header>

      {/* ── Carry-through: restore a mark designed on the free public studio (pre-signup) ── */}
      <MonogramDraftRestore eventId={eventId} hasCustomMark={Boolean(customSvg)} />

      {/* ── Vector studio — the ONE way to set the wedding mark (real outlines · booleans · pen · symbols).
          The Monogram maker page is now studio-only (owner 2026-06-21 "make the vector monogram the only
          screen for the monogram"); the Feature-Us opt-in + the paid Animated-Monogram upsell that used to
          sit below it were removed. The Animated Monogram stays discoverable from the Studio add-ons hub. ── */}
      <VectorStudio
        eventId={eventId}
        initialConfig={studioConfig}
        initialNames={monogram.text}
        hasStudio={hasStudio}
        notice={studioNotice}
      />
    </section>
  );
}
