'use client';

// Thank-You Video maker — the client half.
//
// The couple taps once; the film is encoded IN THIS BROWSER via
// lib/reel-render.ts (WebCodecs → mp4, MediaRecorder fallback) over a
// Setnayan-owned track, then saved to their device.
//
// DOWNLOAD-ONLY, deliberately. The finished file never uploads to R2, never
// lands in a DB row and never joins a hosted feed — the Guest Stories posture,
// not the Patiktok one. Two reasons, and they are not stylistic:
//   • The film is made of photos guests consented to SHARE, not to have
//     Setnayan host and redistribute on their behalf. The couple sending it is
//     a different act from us publishing it.
//   • Hosting it would need a delivery surface, a retention answer and a
//     takedown path for a guest who changes their mind. None of that exists
//     yet, and shipping the file without them would be the bigger defect.
// ⏭ In-app delivery to attendees is a named follow-up, not an oversight.
//
// 🪤 Imports the CLIENT-SAFE module only. lib/thank-you-video.ts pulls
// papic-gallery → uploads → 'server-only'; importing it here fails the
// production build (and NOT `tsc`, which does not model the RSC boundary).
// `thank-you-video.test.ts` pins that split.

import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Film, Loader2 } from 'lucide-react';
import { renderReel, type RenderClip } from '@/lib/reel-render';
import {
  THANK_YOU_FOOTER,
  THANK_YOU_PALETTE,
  type ThankYouPlan,
} from '@/lib/thank-you-video-shared';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/orders';
import { PaidMark } from '@/app/_components/paid-mark';
import {
  InlineCheckoutDrawer,
  type InlineCheckoutDrawerProps,
} from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

/**
 * What an UNOWNED film needs to be paid for at "Save to my phone" (2026-09-30).
 * `null` = the event holds the Thank-You Video, and the film saves freely.
 * Every figure comes from the server's catalogue read — none is typed here.
 */
export type ThankYouSaveCheckout = {
  /** A Thank-You Video order is submitted and being confirmed. */
  pending: boolean;
  /** Catalogue price in centavos, as a string; null = not on sale right now. */
  priceCentavos: string | null;
  pricePhp: number | null;
  vatRatePct: number;
  settings: InlineCheckoutDrawerProps['settings'];
};

const SKU_CODE = 'PAPIC_ADDON_THANK_YOU';

type Phase = 'idle' | 'rendering' | 'done' | 'error';

