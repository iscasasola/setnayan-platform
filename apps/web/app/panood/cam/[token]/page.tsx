import Link from 'next/link';
import { Video, LogIn, CircleAlert, Radio } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPanoodCamera } from '@/app/panood/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { DoorShell, DoorNotice } from '@/app/_components/door/door-shell';
import {
  panoodCameraAnonEnabled,
  panoodStreamingEnabled,
  fetchClaimedCameraForUser,
} from '@/lib/panood-camera-seats';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { PanoodCameraPublish } from './_components/panood-camera-publish';

// Live Studio · camera-operator join (public)
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
          eventId={claimed.event_id}
          streamingEnabled={panoodStreamingEnabled()}
          // Their OWN token, already in their address bar — see the prop's note.
          // `fetchClaimedCameraForUser` has just proved this token is bound to
          // this user, so nothing is handed to anyone who didn't already hold it.
          claimToken={token}
        />
      );
    }
  }

  // ---- Terminal states (the claim action redirects back here with ?state=…). ----

  // Already claimed by someone else.
  if (state === 'taken') {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <CircleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Live camera
          </>
        }
        title="This camera's already taken."
        /* "the couple" is wrong on 15 of the 16 event types — the same correction
           the twin Papic screen already carries. This page resolves a CAMERA
           TOKEN, not an event, so there is no noun to derive; "the host" is
           type-neutral and true everywhere. */
        sub="Another operator already joined as this camera. Ask the host to send you a fresh camera link and you'll be good to go."
      >
        <Link href="/" className="button-secondary">
          Back to Setnayan
        </Link>
      </DoorShell>
    );
  }

  // 🔴 BOT CHECK REFUSED — the link is FINE. See the twin note in
  // app/papic/claim/[token]/page.tsx: the terminal branch below tells the
  // operator to ask for a new camera link, which is the wrong instruction when
  // all that happened is a tap landing before the check finished.
  const botCheckRefused = state === 'verify';

  // Invalid / expired / revoked / soft error.
  if (state === 'invalid' || state === 'error') {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <CircleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Live camera
          </>
        }
        title="This link isn't active."
        sub="The host may have reissued this camera. Ask them for your latest camera link and try again."
      >
        <Link href="/" className="button-secondary">
          Back to Setnayan
        </Link>
      </DoorShell>
    );
  }

  // The join CTA — one tap → claimPanoodCamera. When login-free is on and the
  // operator has no account, the action mints a native anonymous session on that
  // POST; otherwise it claims under their existing session. Shared by the
  // signed-in and login-free (no-account) paths.
  const showSignedInAs = Boolean(user && !isPlaceholderEmail(user.email));
  const joinCta = (
    <DoorShell
      eyebrow={
        <>
          <Radio aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Live camera
        </>
      }
      title="Join as a live camera"
      sub={
        <>
          Tap once and your phone becomes a live camera for the broadcast. The host&rsquo;s
          operator picks which camera is on screen — you just keep the shot framed. No app
          to install{user ? '' : ', no sign-up'}.
        </>
      }
    >
      {botCheckRefused ? (
        <DoorNotice kind="alert">
          That didn&rsquo;t get past our quick &ldquo;are you a robot?&rdquo; check &mdash;
          usually just a tap that landed a second too early. Your link is fine. Give it one
          more go.
        </DoorNotice>
      ) : null}
      <form action={claimPanoodCamera}>
        <input type="hidden" name="token" value={token} />
        {/*
          🔴 Same hole as the Papic claim screen, same fix. claimPanoodCamera has
          read `captcha_token` off this form since captcha landed and the form
          never supplied one. Login-free joining mints an ANONYMOUS session —
          precisely what Supabase's captcha gates — so without this an operator
          scanning the poster at the venue is refused with nothing to read.
          Renders nothing until a site key is set.
        */}
        <TurnstileField action="panood_camera_claim" />
        <SubmitButton pendingLabel="Joining…" className="button-primary w-full gap-2">
          <Video aria-hidden className="h-4 w-4" strokeWidth={2} />
          {user ? 'Join & open my camera' : 'Join this camera'}
        </SubmitButton>
      </form>
      {showSignedInAs ? (
        <p className="text-xs text-ink/55">Signed in as {user?.email ?? 'your account'}.</p>
      ) : null}
    </DoorShell>
  );

  // Signed in (any account, incl. a returning anonymous claimer) → join CTA.
  if (user) return joinCta;

  // Not signed in + login-free ON → the same CTA, no login wall (the POST mints
  // the anonymous session). This is the "scan → tap → camera" path.
  if (panoodCameraAnonEnabled()) return joinCta;

  // Not signed in + login-free OFF → the original sign-in gate (graceful degrade).
  return (
    <DoorShell
      eyebrow={
        <>
          <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Live camera
        </>
      }
      title="You're invited to operate a camera"
      /* 🪤 THE SIGNED-OUT ARM AGAIN. This branch said "One of the couple asked
         you… for their live broadcast" — the exact copy the twin Papic screen
         had already corrected, because it is wrong on 15 of the 16 event types
         and this page resolves a CAMERA TOKEN with no event to derive a noun
         from. It survived here for the same reason it survived there: every
         pass through this page was made while signed in, so the reviewed render
         was the other arm. A conditional's other arm is a surface nobody looked
         at — and a CLONE inherits the bug its twin already fixed. */
      sub="Someone asked you to run a camera for their live broadcast. Sign in to join — then your phone becomes a live camera and the operator can bring you on screen."
    >
      <Link
        href={`/login?next=${encodeURIComponent(`/panood/cam/${token}`)}`}
        className="button-primary w-full gap-2"
      >
        <LogIn aria-hidden className="h-4 w-4" strokeWidth={2} />
        Sign in to join this camera
      </Link>
    </DoorShell>
  );
}
