import Link from 'next/link';
import { ArrowRight, Camera, CircleAlert } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppInstallBanner } from './_components/app-install-banner';
import { JoinForwarder } from './_components/join-forwarder';

// Papic · HYBRID join (public) — `/papic/join/[token]`.
//
// One entry link for every Papic camera QR, designed to do the right thing on
// every device:
//
//   • NATIVE APP INSTALLED — the OS intercepts this URL as a Universal Link
//     (iOS) / App Link (Android) BEFORE the page loads, scoped to /papic/* in
//     apps/web/public/.well-known/{apple-app-site-association,assetlinks.json},
//     and opens the Setnayan app straight onto the capture surface. This page
//     only needs to be a valid, reachable target at that path — which it is.
//
//   • EVERYWHERE ELSE (mobile browser, desktop, PWA) — the page resolves which
//     KIND of token this is and forwards into the EXISTING web capture flow. We
//     do NOT duplicate any camera UI here:
//       – a crew SEAT token  → /papic/claim/[token]  (login-free seat claim)
//       – a guest PERSONAL QR → /papic/me/[token]    (Limited roll camera)
//     A ?kind=seat|guest hint skips the irrelevant lookup; absent, we infer it.
//
// The forward is a thin interstitial (not a hard server redirect) so the
// page-local smart install banner can paint, and so the page stays a valid
// Link target. A no-JS <meta refresh> + a visible "Continue" link make the
// camera reachable even with JavaScript disabled.
//
// PUBLIC, token-gated. We resolve the token kind on the admin client (an
// anonymous visitor can't read paparazzi_seats / guests under RLS) but NEVER
// return any row data — only a verdict on where to forward. A bad/reissued
// token lands on a friendly dead-end, never an error or a leak.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Join the photo crew · Papic',
  description: 'Open your Papic camera and start shooting for the couple.',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ kind?: string }>;
};

type Kind = 'seat' | 'guest';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Papic · photo crew
        </p>
        {children}
      </div>
    </main>
  );
}

/**
 * Resolve which existing web flow this token belongs to — without leaking any
 * row data. Tries the hinted kind first (a tiny latency win on a printed QR),
 * then falls back to probing the other table. Both reads are single indexed
 * lookups on the admin client. Returns null when the token resolves to neither
 * (reissued / deleted / never valid) so the page can show a clean dead-end.
 */
async function resolveKind(token: string, hint?: Kind): Promise<Kind | null> {
  const admin = createAdminClient();

  const isSeat = async (): Promise<boolean> => {
    try {
      const { data } = await admin
        .from('paparazzi_seats')
        .select('seat_id')
        .eq('claim_qr_token', token)
        .maybeSingle();
      return Boolean(data);
    } catch {
      return false;
    }
  };

  const isGuest = async (): Promise<boolean> => {
    try {
      const { data } = await admin
        .from('guests')
        .select('guest_id')
        .eq('qr_token', token)
        .is('deleted_at', null)
        .maybeSingle();
      return Boolean(data);
    } catch {
      return false;
    }
  };

  // Honor the hint first; if it doesn't resolve, fall through to the other kind
  // (a hint is an optimization, never a hard assertion).
  const order: Kind[] = hint === 'guest' ? ['guest', 'seat'] : ['seat', 'guest'];
  for (const kind of order) {
    if (kind === 'seat' && (await isSeat())) return 'seat';
    if (kind === 'guest' && (await isGuest())) return 'guest';
  }
  return null;
}

export default async function PapicJoinPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { kind: kindParam } = await searchParams;
  const cleanToken = token?.trim();
  const hint: Kind | undefined =
    kindParam === 'seat' ? 'seat' : kindParam === 'guest' ? 'guest' : undefined;

  const kind = cleanToken ? await resolveKind(cleanToken, hint) : null;

  // Neither a live seat nor a live guest QR → friendly dead-end (never leak why).
  if (!cleanToken || !kind) {
    return (
      <Shell>
        <CircleAlert aria-hidden className="mx-auto mt-3 h-7 w-7 text-terracotta" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This link isn&rsquo;t active</h1>
        <p className="mt-2 text-sm text-ink/65">
          This Papic link doesn&rsquo;t open a camera right now. Ask the couple to
          re-share your link and try again.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/10"
        >
          Back to Setnayan
        </Link>
      </Shell>
    );
  }

  // Forward target — the EXISTING web flow for this token kind.
  const target =
    kind === 'seat'
      ? `/papic/claim/${encodeURIComponent(cleanToken)}`
      : `/papic/me/${encodeURIComponent(cleanToken)}`;

  // Store links are env-gated: empty until the owner publishes + enrolls (App
  // Store / Play). The banner degrades gracefully to an "available soon" line.
  const iosUrl = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL || undefined;
  const androidUrl = process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL || undefined;

  return (
    <Shell>
      {/* No-JS fallback: a scanner with JS disabled still reaches the camera. */}
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${target}`} />
      </noscript>

      <AppInstallBanner iosUrl={iosUrl} androidUrl={androidUrl} />

      <Camera aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
      <h1 className="mt-3 text-xl font-semibold tracking-tight">
        Opening your camera&hellip;
      </h1>
      <p className="mt-2 text-sm text-ink/65">
        One tap turns your phone into a candid camera for the wedding. Every shot
        lands straight in the couple&rsquo;s gallery — no app to install.
      </p>

      <Link
        href={target}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition hover:bg-mulberry-600"
      >
        Continue
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
      </Link>

      {/* Auto-forward once the banner has had a beat to paint. */}
      <JoinForwarder href={target} />
    </Shell>
  );
}