export function ThankYouMaker({
  plan,
  eventId,
  checkout = null,
}: {
  plan: ThankYouPlan;
  eventId: string;
  checkout?: ThankYouSaveCheckout | null;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  // Revoked on replace so a couple who re-renders three times does not hold
  // three encoded films in memory on a phone.
  const objectUrlRef = useRef<string | null>(null);

  const make = useCallback(async () => {
    setPhase('rendering');
    setProgress(0);
    setErrorMsg(null);
    try {
      const clips: RenderClip[] = plan.photos.map((p) => ({
        clipId: p.clipId,
        url: p.url,
        durationSec: null,
        kind: 'photo',
      }));

      const result = await renderReel({
        clips,
        template: {
          slug: 'thank-you',
          name: 'Thank you',
          palette: THANK_YOU_PALETTE,
          footerLabel: THANK_YOU_FOOTER,
        },
        durationSec: plan.targetSec,
        musicUrl: plan.musicUrl,
        beatGrid: plan.beatGrid,
        onProgress: setProgress,
      });

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(result.blob);
      objectUrlRef.current = url;
      setFileUrl(url);
      setPhase('done');
    } catch (e) {
      // A failed encode must say so. A silent return leaves the couple looking
      // at an idle button, which reads as "the app ignored me".
      setErrorMsg(e instanceof Error ? e.message : 'The film could not be made on this device.');
      setPhase('error');
    }
  }, [plan]);

  if (!plan.canRender) {
    return (
      <section className="rounded-2xl border border-warn-200/60 bg-warn-50/60 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-warn-900">
          <AlertTriangle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Not enough shareable photos yet
        </p>
        <p className="mt-2 text-sm text-warn-900/90">{plan.reason}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <p className="text-sm text-ink/70">
        Using <span className="font-medium">{formatCount(plan.photos.length)}</span>{' '}
        {plan.photos.length === 1 ? 'photo' : 'photos'}
        {plan.availableCount > plan.photos.length
          ? ` — the most recent of the ${formatCount(plan.availableCount)} that are cleared to share`
          : ''}
        , about {plan.targetSec} seconds
        {plan.musicLabel ? `, set to “${plan.musicLabel}”` : ', with no music yet'}.
      </p>

      {phase === 'rendering' ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-ink/70">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden />
            Making your film… {Math.round(progress * 100)}%
          </p>
          <p className="text-xs text-ink/50">
            This happens on your phone, so keep this screen open.
          </p>
        </div>
      ) : null}

      {phase === 'error' ? (
        <p role="alert" className="rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          {errorMsg}
        </p>
      ) : null}

      {phase === 'done' && fileUrl ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Check className="h-4 w-4 text-success-700" strokeWidth={2} aria-hidden />
            Your film is ready.
          </p>
          {checkout ? (
            /* UNOWNED — watch it here; the SAVE is the paid step. The player
               hides its own download control, so the only way to keep the
               film is the button below, which asks for the payment in place. */
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a silent-or-music montage with no speech has no captions to provide */}
              <video
                src={fileUrl}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                onContextMenu={(e) => e.preventDefault()}
                className="w-full rounded-xl"
              />
              <SavePanel eventId={eventId} checkout={checkout} />
            </>
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a silent-or-music montage with no speech has no captions to provide */}
              <video src={fileUrl} controls playsInline className="w-full rounded-xl" />
              <a
                href={fileUrl}
                download="setnayan-thank-you.mp4"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
              >
                <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Save to my phone
              </a>
            </>
          )}
        </div>
      ) : null}

      {phase !== 'rendering' ? (
        <button
          type="button"
          onClick={make}
          // `bg-mulberry` IS the CTA terracotta (#C24E25 · cream label 4.61:1 AA).
          // `bg-terracotta` resolves to the light gold #A9834B and gives 3.37:1 —
          // the contrast lint caught it, and the fix is the FILL, not the label.
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry/90"
        >
          <Film className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {phase === 'done' || phase === 'error' ? 'Make it again' : 'Make the film'}
        </button>
      ) : null}
    </section>
  );
}

/**
 * "Save to my phone" for a film the event does not own yet: the one paid step,
 * opened in place through the shipped checkout drawer. ◆ Pro is information,
 * never a padlock — the couple has already made the film.
 */
function SavePanel({ eventId, checkout }: { eventId: string; checkout: ThankYouSaveCheckout }) {
  if (checkout.pending) {
    return (
      <p role="status" className="rounded-xl bg-ink/5 px-3 py-2 text-sm text-ink/70">
        Your Thank-You Video payment is being confirmed. Once it is, come back and
        make the film again — it will save straight to your phone.
      </p>
    );
  }
  if (checkout.priceCentavos == null) {
    return (
      <p role="status" className="rounded-xl bg-ink/5 px-3 py-2 text-sm text-ink/70">
        Saving the film isn&rsquo;t on sale right now. You can still watch it here.
      </p>
    );
  }
  const priceLabel = checkout.pricePhp != null ? formatPhp(checkout.pricePhp) : null;
  return (
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-ink">
        <PaidMark state="try" label="Comes with the Thank-You Video" size="sm" />
        Save to my phone
      </p>
      <InlineCheckoutDrawer
        eventId={eventId}
        serviceKey={SKU_CODE}
        displayName="Thank-You Video"
        originalPriceCentavos={checkout.priceCentavos}
        vatRatePct={checkout.vatRatePct}
        settings={checkout.settings}
        triggerLabel={priceLabel ? `Save to my phone · ${priceLabel}` : 'Save to my phone'}
        triggerClassName="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 sm:w-auto"
      />
      <p className="text-[11px] text-ink/55">
        Once your payment is confirmed, make the film again here and it saves
        straight to your phone.
      </p>
    </div>
  );
}
