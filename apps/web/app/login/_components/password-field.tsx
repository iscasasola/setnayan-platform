'use client';

/**
 * Password field for the full-bleed sign-in rail — label row with a "Forgot?"
 * link on the right and a Show/Hide toggle inside the input, per the mockup.
 *
 * Uncontrolled `<input name="password">` so the existing signInWithPassword
 * server action consumes the FormData unchanged — the toggle only flips the
 * input `type` (password ⇄ text), never touches the value or name.
 */
import { useState } from 'react';
import Link from 'next/link';

export function PasswordField({ forgotHref = '/forgot-password' }: { forgotHref?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="sn-login-field">
      <div className="sn-login-field-row">
        <label htmlFor="password" className="sn-login-label">
          Password
        </label>
        <Link href={forgotHref} className="sn-login-forgot">
          Forgot?
        </Link>
      </div>
      <div className="sn-login-input-wrap">
        <input
          id="password"
          name="password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="sn-login-input"
        />
        <button
          type="button"
          className="sn-login-reveal"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
