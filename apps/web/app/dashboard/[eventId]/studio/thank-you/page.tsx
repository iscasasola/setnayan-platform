import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { eventSkuActive } from '@/lib/entitlements';
import { buildThankYouVideoPlan } from '@/lib/thank-you-video';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ThankYouMaker } from './_components/thank-you-maker';

export const metadata = { title: 'Thank-You Video · Studio · Setnayan' };
export const dynamic = 'force-dynamic';

/**
 * /dashboard/[eventId]/studio/thank-you — the Thank-You Video maker.
 *
 * ─── WHY THIS PAGE EXISTS ──────────────────────────────────────────────────
 * `PAPIC_ADDON_THANK_YOU` has been on sale at ₱2,499 since 2026-07-10 with **no
 * screen, no maker and no render step anywhere**. A couple could pay and receive
 * nothing at all. Owner ruled "BUILD IT" on 2026-08-10.
 *
 * ─── THE RENDER HAPPENS IN THE BROWSER ─────────────────────────────────────
 * Server assembles the PLAN (which photos, which owned track); the couple's own
 * browser encodes it via `lib/reel-render.ts` — the same engine already shipping
 * on Patiktok, Guest Stories and the creator teaser. Owner-locked 2026-06-18:
 * ₱0 server compute, no server ffmpeg. 🔑 The server render QUEUE is a phantom
 * (every job table empty in prod, no worker anywhere in the repo, and the one
 * that looked like a worker was deleted 2026-08-09 for faking completion) —
 * building against it would have shipped a film that queues forever.
 *
 * ─── UNOWNED IS A LOCKED PANEL, NOT A 404 ──────────────────────────────────
 * The Studio card is visible to everyone, so a 404 here would read as a broken
 * app rather than an unbought upgrade. The panel says what the film is and where
 * to get it — and deliberately renders NO plan, so an unowned visitor triggers
 * no gallery read at all.
 */
export default async function ThankYouVideoPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/${eventId}/studio/thank-you`);

  const supabase = await createClient();

  // ⚠ The ENTITLEMENT gate is here, not in the plan builder. Folding a paywall
  // into a data assembler puts the money decision somewhere nobody looks for it.
  const owned = await eventSkuActive(supabase, eventId, 'PAPIC_ADDON_THANK_YOU');

  const backHref = `/dashboard/${eventId}/studio`;

  if (!owned) {
    return (
      <div className="sn-col space-y-6 py-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Studio
        </Link>
        <div className="rounded-3xl border border-ink/10 bg-cream p-6 sm:p-8">
          <Lock className="h-5 w-5 text-ink/40" strokeWidth={1.75} aria-hidden />
          <h1 className="sn-h1 mt-3">Thank-You Video</h1>
          <p className="mt-2 max-w-xl text-base text-ink/65">
            A short film for the people who came — built from the photos of your
            day that everyone has agreed to share, set to music, and saved
            straight to your phone.
          </p>
          <p className="mt-4 text-sm text-ink/55">
            This one is part of your Papic add-ons. Add it from your Studio and
            it opens here.
          </p>
          <Link
            href={backHref}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
          >
            Back to Studio
          </Link>
        </div>
      </div>
    );
  }

  // Runs under the couple's OWN RLS-bound client, and `fetchTeaserFrames` inside
  // applies the public consent gates — so this cannot surface an unconsented
  // guest's photo even though the caller owns the event.
  const plan = await buildThankYouVideoPlan(supabase, eventId);

  return (
    <div className="sn-col space-y-6 py-8">
      {/* The shared masthead, not a hand-rolled header — this is a NEW page and
          `lint-page-masthead.mjs` only tolerates the 110 that predate it. It
          carries the back chevron, so no separate Studio link. */}
      <PageMasthead
        title="Thank-You Video"
        back={backHref}
        backLabel="Studio"
        lede="A short film for everyone who came. We use the photos of your day that are cleared to share — your own, and any guest shots where the guest agreed and you approved. It is made on this device and saved to your phone, so you can send it however you like."
      />

      <ThankYouMaker plan={plan} />
    </div>
  );
}
