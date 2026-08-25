'use client';

// PostHog client-side provider.
//
// Two responsibilities:
//   1. Initialize the PostHog browser SDK once on mount, gated on
//      NEXT_PUBLIC_POSTHOG_KEY so local/dev builds without the env var
//      stay silent.
//   2. Capture `$pageview` manually on every App Router path change.
//      The built-in `capture_pageview: true` doesn't see soft
//      navigations in App Router because there's no full page load —
//      we use `usePathname()` + `useSearchParams()` instead.
//
// `person_profiles: 'identified_only'` keeps the cheaper plan honest:
// anonymous traffic is bucketed, but only authed users burn a
// monthly-tracked-user slot. The owner can flip this to `'always'`
// once the team needs anon segmentation.
//
// Bundle note: `posthog-js` is ~60 kB gzipped on its own. We dynamic-
// import it lazily on first useEffect run so it lands in its own
// async chunk and only ships after the page is interactive — the
// PostHog provider itself stays tiny in the shared layout chunk and
// the SDK is fetched in parallel with (not blocking) main-thread work.

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { analyticsAllowed, CONSENT_CHANGE_EVENT } from '@/lib/cookie-consent';
import {
  sanitizeAnalyticsProperties,
  stripSensitiveParams,
} from '@/lib/analytics-sanitize';

// Type-only import — erased at compile time, so no runtime cost.
import type posthogType from 'posthog-js';
type PostHog = typeof posthogType;

type PostHogProviderProps = {
  children: React.ReactNode;
  /**
   * Supabase user_id of the current viewer, if signed in. Optional —
   * when omitted, the provider falls back to the Supabase browser
   * client and subscribes to auth state changes itself so we don't
   * have to plumb the user_id down through every layout/page.
   */
  userId?: string | null;
};

function isPostHogConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

// Module-level holder for the lazy-loaded SDK. Shared across all
// provider instances so we only fetch the chunk once per page load.
let posthogModule: PostHog | null = null;
let posthogPromise: Promise<PostHog | null> | null = null;

function loadPostHog(): Promise<PostHog | null> {
  if (posthogModule) return Promise.resolve(posthogModule);
  if (!isPostHogConfigured()) return Promise.resolve(null);
  if (posthogPromise) return posthogPromise;
  posthogPromise = import('posthog-js')
    .then((mod) => {
      // The default export is the singleton.
      posthogModule = (mod.default ?? mod) as PostHog;
      return posthogModule;
    })
    .catch(() => null);
  return posthogPromise;
}

function isLoaded(client: PostHog | null): boolean {
  if (!client) return false;
  return Boolean((client as unknown as { __loaded?: boolean }).__loaded);
}

