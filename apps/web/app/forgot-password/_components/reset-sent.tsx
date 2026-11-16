'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { DoorNotice } from '@/app/_components/door/door-shell';
import { RESEND_AFTER_SECONDS, inboxFor, readResetEmail, rememberResetEmail, resendLabel } from '@/lib/reset-sent';

/**
 * ✉ THE SENT STATE (walker W1-B6, 16 Nov 2026): after the link is sent the page used to keep the same empty form and
 * the same button, so the only thing to do was send it again. Now it says where it went, where to look, and when it
 * may be sent again: "Sent to <email> · Open your email · Send again in 60s".
 *
 * 🔒 ANTI-ENUMERATION HOLDS: the address shown is the one this browser typed (kept in this tab, never in the URL or
 * on the server), and the line under it is the page's own neutral "if an account exists" — nothing here says whether
 * an account exists. Send again posts the SAME action with the same bot check (`lib/captcha-is-wired.test.ts`), so its
 * rate limit and its neutral answer are the form's own.
 */
export function ResetSent({
  requestPasswordReset,
}: {
  /** The page's own action (`../actions.ts`), handed down so this client file pulls no server module. */
  requestPasswordReset: (formData: FormData) => Promise<void>;
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [left, setLeft] = useState(RESEND_AFTER_SECONDS);

  useEffect(() => setEmail(readResetEmail()), []);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);

  const inbox = email ? inboxFor(email) : null;
  return (
    <div className="space-y-4" data-reset-sent="">
      <DoorNotice>
        <span className="block font-medium text-ink">Sent to {email ?? 'your email'}</span>
        If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder) — the link
        works once and expires after a short while.
      </DoorNotice>
      {inbox ? (
        <a href={inbox} target="_blank" rel="noopener noreferrer" className="button-primary w-full">
          Open your email
        </a>
      ) : (
        <p className="text-center text-sm font-medium text-ink">Open your email and tap the link.</p>
      )}
      {email ? (
        <form action={requestPasswordReset} className="space-y-3" onSubmit={() => setLeft(RESEND_AFTER_SECONDS)}>
          <input type="hidden" name="email" value={email} />
          <TurnstileField action="password_reset" />
          <SubmitButton className="button-secondary w-full" pendingLabel="Sending…" disabled={left > 0} aria-live="polite">
            {resendLabel(left)}
          </SubmitButton>
        </form>
      ) : (
        // No address in this tab (opened in a new one, or storage refused): Send again is the form again, after the wait.
        left > 0 ? (
          <button type="button" className="button-secondary w-full" disabled>
            {resendLabel(left)}
          </button>
        ) : (
          <Link href="/forgot-password" className="button-secondary w-full">
            {resendLabel(left)}
          </Link>
        )
      )}
    </div>
  );
}

/** Rides inside the request form and keeps the typed address in this tab when it is sent, for the sent state. */
export function RememberResetEmail() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const onSubmit = () => {
      const field = form.elements.namedItem('email');
      if (field instanceof HTMLInputElement) rememberResetEmail(field.value);
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, []);
  return <span ref={ref} hidden />;
}

/**
 * 🔁 THE EXPIRED LINK SENDS A NEW ONE, IN PLACE (walker W1-B5, 16 Nov 2026). `/reset-password` with a used or expired
 * link said "Request a fresh one" and its button only went back to the form — together with B6 the flow trapped
 * itself. Now the expired screen carries the SAME send the sent page uses (`requestPasswordReset`, its bot check, its
 * rate limit, its neutral answer), the address this tab typed already in the box, and lands on that sent page.
 */
export function ExpiredResend({
  requestPasswordReset,
}: {
  requestPasswordReset: (formData: FormData) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  useEffect(() => setEmail(readResetEmail() ?? ''), []);
  return (
    <form action={requestPasswordReset} className="space-y-3" data-expired-resend="">
      <RememberResetEmail />
      <label className="block space-y-1">
        <span className="block text-sm font-medium text-ink">Email</span>
        <input
          // field-ok: the door's own email box (DoorShell), the same shape as /forgot-password's
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="input-field"
        />
      </label>
      <TurnstileField action="password_reset" />
      <SubmitButton className="button-primary w-full" pendingLabel="Sending…">
        Send a new link
      </SubmitButton>
    </form>
  );
}
