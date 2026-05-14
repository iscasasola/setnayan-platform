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

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

import { createClient } from '@/lib/supabase/client';

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

export function PostHogProvider({ children, userId }: PostHogProviderProps) {
  // Init once on mount. The library guards against double-init internally,
  // but the explicit `posthog.__loaded` check keeps the React 19 strict
  // double-invoke clean too.
  useEffect(() => {
    if (!isPostHogConfigured()) return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    const loaded = (posthog as unknown as { __loaded?: boolean }).__loaded;
    if (loaded) return;
    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
    });
  }, []);

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
  }, [userId]);

  // Identify/reset whenever the resolved user_id changes.
  useEffect(() => {
    if (!isPostHogConfigured()) return;
    if (resolvedUserId === undefined) return; // still loading
    const loaded = (posthog as unknown as { __loaded?: boolean }).__loaded;
    if (!loaded) return;
    if (resolvedUserId) {
      posthog.identify(resolvedUserId);
    } else {
      posthog.reset();
    }
  }, [resolvedUserId]);

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

  useEffect(() => {
    if (!isPostHogConfigured()) return;
    if (!pathname) return;
    const loaded = (posthog as unknown as { __loaded?: boolean }).__loaded;
    if (!loaded) return;
    const search = searchParams?.toString();
    const url =
      typeof window !== 'undefined'
        ? window.location.origin + pathname + (search ? `?${search}` : '')
        : pathname + (search ? `?${search}` : '');
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
