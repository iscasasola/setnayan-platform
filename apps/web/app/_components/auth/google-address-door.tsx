'use client';

/**
 * GoogleAddressDoor — a TYPED Google address goes through the SAME door as the
 * "Continue with Google" button (owner 2026-10-18: "we want people to login via
 * google and typing their google account be same").
 *
 * Placed INSIDE an email form (the sign-in card, /signup, the wedding
 * onboarding's account screen). It watches the form's `email` input; when the
 * address is a Google one (lib/google-address.ts — gmail.com / googlemail.com by
 * name, a Workspace domain by its MX, asked server-side by DOMAIN only) it folds
 * away every part of the form marked `data-password-only` and shows one button:
 * the shell's own Google button, with the address handed to Google as
 * `login_hint`. Nothing new behind it —
 *   web      → `signInWithGoogle` (the server action the web row posts to)
 *   desktop  → `signInWithProviderDesktop('google', …)` (the Tauri loopback)
 *   phone    → `signInWithProviderNative('google', …)` (the system browser)
 * — so the callback, the account (Supabase links one verified address to one
 * user), the vendor intent, the You card and every protection are the ones the
 * Google button already has.
 *
 * Shown ONLY where this shell shows the Google button (`enabled` = the shell
 * gate, and the Google flag): where the button is hidden, the form is untouched.
 *
 * "Use a password instead" folds the password back for that domain — an account
 * made with a password on a Google address (3 in prod, 2026-10-18) must never be
 * stranded if Google refuses it (e.g. a Workspace admin blocks the app).
 *
 * ⚠ It drives the form through the DOM on purpose: the forms it sits in are
 * server components (/signup) as well as client ones, and one mechanism for all
 * of them beats three copies. It only ever touches `style.display`, `disabled`
 * and a `data-google-address` flag on elements React does not manage those on.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleGIcon } from '@/app/_components/oauth-icons';
import { signInWithGoogle } from '@/app/auth/oauth-actions';
import { signInWithProviderDesktop } from '@/lib/desktop-oauth';
import { envFlagEnabled } from '@/lib/env-flag';
import { OAUTH_VERB } from '@/lib/oauth-words';
import { OAuthTermsLine } from '@/app/_components/auth/oauth-terms-line';
import { termsFirst } from '@/app/_components/auth/terms-first';
import {
  GOOGLE_ADDRESS_WORDS,
  emailDomain,
  googleDomainCheckUrl,
  googleLoginHint,
  googleDoorShell,
  isGoogleNamedDomain,
} from '@/lib/google-address';

const GOOGLE_ENABLED = envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED);

const BTN =
  'flex min-h-[44px] w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white dark:bg-raised px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 disabled:cursor-not-allowed disabled:opacity-60';

/** Domain → Google? answers this page has already had (the server caches too). */
const answered = new Map<string, boolean>();

