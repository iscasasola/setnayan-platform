import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { registerGatesEnabled } from '@/lib/register-gates';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram } from '@/lib/monogram';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { VectorStudio } from './studio';
import { sanitizeStudioConfig } from '@/lib/monogram-studio-shared';
import { MonogramDraftRestore } from './draft-restore';
import { AnimatedMonogramUpgrade } from './animated-monogram-upgrade';
import { UploadMark } from './upload-mark';
import { eventOwnsAnimatedMonogram, ANIMATED_MONOGRAM_SERVICE_KEY } from '@/lib/animated-monogram';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';

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
 * MERGED surface (owner 2026-06-25 · informed reversal of 2026-06-21): the free
 * Vector Studio and the paid Animated-Monogram upgrade now live on ONE screen —
 * design your mark above, activate the draw-on animation in <AnimatedMonogramUpgrade>
 * below. This also un-breaks the purchase: the Studio "Get" CTA already routes
 * here, and the buy lives here again (the standalone /studio/animated-monogram
 * page now redirects in). The prior "upload your own" path stays removed.
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
  'upload-saved': { tone: 'ok', text: 'Your uploaded mark is now your monogram everywhere.' },
  'upload-cleared': { tone: 'ok', text: 'Removed the upload — back to your studio mark.' },
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
      'event_id, display_name, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_motion_key, monogram_custom_svg, monogram_uploaded_svg, monogram_studio_config',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  // Event-type backstop (0053 · 2026-06-28): the monogram maker is a wedding
  // surface. If this event type's profile doesn't enable 'monogram' (e.g. a
  // birthday), the nav + Studio hub already hide it — this guards a direct URL.
  // Wedding enables it → no redirect (byte-identical). Degrades to WEDDING_PROFILE.
  const profile = await resolveProfileByEvent(eventId);
  if (!surfaceEnabled(profile, 'monogram')) redirect(`/dashboard/${eventId}`);

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

  // Free/paid honesty line (council verdict 2026-07-17 §5.3): the studio's
  // "Animate the reveal" panel previews all five kinds free, but the LIVE site
  // plays the pick only with the paid Animated Monogram — say so where the
  // choice is made. Price from the admin catalog only (owner rule 2026-06-14).
  const ownsAnimated = await eventOwnsAnimatedMonogram(supabase, eventId);
  const animatedPricePhp = ownsAnimated
    ? null
    : ((await formatV2Sku(ANIMATED_MONOGRAM_SERVICE_KEY).catch(() => null))?.price_php ?? null);

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="sn-reveal space-y-2">
        <p className="sn-eye">
          Monogram maker
        </p>
        <h1 className="sn-h1">
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
      {/* The "Animate the reveal" panel lives INSIDE the Vector Studio (engine.ts
          #animbox) — owner 2026-06-23 "improve THIS animate the reveal … not a
          separate feature". The standalone MonogramAnimatePicker was retired; the
          studio panel is the single home for choosing the reveal. */}
      <VectorStudio
        eventId={eventId}
        initialConfig={studioConfig}
        initialNames={monogram.text}
        hasStudio={hasStudio}
        notice={studioNotice}
      />

      {/* ── The free/paid line, said where the choice is made (§5.3): a React
          sibling below the studio card — React never reaches into the inert
          editor subtree. Owned → confirmation; unowned → the honest gate +
          catalog price, anchored to the buy section below. ── */}
      {ownsAnimated ? (
        <p className="inline-flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
          The reveal you pick in the studio plays live on your wedding website.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/70">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          <span>
            Previewing reveals in the studio is always free — guests see your pick live with{' '}
            <a href="#animated-monogram" className="font-medium text-mulberry underline underline-offset-2 hover:text-mulberry-700">
              Animated Monogram{animatedPricePhp != null ? ` · ${formatPhp(animatedPricePhp)}` : ''}
            </a>
            .
          </span>
        </p>
      )}

      {/* ── Upload your own mark (owner 2026-07-17 — overrides the benchmark
          council's §9 upload deferral). Writes the long-dormant
          monogram_uploaded_svg, which outranks every other mark on the hero. ── */}
      <UploadMark
        eventId={eventId}
        hasUpload={typeof event.monogram_uploaded_svg === 'string' && Boolean(event.monogram_uploaded_svg)}
        monogramText={monogram.text}
      />

      {/* ── Paid Animated-Monogram upgrade, merged inline (owner 2026-06-25).
          Owned → live confirmation + preview; unowned → before/after + buy. ── */}
      <AnimatedMonogramUpgrade eventId={eventId} />
    </section>
  );
}
