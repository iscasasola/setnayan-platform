"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "facebook";

export function OAuthButtons() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handle(provider: Provider) {
    setLoading(provider);
    setError(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(null);
    }
    // On success the browser is redirected to the provider — no further action here.
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => handle("google")}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-rule-strong bg-surface px-4 py-3 font-sans text-base font-medium text-ink shadow-tayo-sm transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Continue with Google"
      >
        <GoogleLogo />
        <span>{loading === "google" ? "Redirecting…" : "Continue with Google"}</span>
      </button>

      <button
        type="button"
        onClick={() => handle("facebook")}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-3 rounded-full bg-[#1877F2] px-4 py-3 font-sans text-base font-medium text-white shadow-tayo-sm transition hover:bg-[#166FE5] disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Continue with Facebook"
      >
        <FacebookLogo />
        <span>{loading === "facebook" ? "Redirecting…" : "Continue with Facebook"}</span>
      </button>

      {error && (
        <p
          className="rounded-md bg-rsvp-declined-soft px-4 py-3 font-sans text-sm text-rsvp-declined-ink"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
    </svg>
  );
}
