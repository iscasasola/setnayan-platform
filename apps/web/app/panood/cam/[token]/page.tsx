import Link from 'next/link';
import { Video, LogIn, CircleAlert, Radio } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPanoodCamera } from '@/app/panood/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  panoodCameraAnonEnabled,
  fetchClaimedCameraForUser,
} from '@/lib/panood-camera-seats';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { PanoodCameraPublish } from './_components/panood-camera-publish';

// Panood · camera-operator join (public)
//
// A DIRECT clone of the Papic seat-claim page (/papic/claim/[token]). The couple
// shares one link per camera (/panood/cam/[token]). The operator opens it on
// their phone and joins as that camera — binding it to their session so the
// controller can light their feed.
//
// LOGIN-FREE (flag NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED): when ON, the operator
// never sees a sign-in wall — one "Join as Camera N" tap mints a native
// anonymous session + claims the camera + drops them in the local preview. The
// tap can't be zero: the claim happens on the POST, NEVER on this GET, so a
// chat-app link-preview bot can't silently claim the camera. When OFF, the
// original sign-in gate is shown (graceful degrade).
//
// The claim itself goes through the SECURITY DEFINER panood_claim_camera() RPC
// (the camera isn't theirs yet, so RLS can't grant it — the token is the
// capability). This page renders the join CTA / sign-in gate + the taken/invalid
// states, and — after a successful claim — the local camera-publish view.
//
// Public route — no dashboard chrome. Token-gated; nothing here reads a camera
// row directly under the operator's session (RLS would block a non-control-room
// caller anyway). The post-claim read uses the admin client but is hard-scoped
// to the operator's OWN binding (claimer_user_id = auth.uid()).

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 shadow-sm">
        {children}
      </div>
    </main>
  );
}

export default async function PanoodCameraJoinPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { state } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ---- Post-claim: if this user already owns this camera, show the live
  //      publish view. Checked first so re-opening the link (or the ?state=joined
  //      redirect after a successful claim) lands straight in the preview. The
  //      admin read is hard-scoped to the operator's OWN binding. ----
  if (user) {
    const admin = createAdminClient();
    const claimed = await fetchClaimedCameraForUser(admin, token, user.id);
    if (claimed) {
      return (
        <PanoodCameraPublish
          cameraIndex={claimed.camera_index}
          label={claimed.label}
        />
      );
    }
  }

  // ---- Terminal states (the claim action redirects back here with ?state=…). ----

  // Already claimed by someone else.
  if (state === 'taken') {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CircleAlert aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          This camera&rsquo;s already taken
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          Another operator already joined as this camera. Ask the couple to send
          you a fresh camera link and you&rsquo;ll be good to go.
        </p>
      </Shell>
    );
  }

  // Invalid / expired / revoked / soft error.
  if (state === 'invalid' || state === 'error') {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CircleAlert aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          This link isn&rsquo;t active
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          The couple may have reissued this camera. Ask them for your latest
          camera link and try again.
        </p>
      </Shell>
    );
  }

  // The join CTA — one tap → claimPanoodCamera. When login-free is on and the
  // operator has no account, the action mints a native anonymous session on that
  // POST; otherwise it claims under their existing session. Shared by the
  // signed-in and login-free (no-account) paths.
  const showSignedInAs = Boolean(user && !isPlaceholderEmail(user.email));
  const joinCta = (
    <Shell>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Radio aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
        Join as a live camera
      </h1>
      <p className="mt-3 text-sm text-ink/65">
        Tap once and your phone becomes a live camera for the wedding broadcast.
        The couple&rsquo;s operator picks which camera is on screen — you just keep
        the shot framed. No app to install{user ? '' : ', no sign-up'}.
      </p>
      <form action={claimPanoodCamera} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <SubmitButton
          pendingLabel="Joining…"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
        >
          <Video aria-hidden className="h-4 w-4" strokeWidth={2} />
          {user ? 'Join & open my camera' : 'Join this camera'}
        </SubmitButton>
      </form>
      {showSignedInAs ? (
        <p className="mt-3 text-xs text-ink/50">
          Signed in as {user?.email ?? 'your account'}.
        </p>
      ) : null}
    </Shell>
  );

  // Signed in (any account, incl. a returning anonymous claimer) → join CTA.
  if (user) return joinCta;

  // Not signed in + login-free ON → the same CTA, no login wall (the POST mints
  // the anonymous session). This is the "scan → tap → camera" path.
  if (panoodCameraAnonEnabled()) return joinCta;

  // Not signed in + login-free OFF → the original sign-in gate (graceful degrade).
  return (
    <Shell>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Video aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
        You&rsquo;re invited to operate a camera
      </h1>
      <p className="mt-3 text-sm text-ink/65">
        One of the couple asked you to run a camera for their live broadcast.
        Sign in to join — then your phone becomes a live camera and the operator
        can bring you on screen.
      </p>
      <Link
        href={`/login?next=${encodeURIComponent(`/panood/cam/${token}`)}`}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
      >
        <LogIn aria-hidden className="h-4 w-4" strokeWidth={2} />
        Sign in to join this camera
      </Link>
    </Shell>
  );
}