export function PostHogProvider({ children, userId }: PostHogProviderProps) {
  // Cookie-consent gate (RA 10173). Analytics is opt-in: PostHog is only
  // initialized once the visitor has accepted analytics cookies. We re-check
  // whenever the consent banner saves a new choice, so accepting activates
  // analytics live (and the SDK is never loaded for visitors who decline).
  const [consentReady, setConsentReady] = useState(false);
  /* Shared between the identify effect and the withdrawal effect: clearing it on
     opt-out means a later re-grant re-identifies instead of short-circuiting. */
  const lastIdentifiedRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const sync = () => setConsentReady(analyticsAllowed());
    sync();
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
  }, []);

  /**
   * 🔴 WITHDRAWAL, NOT JUST GRANT. Until 2026-08-25 this effect only ever
   * INITIALIZED PostHog, and every other capture site asked `isLoaded(client)`
   * and nothing else. So consent was honoured on the way IN and ignored on the
   * way OUT: a person who accepted analytics, then opened Cookie settings and
   * switched them off, kept an initialized SDK capturing `$pageview` on every
   * navigation, plus autocapture and `capture_pageleave`, for the rest of that
   * session. The control saved their answer and nothing acted on it — the
   * opposite face of this project's "gate with no handle".
   *
   * `opt_out_capturing()` is the SDK's own kill switch: it stops every capture
   * path at once, including the ones this file never calls directly. `reset()`
   * then drops the distinct_id and any identification, so what remains is not
   * tied to them. Re-granting opts back in, live, with no reload.
   */
  useEffect(() => {
    if (!isPostHogConfigured()) return;
    if (consentReady) return;
    let cancelled = false;
    void loadPostHog().then((client) => {
      if (cancelled || !client) return;
      if (!isLoaded(client)) return; // never initialized ⇒ nothing to stop
      client.opt_out_capturing();
      client.reset();
      lastIdentifiedRef.current = undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [consentReady]);

  // Init once consent is granted. The library guards against double-init
  // internally, but the explicit `__loaded` check keeps the React 19 strict
  // double-invoke clean too.
  useEffect(() => {
    if (!isPostHogConfigured()) return;
    if (!consentReady) return;
    let cancelled = false;
    void loadPostHog().then((client) => {
      if (cancelled || !client) return;
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (!key) return;
      if (isLoaded(client)) {
        // Already initialized and previously opted out — this is a re-grant.
        client.opt_in_capturing();
        return;
      }
      client.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
        // Strip guest bearer tokens from every event's URL properties.
        sanitize_properties: (properties) =>
          sanitizeAnalyticsProperties(properties as Record<string, unknown>),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [consentReady]);

  // Resolve the Supabase user_id ourselves when the caller didn't pass it.
  // This keeps `providers.tsx` clean of server-only plumbing — the rest
  // of the tree never has to know about PostHog identification.
  const [resolvedUserId, setResolvedUserId] = useState<string | null | undefined>(
    userId,
  );

  useEffect(() => {
    if (userId !== undefined) {
      setResolvedUserId(userId);
      return;
    }
    // Don't touch Supabase auth until analytics consent is granted. PostHog is
    // only initialized (and only ever identifies a user) once `consentReady`,
    // so resolving the user_id on every anonymous, pre-consent visit — which
    // spins up a Supabase browser client, an `auth.getUser()` call, and an
    // `onAuthStateChange` subscription — was pure wasted work on the homepage
    // first-paint path for visitors who never load analytics at all. Gating on
    // consentReady means the (already logged-in) user is resolved the moment
    // they accept analytics, and skipped entirely otherwise.
    // (Perf sweep 2026-07-02, finding #19.)
    if (!consentReady) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setResolvedUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setResolvedUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [userId, consentReady]);

  // Identify/reset whenever the resolved user_id changes. Wait for the
  // SDK chunk to land before issuing the call — if it hasn't yet, the
  // init useEffect above will eventually fire and we'll re-run when
  // resolvedUserId next changes.
  useEffect(() => {
    if (!isPostHogConfigured()) return;
    if (resolvedUserId === undefined) return; // still loading
    /* ⛔ AND NOT WHILE THEY HAVE SAID NO. Without this, somebody who declined
       analytics and then signed in would have had their user id attached to the
       very session they refused — `identify()` fired on the id change alone. */
    if (!consentReady) return;
    if (lastIdentifiedRef.current === resolvedUserId) return;
    let cancelled = false;
    void loadPostHog().then((client) => {
      if (cancelled || !client) return;
      if (!isLoaded(client)) return;
      lastIdentifiedRef.current = resolvedUserId;
      if (resolvedUserId) {
        client.identify(resolvedUserId);
      } else {
        client.reset();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedUserId, consentReady]);

  return (
    <>
      {/*
        useSearchParams() requires a Suspense boundary at build-time per
        Next.js App Router docs — without it the whole tree falls back to
        client-side rendering. Isolating the tracker keeps the rest of
        the app SSR-friendly.
      */}
      <Suspense fallback={null}>
        <PostHogPageTracker />
      </Suspense>
      {children}
    </>
  );
}

/**
 * Fires `$pageview` on every App Router path or search-param change.
 * Mounted inside a Suspense boundary by `PostHogProvider`.
 */
function PostHogPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /* Re-evaluate the gate when the visitor changes their mind mid-session, so a
     RE-GRANT starts capturing the page they are already on rather than waiting
     for the next navigation. */
  const [consentTick, setConsentTick] = useState(0);
  useEffect(() => {
    const bump = () => setConsentTick((n) => n + 1);
    window.addEventListener(CONSENT_CHANGE_EVENT, bump);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!isPostHogConfigured()) return;
    if (!pathname) return;
    let cancelled = false;
    /* 🔴 ASK THE CHOICE, NOT THE SDK. `isLoaded` answers "did we ever start
       analytics", which stays true forever once consent was granted — so this
       captured a pageview on every navigation after somebody switched analytics
       off. `opt_out_capturing()` would drop it anyway; refusing to build the
       event at all means the URL is never assembled either. */
    if (!analyticsAllowed()) return;
    void loadPostHog().then((client) => {
      if (cancelled || !client) return;
      if (!isLoaded(client)) return;
      const search = searchParams?.toString();
      const rawUrl =
        typeof window !== 'undefined'
          ? window.location.origin + pathname + (search ? `?${search}` : '')
          : pathname + (search ? `?${search}` : '');
      // Scrub at the source too — sanitize_properties covers it as well, but
      // this keeps a guest token from ever being built into the captured url.
      client.capture('$pageview', { $current_url: stripSensitiveParams(rawUrl) });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams, consentTick]);

  return null;
}
