'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { panoodCameraAnonEnabled } from '@/lib/panood-camera-seats';
import { captchaOptions, captchaTokenFromForm } from '@/lib/turnstile';

// Panood · camera-operator (claimer) actions — the public camera-join surface.
//
// A DIRECT clone of claimPapicSeat (app/papic/actions.ts). The operator opens
// /panood/cam/[token] on their phone and claims the camera — the bind goes
// through the SECURITY DEFINER panood_claim_camera() RPC (migration
// 20270301500000) because panood_camera_operators RLS is control-room-only
// (couple + coordinator); the operator is neither, so the token is the
// capability and auth.uid() is the claimer identity.
//
// SAFETY — this action is reached ONLY from the token-gated /panood/cam route,
// never from an always-rendered page. Until migration 20270301500000 is applied,
// panood_claim_camera() is absent (42883), so the action surfaces a friendly
// error state rather than throwing.

type CameraClaimStatus =
  | 'claimed'
  | 'taken'
  | 'invalid'
  | 'unauthenticated'
  | string;

/**
 * Resolve whether a claim token points at a CLAIMABLE camera — without an
 * account. Runs on the admin client because an unauthenticated visitor can't
 * read panood_camera_operators under the control-room-only RLS. Returns only a
 * verdict (never camera data), and is used solely to decide whether to mint a
 * login-free anonymous session, so an invalid/taken/reissued (or bot-prefetched)
 * link never leaks an orphan anon identity. Graceful-degrade: a missing/legacy
 * table reads as 'invalid'. Mirrors seatClaimability() in app/papic/actions.ts.
 */
async function cameraClaimability(
  token: string,
): Promise<'claimable' | 'taken' | 'invalid'> {
  try {
    const admin = createAdminClient();
    const { data: cam, error } = await admin
      .from('panood_camera_operators')
      .select('claimer_user_id, revoked_at, status')
      .eq('claim_qr_token', token)
      .maybeSingle();
    if (error || !cam) return 'invalid';
    if (cam.revoked_at || cam.status === 'revoked') return 'invalid';
    if (cam.claimer_user_id) return 'taken';
    return 'claimable';
  } catch {
    return 'invalid';
  }
}

/**
 * Claim the camera a token points at and route to the operator publish view.
 * When the login-free flag is ON, an operator with no account never sees a login
 * wall: we mint a Supabase NATIVE anonymous session (a real auth.uid()) right
 * here — but ONLY after confirming the token is a claimable camera, so a stale/
 * taken/prefetched link can't leak an orphan anon row. The minted uid satisfies
 * the authenticated-only panood_claim_camera() RPC. Flag OFF → /login bounce.
 *
 * Byte-for-byte the claimPapicSeat shape: POST-only (form action), validate via
 * the RPC/admin, never leak the token in a thrown error, redirect to the claimed
 * state (?state=… on failure, or the live publish view on success).
 */
export async function claimPanoodCamera(formData: FormData) {
  const rawToken = formData.get('token');
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!token) redirect('/dashboard');

  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (panoodCameraAnonEnabled()) {
      const claimability = await cameraClaimability(token);
      if (claimability === 'taken') redirect(`/panood/cam/${token}?state=taken`);
      if (claimability !== 'claimable') {
        redirect(`/panood/cam/${token}?state=invalid`);
      }
      const { data: anon, error: anonError } =
        await supabase.auth.signInAnonymously({
          // Global Supabase captcha gates anonymous sign-in too. The claim form
          // carries a <TurnstileField> once captcha is on; empty → {} → no-op.
          options: captchaOptions(captchaTokenFromForm(formData)),
        });
      if (anonError || !anon.user) {
        console.error(
          '[claimPanoodCamera] anon sign-in failed:',
          anonError?.message,
        );
        redirect(`/panood/cam/${token}?state=error`);
      }
      user = anon.user;
    } else {
      redirect(`/login?next=${encodeURIComponent(`/panood/cam/${token}`)}`);
    }
  }

  const { data, error } = await supabase.rpc('panood_claim_camera', {
    p_token: token,
  });

  if (error) {
    // Missing RPC (pre-migration · 42883) or any failure → soft error state.
    redirect(`/panood/cam/${token}?state=error`);
  }

  const status =
    ((data ?? {}) as { status?: CameraClaimStatus }).status ?? 'error';

  switch (status) {
    case 'claimed':
      // Success → land back on the GET page, which now reads the claimed camera
      // (RLS-free path: the page resolves the operator's OWN binding via a
      // token+uid lookup on the admin client) and renders the local preview.
      redirect(`/panood/cam/${token}?state=joined`);
      break;
    case 'taken':
      redirect(`/panood/cam/${token}?state=taken`);
      break;
    case 'invalid':
      redirect(`/panood/cam/${token}?state=invalid`);
      break;
    case 'unauthenticated':
      redirect(`/login?next=${encodeURIComponent(`/panood/cam/${token}`)}`);
      break;
    default:
      redirect(`/panood/cam/${token}?state=error`);
  }
}