export function GoogleAddressDoor({
  enabled,
  desktopOAuth = false,
  nativeOAuth = false,
  next,
  accountType,
  withTerms = false,
  termsBoxId,
}: {
  /** The shell gate's `show` — false wherever the Google button is not on screen. */
  enabled: boolean;
  /** The shell gate's `desktop` / `native` — which Google flow this shell's button runs. */
  desktopOAuth?: boolean;
  nativeOAuth?: boolean;
  next: string;
  /** Only where the shell's Google button carries it (sign-up doors). */
  accountType?: 'customer' | 'vendor';
  /** A sign-up door: say the Terms + Privacy agreement under the button, since the password part (with its Terms
   *  box) folds away while this door is showing (sweep C9). */
  withTerms?: boolean;
  /** A sign-up card with ONE Terms box above every door (/signup, owner 2026-10-22): this door waits for that box
   *  — unticked, it nudges the box and goes nowhere; ticked, the tick is carried to the callback first (`termsFirst`). */
  termsBoxId?: string;
}) {
  const active = enabled && GOOGLE_ENABLED;
  const shell = googleDoorShell(desktopOAuth, nativeOAuth);
  const anchor = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState('');
  const [google, setGoogle] = useState(false);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [, startTransition] = useTransition();

  const domain = emailDomain(address);
  const on = active && google && domain !== null && domain !== passwordFor;

  // Follow the form's email box (typed, pasted, autofilled, pre-filled).
  useEffect(() => {
    if (!active) return;
    const input = anchor.current?.closest('form')?.querySelector<HTMLInputElement>('input[name="email"]');
    if (!input) return;
    const read = () => setAddress(input.value);
    read();
    input.addEventListener('input', read);
    input.addEventListener('change', read);
    // A value set by script (the card restores the address after a redirect)
    // fires no event; one late read catches it.
    const late = window.setTimeout(read, 300);
    return () => {
      input.removeEventListener('input', read);
      input.removeEventListener('change', read);
      window.clearTimeout(late);
    };
  }, [active]);

  // Is this domain Google? By name at once; a Workspace domain after a pause.
  useEffect(() => {
    if (!active || !domain) {
      setGoogle(false);
      return;
    }
    if (isGoogleNamedDomain(domain)) {
      setGoogle(true);
      return;
    }
    const known = answered.get(domain);
    if (known !== undefined) {
      setGoogle(known);
      return;
    }
    setGoogle(false);
    let live = true;
    const t = window.setTimeout(() => {
      fetch(googleDomainCheckUrl(domain), { headers: { accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { google?: unknown } | null) => {
          const yes = body?.google === true;
          if (body) answered.set(domain, yes);
          if (live) setGoogle(yes);
        })
        .catch(() => {
          /* the ordinary form stays — today's behaviour */
        });
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [active, domain]);

  const go = useCallback(async () => {
    if (leaving) return;
    if (termsBoxId && !(await termsFirst(termsBoxId))) return;
    const hint = googleLoginHint(address);
    setLeaving(true);
    if (shell === 'desktop') {
      signInWithProviderDesktop('google', next, hint, { agreed: Boolean(termsBoxId) }).catch(() => setLeaving(false));
      return;
    }
    if (shell === 'native') {
      import('@/lib/native-oauth')
        .then(({ signInWithProviderNative }) =>
          signInWithProviderNative('google', next, accountType ?? 'customer', hint),
        )
        .then((left) => {
          if (!left) setLeaving(false);
        })
        .catch(() => setLeaving(false));
      return;
    }
    const fd = new FormData();
    fd.set('next', next);
    if (accountType) fd.set('account_type', accountType);
    if (hint) fd.set('login_hint', hint);
    startTransition(async () => {
      await signInWithGoogle(fd);
    });
  }, [address, accountType, leaving, next, shell, termsBoxId]);

  // Fold the password part of the form away (and back), and route the form's
  // own submit — Enter in the email box — to the same Google door.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const form = anchor.current?.closest('form');
    if (!form) return;
    if (on) form.setAttribute('data-google-address', 'on');
    else form.removeAttribute('data-google-address');
    const parts = Array.from(form.querySelectorAll<HTMLElement>('[data-password-only]'));
    const inputs = parts.flatMap((p) =>
      p.matches('input') ? [p as HTMLInputElement] : Array.from(p.querySelectorAll<HTMLInputElement>('input')),
    );
    for (const p of parts) p.style.display = on ? 'none' : '';
    // Disabled controls are skipped by the browser's `required` check and are
    // not posted — a hidden password box can never block (or ride along with)
    // the Google door.
    for (const i of inputs) i.disabled = on;
    if (!on) return;
    const onSubmit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      void goRef.current();
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [on]);

  return (
    <div ref={anchor} style={on ? undefined : { display: 'none' }} data-google-address-door="">
      <button
        type="button"
        className={BTN}
        disabled={leaving}
        onClick={() => void go()}
        data-terms-first={termsBoxId ? '' : undefined}
      >
        {leaving ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : <GoogleGIcon />}
        {leaving
          ? shell === 'web'
            ? GOOGLE_ADDRESS_WORDS.pendingWeb
            : GOOGLE_ADDRESS_WORDS.pendingBrowser
          : `${OAUTH_VERB} Google`}
      </button>
      {withTerms ? <OAuthTermsLine /> : null}
      <button
        type="button"
        className="hr-si-link"
        style={{ marginTop: 10, background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}
        onClick={() => setPasswordFor(domain)}
      >
        {GOOGLE_ADDRESS_WORDS.usePassword}
      </button>
    </div>
  );
}
