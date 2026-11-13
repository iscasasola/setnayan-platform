'use client';

/**
 * One-off ops reminder: the Apple "Sign in with Apple" client secret in
 * Supabase is a static JWT that Apple caps at ~6 months. The current one
 * expires 2026-12-11. This card surfaces on the admin home starting 3 days
 * before (2026-12-08) with a copy-paste prompt the owner drops into Claude
 * Code to re-mint + reinstall the secret.
 *
 * Owner directive 2026-06-15: "add a reminder on my admin account to renew
 * this and place a prompt for me to paste on claude. 3 days before that day
 * comes." (Chosen over the always-on launchd auto-renewer, which was removed.)
 *
 * Self-contained + easy to delete once 2026-12 passes: it's one client
 * component + one mount line in admin/page.tsx, no schema, no server action.
 * Date-gated + dismissible (per-browser via localStorage). Renders nothing
 * on the server / first paint to avoid a hydration mismatch, then reveals
 * after mount once the date + dismissal checks pass.
 *
 * To roll the window forward after a renewal, bump SHOW_FROM / EXPIRES and
 * the localStorage key suffix below.
 */

import { useEffect, useState } from 'react';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-action';

const SHOW_FROM = '2026-12-08T00:00:00'; // 3 days before expiry
const EXPIRES = '2026-12-11T00:00:00';

// The prompt the owner pastes into Claude Code to renew the secret. Kept in
// one place so the copy button and the visible text never drift.
const PASTE_PROMPT = `Renew the Apple "Sign in with Apple" client secret for Setnayan. Run:
  node ~/.setnayan-apple-renew/mint.cjs
It prints a fresh 180-day JWT signed from the local .p8 (Team P95JPDWWB3, Key ZC2GJ3YF6V, Services ID com.setnayan.web — the .p8 itself never expires, this just re-mints the short-lived secret). Then paste that JWT into Supabase -> Auth -> Providers -> Apple -> "Secret Key (for OAuth)" and Save, and confirm "Continue with Apple" still works on setnayan.com/login.`;

/**
 * 🔔 A NOTICE NOW (ONE NOTICE SYSTEM, owner approved 14 Nov 2026). Before the expiry it is a TO DO ("Not now" brings it
 * back after 7 days). Once expired it is LIVE and cannot be hidden — sign-in with Apple is failing for other people.
 * The paste prompt is one press away (Copy prompt); the reason sits behind the ⓘ.
 */
export function AppleSecretReminder() {
  const [phase, setPhase] = useState<'none' | 'due' | 'expired'>('none');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const now = new Date();
    if (now >= new Date(EXPIRES)) setPhase('expired');
    else if (now >= new Date(SHOW_FROM)) setPhase('due');
  }, []);

  function copyPrompt() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(PASTE_PROMPT).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // clipboard write can fail on http / permission denial — silent
      },
    );
  }

  if (phase === 'none') return null;
  const expired = phase === 'expired';
  return (
    <Notice
      kind={expired ? 'live' : 'todo'}
      tone={expired ? 'problem' : undefined}
      closable={expired ? false : undefined}
      blocking={!expired}
      noticeKey={expired ? 'apple-secret:2026-12:expired' : 'apple-secret:2026-12'}
      title={expired ? 'Apple sign-in has stopped working — renew the secret' : 'Renew the Apple sign-in secret by Dec 11'}
      detail={
        <>
          {expired
            ? '“Continue with Apple” on the login page fails until the secret is renewed. '
            : 'The Apple sign-in secret lasts six months and is about to run out. '}
          Copy the prompt and paste it into Claude Code — it takes about a minute.
        </>
      }
      actions={
        <button type="button" onClick={copyPrompt} className={NOTICE_ACTION} data-apple-copy-prompt="">
          {copied ? 'Copied' : 'Copy prompt'}
        </button>
      }
    />
  );
}
