import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  Globe,
  Lock,
  ExternalLink,
  ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';
import { loadRecapCoupleSummary } from '@/lib/auto-recap';
import { getDriveOAuthConfig } from '@/lib/papic-drive';
import { publishRecap, unpublishRecap } from './actions';
import { RecapDriveNudge } from './_components/recap-drive-nudge';

// Iteration 0012 Papic — Auto-Recap (couple-side management surface).
//
// The recap is FREE and assembled automatically. This surface lets the couple
// turn the PUBLIC page on/off and shows exactly what publishing exposes (only
// public-safe content), so the privacy trade is never a surprise. The couple's
// full, unblurred set lives in the separate Kwento Magazine (linked here).

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

export default async function CoupleRecapPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}`);
  }

  const summary = await loadRecapCoupleSummary(eventId);
  const isPublished = summary.status === 'published';
  const publicUrl = summary.slug ? `${SITE_URL}/${summary.slug}/recap` : null;
  const shareImage = summary.slug ? `${SITE_URL}/api/og/recap/${summary.slug}` : undefined;

  // "Save the originals to Drive" nudge — only when the recap has real content,
  // no Drive is connected yet, and Drive OAuth is live. The recap is the
  // strongest emotional point of need; connecting here writes the one per-event
  // grant (provider='drive') that also covers Photo Delivery + Papic storage.
  const recapHasContent =
    summary.privatePhotos > 0 || summary.approvedKwentos > 0;
  const { data: recapDriveGrant } = await supabase
    .from('oauth_grants')
    .select('grant_id')
    .eq('event_id', eventId)
    .eq('provider', 'drive')
    .is('revoked_at', null)
    .maybeSingle();
  const showDriveNudge =
    recapHasContent && !recapDriveGrant && getDriveOAuthConfig().ready;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/studio/papic`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
        Back to Papic
      </Link>

      <header className="space-y-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Sparkles aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Your Recap</h1>
        <p className="max-w-prose text-sm text-ink/65">
          A living recap of your day — your love story, your photos, and the messages your guests
          left — assembled automatically. Free, and yours to share.
        </p>
      </header>

      {/* What's in your recap */}
      <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink">What&rsquo;s in your recap</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Stat n={summary.privatePhotos} label="photos" />
          <Stat n={summary.approvedKwentos} label="messages" />
          <Stat n={summary.guests ?? 0} label="guests" />
        </dl>
      </section>

      {/* Publish state */}
      <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-ink/5 text-ink/50'
            }`}
          >
            {isPublished ? (
              <Globe aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <Lock aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink">
              {isPublished ? 'Your recap is public' : 'Your recap is private'}
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {isPublished
                ? 'Anyone with the link can view it. You can take it down anytime.'
                : 'Only you can see this page until you publish it.'}
            </p>

            {isPublished && publicUrl ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={`/${summary.slug}/recap`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta underline-offset-4 hover:underline"
                >
                  View public recap
                  <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
                <ShareButtons
                  url={publicUrl}
                  title={`${event.display_name} — the day, in our words. Our Setnayan recap.`}
                  image={shareImage}
                />
              </div>
            ) : null}

            <form
              action={isPublished ? unpublishRecap : publishRecap}
              className="mt-4"
            >
              <input type="hidden" name="eventId" value={eventId} />
              <SubmitButton
                pendingLabel={isPublished ? 'Taking down…' : 'Publishing…'}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium ${
                  isPublished
                    ? 'border border-ink/15 bg-cream text-ink/75 hover:border-ink/30'
                    : 'bg-mulberry text-cream hover:bg-mulberry-600'
                }`}
              >
                {isPublished ? (
                  <>
                    <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Make it private
                  </>
                ) : (
                  <>
                    <Globe aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Publish my recap
                  </>
                )}
              </SubmitButton>
            </form>
          </div>
        </div>
      </section>

      {showDriveNudge ? (
        <RecapDriveNudge
          eventId={eventId}
          connectHref={`/api/oauth/drive/start?event_id=${eventId}`}
        />
      ) : null}

      {/* Privacy explainer — plain English */}
      <section className="rounded-2xl border border-gold/30 bg-gold/5 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck aria-hidden className="h-4.5 w-4.5 text-gold" strokeWidth={2} />
          What the public page shows
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          To keep your guests safe, the public recap is more careful than your private keepsake. It
          shows only:
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-ink/70">
          <li>
            • The <strong>{summary.publicPhotos}</strong>{' '}
            {summary.publicPhotos === 1 ? 'photo' : 'photos'} that are safe to share — the ones you
            curated, plus any privacy-screened, face-blurred wall photos.
          </li>
          <li>
            • The <strong>{summary.publicVoices}</strong> guest{' '}
            {summary.publicVoices === 1 ? 'message' : 'messages'} you approved to the Live Wall.
          </li>
          <li>• Your love story and the milestones you wrote.</li>
        </ul>
        <p className="mt-3 text-xs text-ink/55">
          Your full, unblurred photos and every guest message stay private — they live in your
          keepsake magazine, just for the two of you.
        </p>
      </section>

      {/* Link to the private keepsake */}
      <Link
        href={`/dashboard/${eventId}/studio/papic/magazine`}
        className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-5 hover:border-terracotta/40"
      >
        <ImageIcon aria-hidden className="h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-ink">Your keepsake magazine</span>
          <span className="block text-sm text-ink/60">
            The full, private edition — every photo unblurred. Para sa inyo lang.
          </span>
        </span>
        <ExternalLink aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
      </Link>
    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <dd className="font-display text-2xl text-mulberry">{n}</dd>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">{label}</dt>
    </div>
  );
}
