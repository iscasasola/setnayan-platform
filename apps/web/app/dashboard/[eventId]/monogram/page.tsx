import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram, deriveMonogram } from '@/lib/monogram';
import { eventOwnsAnimatedMonogram } from '@/lib/animated-monogram';
import {
  MONOGRAM_MOTIONS,
  resolveMonogramMotion,
} from '@/lib/monogram-motion';
import {
  MAX_BESPOKE_ROUNDS_PER_EVENT,
  bespokeSvgToDataUri,
} from '@/lib/bespoke-monogram-shared';
import { bespokeStudioEnabled } from '@/lib/bespoke-monogram';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import { BespokeMonogramMark } from '@/app/_components/bespoke-monogram-mark';
import { sanitizeCipherConfig } from '@/lib/cipher-shared';
import { FeatureUsCard } from '@/app/dashboard/[eventId]/_components/feature-us-card';
import {
  MonogramMaker,
  MONO_FONT_OPTIONS,
  DEFAULT_FONT_FOR_STYLE,
} from './monogram-maker';
import { BespokeStudio, type BespokeCandidateView } from './bespoke-studio';
import { CipherStudio } from './cipher-studio';

export const metadata = { title: 'Monogram Maker · Setnayan' };

// Bespoke generation (4 vector marks + downloads) runs ~10–30s — keep the
// server-action invocation window comfortably above it on Vercel.
export const maxDuration = 60;

/**
 * /dashboard/[eventId]/monogram — the couple's standalone Monogram Maker.
 *
 * A returnable home (vs. the one-time onboarding step + the inline wizard card)
 * to craft the wedding monogram: initials + one of the 5 curated lockups, with
 * a live draw-on preview. Persists the SAME columns onboarding writes
 * (lib/monogram.ts model) so the design shows everywhere — chrome switcher, QR
 * center, landing hero. The free static/draw monogram is never gated.
 *
 * The "How it animates" section upsells the paid ANIMATED_MONOGRAM SKU
 * (₱2,499 · gated via orders, not a column). The Motion Library
 * (lib/monogram-motion.ts · 6 signatures) supersedes the 23-style picker
 * tracked in Monogram_Maker_Plan_2026-06-05.md — every motion previews free
 * in the maker; the saved one plays on the landing hero when the SKU is
 * owned.
 */

const VALID_STYLES = ['bar', 'script', 'duo', 'framed', 'infinity'] as const;
type MonoStyle = (typeof VALID_STYLES)[number];

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    bespoke?: string;
    bespoke_error?: string;
    cipher?: string;
    cipher_error?: string;
  }>;
};

// Customer-safe status lines for the cipher studio's redirect flags.
const CIPHER_NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  saved: { tone: 'ok', text: 'Your cipher monogram is now on your wedding website.' },
  cleared: { tone: 'ok', text: 'Back to your lettered monogram.' },
  invalid: { tone: 'error', text: 'That design could not be read — please try again.' },
  render: { tone: 'error', text: 'That design could not be rendered — please adjust and retry.' },
  save: { tone: 'error', text: 'Something went wrong saving — please try again.' },
  'not-found': { tone: 'error', text: 'This page is for the couple’s account.' },
};

