import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram } from '@/lib/monogram';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import { BespokeMonogramMark } from '@/app/_components/bespoke-monogram-mark';
import { FeatureUsCard } from '@/app/dashboard/[eventId]/_components/feature-us-card';
import { VectorStudio } from './studio';
import { sanitizeStudioConfig } from '@/lib/monogram-studio-shared';
import { MonogramUploadCard } from './upload-card';
import { MonogramDraftRestore } from './draft-restore';

export const metadata = { title: 'Monogram Maker · Setnayan' };

export const maxDuration = 60;

/**
 * /dashboard/[eventId]/monogram — the couple's standalone Monogram Maker.
 *
 * Two ways to set the wedding mark: the **Vector Studio** (compose it from
 * scratch — real font outlines, boolean interlock, a mirrored pen) or **Upload
 * your own**. Both persist `events.monogram_custom_svg` (+ a re-editable
 * `monogram_studio_config` for the studio), the single canonical mark every
 * surface reads — chrome switcher, QR centre, landing hero, save-the-date. The
 * free static mark is never gated.
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
    upload?: string;
  }>;
};

// Customer-safe status lines for the "upload your own monogram" flow.
const UPLOAD_NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  ok: { tone: 'ok', text: 'Your monogram is uploaded — it’s now your mark everywhere.' },
  removed: { tone: 'ok', text: 'Removed your upload — back to your Setnayan mark.' },
  empty: { tone: 'error', text: 'Please choose a file to upload.' },
  too_big: { tone: 'error', text: 'That file is too large — please use one under 4 MB.' },
  bad_type: { tone: 'error', text: 'Please upload a PNG, JPG, or SVG image.' },
  bad_svg: { tone: 'error', text: 'We couldn’t read that SVG — try a PNG/JPG instead.' },
  bad_image: { tone: 'error', text: 'We couldn’t read that image — please try another file.' },
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
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_motion_key, monogram_uploaded_svg, monogram_custom_svg, monogram_custom_generation_id, monogram_studio_config',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const owns = await eventAnimatedMonogramActive(supabase, eventId).catch(() => false);
  const monogram = resolveMonogram(event);

  // The couple's own UPLOAD outranks the studio mark (owner rule 2026-06-15).
  // `customSvg` is the EFFECTIVE custom mark every downstream surface reads, so
  // the upload wins on the maker preview + the Feature-Us flow just like it does
  // in the chrome icon + website hero.
  const uploadedSvg =
    typeof event.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
      ? event.monogram_uploaded_svg
      : null;
  const customSvg =
    uploadedSvg ??
    (typeof event.monogram_custom_svg === 'string' && event.monogram_custom_svg
      ? event.monogram_custom_svg
      : null);
  const uploadedDataUri = uploadedSvg ? bespokeSvgToDataUri(uploadedSvg) : null;
  const uploadNotice = UPLOAD_NOTICES[sp.upload ?? ''] ?? null;

  // ── Vector studio state (the from-scratch composer). hasStudio = the
  // EFFECTIVE mark is this studio's (re-editable config present, a custom svg
  // exists, and no upload overrides it).
  const studioConfig = sanitizeStudioConfig(event.monogram_studio_config);
  const hasStudio = Boolean(studioConfig && event.monogram_custom_svg && !uploadedSvg);
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
          Design your mark from scratch in the Vector Studio, or upload your own.
          It shows on your wedding website, your QR codes, and across your
          dashboard.
        </p>
      </header>

      {uploadNotice ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            uploadNotice.tone === 'ok'
              ? 'border-success-200 bg-success-50 text-success-800'
              : 'border-terracotta/30 bg-terracotta/10 text-terracotta-700'
          }`}
        >
          {uploadNotice.text}
        </p>
      ) : null}

      {/* ── Carry-through: restore a mark designed on the free public studio (pre-signup) ── */}
      <MonogramDraftRestore eventId={eventId} hasCustomMark={Boolean(customSvg)} />

      {/* ── Upload your own (overrides everything below · owner rule 2026-06-15) ── */}
      <MonogramUploadCard eventId={eventId} activeDataUri={uploadedDataUri} />

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
