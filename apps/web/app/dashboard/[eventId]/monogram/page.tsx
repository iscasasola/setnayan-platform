import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { registerGatesEnabled } from '@/lib/register-gates';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram } from '@/lib/monogram';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';
import { BespokeMonogramMark } from '@/app/_components/bespoke-monogram-mark';
import { FeatureUsCard } from '@/app/dashboard/[eventId]/_components/feature-us-card';
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
 * 2026-06-21 "make the vector monogram the only screen for the monogram"; the
 * earlier "upload your own" path is retired here). It persists
 * `events.monogram_custom_svg` (+ a re-editable `monogram_studio_config`), the
 * single canonical mark every surface reads — chrome switcher, QR centre,
 * landing hero, save-the-date. The free static mark is never gated.
 *
 * The "How it animates" section upsells the paid ANIMATED_MONOGRAM SKU
 * (₱2,499 · gated via orders, not a column): when owned, the couple's mark
 * blooms in on the wedding-website hero the moment a guest lands.
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
      'event_id, display_name, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_motion_key, monogram_custom_svg, monogram_custom_generation_id, monogram_studio_config',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const owns = await eventAnimatedMonogramActive(supabase, eventId).catch(() => false);
  const monogram = resolveMonogram(event);

  // `customSvg` is the EFFECTIVE custom mark every downstream surface reads — the
  // Vector Studio mark (the only way to set one here). Drives the maker preview +
  // the Feature-Us flow just like the chrome icon + website hero.
  const customSvg =
    typeof event.monogram_custom_svg === 'string' && event.monogram_custom_svg
      ? event.monogram_custom_svg
      : null;

  // ── Vector studio state (the from-scratch composer). hasStudio = a saved
  // studio mark exists (re-editable config present + a custom svg).
  const studioConfig = sanitizeStudioConfig(event.monogram_studio_config);
  const hasStudio = Boolean(studioConfig && event.monogram_custom_svg);
  const studioNotice = STUDIO_NOTICES[sp.studio_error ?? ''] ?? STUDIO_NOTICES[sp.studio ?? ''] ?? null;

  // ── Social Sharing & Featuring Program (migration 20261203000000) — the
  // live (un-revoked) consent row for THIS custom mark, so the Feature-Us
  // card flips to its "already allowed" state. artifact_ref keys on the
  // generation id ('custom' for studio/hand-applied marks) so a re-designed
  // mark asks fresh. RLS couple policy scopes the read; degrade to null on a
  // drifted DB (table may post-date this deploy).
  const shareArtifactRef = customSvg
    ? (event.monogram_custom_generation_id ?? 'custom')
    : null;
  const { data: shareConsent } = shareArtifactRef
    ? await supabase
        .from('marketing_share_consents')
        .select('consent_id, credit_mode')
        .eq('event_id', eventId)
        .eq('artifact_type', 'monogram')
        .eq('artifact_ref', shareArtifactRef)
        .is('revoked_at', null)
        .order('consented_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => (r.error ? { data: null } : r))
    : { data: null };

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

      {/* ── Vector studio — compose the mark from scratch (real outlines · booleans · pen · symbols) ── */}
      <VectorStudio
        eventId={eventId}
        initialConfig={studioConfig}
        initialNames={monogram.text}
        hasStudio={hasStudio}
        notice={studioNotice}
      />

      {/* ── Feature-us opt-in (Social Sharing Program) — custom marks only ── */}
      {customSvg && shareArtifactRef ? (
        <FeatureUsCard
          eventId={eventId}
          artifactType="monogram"
          artifactRef={shareArtifactRef}
          alreadyConsented={shareConsent ?? null}
          revalidatePath={`/dashboard/${eventId}/monogram`}
        />
      ) : null}

      {/* ── How it animates — the paid Animated Monogram SKU, on your studio mark ── */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex justify-center sm:justify-start">
            {customSvg ? (
              <BespokeMonogramMark
                key={`anim-${owns}`}
                svg={customSvg}
                color={monogram.color}
                size="lg"
                entrance={owns}
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full border border-dashed border-ink/20 text-center text-xs text-ink/40">
                Your mark
                <br />
                appears here
              </div>
            )}
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              How it animates
            </p>
            {customSvg ? (
              owns ? (
                <>
                  <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
                    <Check aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2.5} />
                    Your monogram blooms in
                  </h2>
                  <p className="max-w-prose text-sm text-ink/65">
                    Your mark gently blooms in on your wedding website&rsquo;s hero
                    the moment a guest lands.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Make your monogram bloom in
                  </h2>
                  <p className="max-w-prose text-sm text-ink/65">
                    Your mark shows on your wedding website&rsquo;s hero. Upgrade to
                    the Animated Monogram and it blooms in the moment a guest lands.
                  </p>
                  <Link
                    href={`/dashboard/${eventId}/studio/animated-monogram`}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-700"
                  >
                    <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    See the Animated Monogram
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </>
              )
            ) : (
              <>
                <h2 className="text-lg font-semibold tracking-tight">
                  Make it move
                </h2>
                <p className="max-w-prose text-sm text-ink/65">
                  Design your monogram in the Vector Studio above (or upload your
                  own), then upgrade to the Animated Monogram and your mark blooms
                  in the moment a guest lands on your wedding website.
                </p>
                <Link
                  href={`/dashboard/${eventId}/studio/animated-monogram`}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-700"
                >
                  <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  See the Animated Monogram
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