// Customer-safe status lines for the bespoke studio's redirect flags.
const BESPOKE_NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  generated: { tone: 'ok', text: 'Setnayan AI sketched 4 new designs — they’re below.' },
  applied: { tone: 'ok', text: 'Your bespoke monogram is now on your wedding website.' },
  cleared: { tone: 'ok', text: 'Back to your lettered monogram.' },
  cap: { tone: 'error', text: 'You’ve used all your design rounds for this event.' },
  generation: {
    tone: 'error',
    text: 'Setnayan AI could not generate designs right now — please try again.',
  },
  save: { tone: 'error', text: 'Something went wrong saving — please try again.' },
  'not-found': { tone: 'error', text: 'That design could not be found.' },
  reported: {
    tone: 'ok',
    text: 'Thank you — your report is with the Setnayan team for review.',
  },
  'report-failed': {
    tone: 'error',
    text: 'Your report could not be sent — please try again.',
  },
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
      'event_id, display_name, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_motion_key, monogram_custom_svg, monogram_custom_generation_id, monogram_cipher_config',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const owns = await eventOwnsAnimatedMonogram(supabase, eventId).catch(() => false);
  const monogram = resolveMonogram(event);
  const motion = resolveMonogramMotion(event.monogram_motion_key);
  const motionLabel =
    MONOGRAM_MOTIONS.find((m) => m.key === motion)?.label ?? 'Drawn';

  const source = event.monogram_text?.trim() || deriveMonogram(event.display_name);
  const initialInitials =
    (source.match(/\p{L}/gu) ?? []).slice(0, 2).join('').toUpperCase() || 'AK';
  const initialStyle: MonoStyle = VALID_STYLES.includes(event.monogram_style as MonoStyle)
    ? (event.monogram_style as MonoStyle)
    : 'bar';
  // Typeface (2026-06-11 expansion): the stored key when valid, else the
  // lockup's default — mirrors the saveMonogram fallback.
  const storedFont = typeof event.monogram_font_key === 'string' ? event.monogram_font_key : '';
  const initialFont = MONO_FONT_OPTIONS.some((f) => f.key === storedFont)
    ? storedFont
    : DEFAULT_FONT_FOR_STYLE[initialStyle];

  // ── Bespoke studio state (Setnayan AI · Phase 2 of the monogram overhaul).
  // Latest round's candidates. The generations table may predate this deploy
  // on a drifted DB — degrade to an empty studio rather than crash (same
  // 42P01-tolerant posture as eventOwnsAnimatedMonogram).
  const { data: generationRows } = await supabase
    .from('bespoke_monogram_generations')
    .select('generation_id, svg_text, round')
    .eq('event_id', eventId)
    .order('round', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(8)
    .then(
      (r) => (r.error ? { data: [] as { generation_id: string; svg_text: string; round: number }[] } : r),
    );
  const rows = generationRows ?? [];
  const latestRound = rows[0]?.round ?? 0;
  const candidates: BespokeCandidateView[] = rows
    .filter((r) => r.round === latestRound)
    .map((r) => ({
      generationId: r.generation_id,
      dataUri: bespokeSvgToDataUri(r.svg_text),
    }));

  const bespokeNotice =
    BESPOKE_NOTICES[sp.bespoke_error ?? ''] ?? BESPOKE_NOTICES[sp.bespoke ?? ''] ?? null;

  // ── Cipher studio state (Phase 3 · the couple-positioned interlocking
  // monogram). The stored config re-validates through the same sanitizer the
  // save action uses, so a drifted/hand-edited row can never feed the editor
  // garbage. hasCipher = the saved custom svg came from THIS editor (a
  // bespoke-studio mark sets generation_id instead).
  const cipherConfig = sanitizeCipherConfig(event.monogram_cipher_config);
  const hasCipher = Boolean(cipherConfig && event.monogram_custom_svg);
  const cipherNotice =
    CIPHER_NOTICES[sp.cipher_error ?? ''] ?? CIPHER_NOTICES[sp.cipher ?? ''] ?? null;

  // When a bespoke mark is applied it REPLACES the typographic mark on the
  // hero (and animates with a container bloom, not the glyph-level Motion
  // Library signatures), so the "How it animates" section must branch on it
  // — otherwise the motion copy/preview would advertise an animation the
  // guest never sees while bespoke is live.
  const customSvg =
    typeof event.monogram_custom_svg === 'string' && event.monogram_custom_svg
      ? event.monogram_custom_svg
      : null;

  // ── Social Sharing & Featuring Program (migration 20261130000000) — the
  // live (un-revoked) consent row for THIS custom mark, so the Feature-Us
  // card flips to its "already allowed" state. artifact_ref keys on the
  // bespoke generation id ('custom' for cipher/hand-applied marks) so a
  // re-designed mark asks fresh. RLS couple policy scopes the read; degrade
  // to null on a drifted DB (table may post-date this deploy).
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
        href={`/dashboard/${eventId}/add-ons`}
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
          Your initials, your way — pick a lockup and watch it draw itself in. It
          shows on your wedding website, your QR codes, and across your dashboard.
        </p>
      </header>

      {/* ── Cipher studio — design the interlocking mark ── */}
      <CipherStudio
        eventId={eventId}
        defaultInitials={initialInitials}
        initialConfig={cipherConfig}
        hasCipher={hasCipher}
        notice={cipherNotice}
      />

      <MonogramMaker
        eventId={eventId}
        initialInitials={initialInitials}
        initialStyle={initialStyle}
        initialFont={initialFont}
        initialMotion={motion}
      />

      {/* ── Setnayan AI bespoke studio ── */}
      <BespokeStudio
        eventId={eventId}
        defaultInitials={initialInitials}
        roundsUsed={latestRound}
        maxRounds={MAX_BESPOKE_ROUNDS_PER_EVENT}
        candidates={candidates}
        activeGenerationId={event.monogram_custom_generation_id ?? null}
        hasCustom={Boolean(event.monogram_custom_svg)}
        enabled={bespokeStudioEnabled()}
        notice={bespokeNotice}
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

      {/* ── How it animates ── */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex justify-center sm:justify-start">
            {customSvg ? (
              <BespokeMonogramMark
                key={`anim-bespoke-${owns}`}
                svg={customSvg}
                color={monogram.color}
                size="lg"
                entrance={owns}
              />
            ) : (
              <AnimatedMonogramHero
                key={`anim-${monogram.text}-${motion}`}
                text={monogram.text}
                color={monogram.color}
                size="lg"
                motion={motion}
              />
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
                    <Check aria-hidden className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
                    Your bespoke monogram blooms in
                  </h2>
                  <p className="max-w-prose text-sm text-ink/65">
                    Your custom mark gently blooms in on your wedding
                    website&rsquo;s hero. The six motion signatures (Drawn, Foil,
                    Bloom, Editorial, Halo, Stardust) animate your lettered
                    monogram — switch back to lettering above to use one.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Make your bespoke mark bloom in
                  </h2>
                  <p className="max-w-prose text-sm text-ink/65">
                    Your custom mark shows on your wedding website&rsquo;s hero.
                    Upgrade to the Animated Monogram and it blooms in the moment a
                    guest lands.
                  </p>
                  <Link
                    href={`/dashboard/${eventId}/add-ons/animated-monogram`}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-700"
                  >
                    <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    See the Animated Monogram
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </>
              )
            ) : owns ? (
              <>
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Check aria-hidden className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
                  Your monogram plays the {motionLabel} motion
                </h2>
                <p className="max-w-prose text-sm text-ink/65">
                  It plays on your wedding website&rsquo;s hero every time a guest
                  lands. Pick a different motion above any time — six signatures,
                  all included.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold tracking-tight">
                  Make it move
                </h2>
                <p className="max-w-prose text-sm text-ink/65">
                  Upgrade to the Animated Monogram and the motion you pick above —
                  Drawn, Foil, Bloom, Editorial, Halo, or Stardust — plays the
                  moment a guest lands on your wedding website.
                </p>
                <Link
                  href={`/dashboard/${eventId}/add-ons/animated-monogram`}
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
