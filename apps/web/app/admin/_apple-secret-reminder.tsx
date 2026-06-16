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
import { Clock, Copy, Check, X } from 'lucide-react';

const SHOW_FROM = '2026-12-08T00:00:00'; // 3 days before expiry
const EXPIRES = '2026-12-11T00:00:00';
const DISMISS_KEY = 'setnayan.admin.apple-secret-reminder.2026-12';

// The prompt the owner pastes into Claude Code to renew the secret. Kept in
// one place so the copy button and the visible text never drift.
const PASTE_PROMPT = `Renew the Apple "Sign in with Apple" client secret for Setnayan. Run:
  node ~/.setnayan-apple-renew/mint.cjs
It prints a fresh 180-day JWT signed from the local .p8 (Team P95JPDWWB3, Key ZC2GJ3YF6V, Services ID com.setnayan.web — the .p8 itself never expires, this just re-mints the short-lived secret). Then paste that JWT into Supabase -> Auth -> Providers -> Apple -> "Secret Key (for OAuth)" and Save, and confirm "Continue with Apple" still works on setnayan.com/login.`;

export function AppleSecretReminder() {
  const [show, setShow] = useState(false);
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // localStorage can throw in private mode; treat as not-dismissed
    }
    const now = new Date();
    if (!dismissed && now >= new Date(SHOW_FROM)) {
      setShow(true);
      setExpired(now >= new Date(EXPIRES));
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore — worst case it reappears next load
    }
    setShow(false);
  }

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

  if (!show) return null;

  const accent = expired ? 'var(--m-mulberry)' : 'var(--m-orange-2)';

  return (
    <div
      role="status"
      className="mb-6 rounded-lg border p-4 sm:p-5"
      style={{
        background: 'var(--m-paper)',
        borderColor: expired ? 'var(--m-mulberry)' : 'var(--m-line)',
        boxShadow: 'var(--m-shadow-sm)',
      }}
    >
      <div className="flex items-start gap-3">
        <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
              {expired
                ? 'Apple Sign-in secret has EXPIRED — renew now'
                : 'Renew the Apple Sign-in secret (expires Dec 11, 2026)'}
            </h3>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss reminder"
              className="shrink-0 rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-ink/70"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <p className="mt-1 text-sm" style={{ color: 'var(--m-slate)' }}>
            {expired
              ? '"Continue with Apple" on the login page is failing until the secret is refreshed. '
              : 'The Supabase Apple client secret is a 6-month JWT and is about to lapse. '}
            Paste this prompt into Claude Code to re-mint and reinstall it (takes ~1 min):
          </p>

          <pre
            className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border px-3 py-2.5 text-xs leading-relaxed"
            style={{
              background: 'var(--m-paper-2)',
              borderColor: 'var(--m-line)',
              color: 'var(--m-ink)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {PASTE_PROMPT}
          </pre>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyPrompt}
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-white"
              style={{ background: 'var(--m-mulberry)' }}
            >
              {copied ? (
                <>
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Copied
                </>
              ) : (
                <>
                  <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Copy prompt
                </>
              )}
            </button>
            <span className="text-xs" style={{ color: 'var(--m-slate)' }}>
              Then dismiss this once it&apos;s done.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
