'use client';

// Root client-side providers for the web app.
//
// The TanStack Query cache's IndexedDB copy (key `setnayan-query-cache`,
// 7-day max age, `NEXT_PUBLIC_CACHE_BUSTER` buster — spec § 3.1 / § 9.4)
// lives in lib/query-persistence.ts and starts after the page has settled
// (<QueryPersistence />). Nothing reads the cache through React, so no
// provider wraps the page (speed pass 2026-11-18).

import { Suspense } from 'react';

import { QueryPersistence } from './_components/query-persistence';
import { LoaderOverlayProvider } from '@/components/sd-loader';
import { BrandProvider } from './_components/brand-provider';
import { LoaderConfigProvider } from './_components/loader-config-provider';
import { DEFAULT_LOADER_CONFIG, type LoaderConfig } from '@/lib/loader-config';
import { DeferredObservability } from './_components/deferred-observability';
import { DeviceCapture } from './_components/device-capture';
import { GlobalHaptics } from './_components/global-haptics';
import dynamic from 'next/dynamic';
import { GlobalSliderHint } from './_components/global-slider-hint';
import { ThemeProvider, type ThemeMode } from './_components/theme-provider';
import { ToastProvider } from './_components/toast/toast-provider';
import { ToastFromParams } from './_components/toast/toast-from-params';
import { DesktopUpdaterListener } from './_components/desktop-updater-listener';

/* ✕ The app-wide clear button loads after the page, never in anybody's first load (the Maker's first-load budget): it draws
   nothing until a box is focused with words in it. */
const GlobalClearField = dynamic(() => import('./_components/global-clear-field').then((m) => m.GlobalClearField), { ssr: false });

export function Providers({
  children,
  initialThemeMode = 'light',
  brandMarkUrl = null,
  loaderConfig = DEFAULT_LOADER_CONFIG,
}: {
  children: React.ReactNode;
  /**
   * Retained for call-site compatibility; nothing passes it. The person's
   * Appearance (Light · Dark, 2026-10-13) is read from the `sn-theme` cookie by
   * the <head> script and the ThemeProvider — see lib/appearance.ts. Wraps
   * everything so client components can call `useTheme()`.
   */
  initialThemeMode?: ThemeMode;
  /**
   * SSR-resolved admin brand mark URL (already version-busted), or null for the
   * built-in gold default. Supplies <Logo>/<LogoMark> via BrandProvider with
   * zero call-site churn. Owner 2026-06-10.
   */
  brandMarkUrl?: string | null;
  /**
   * SSR-resolved admin loader appearance (variant / veil / cadence / pop), or
   * the shipped default. Threaded to every <SDLoader> via LoaderConfigProvider
   * with zero call-site churn. Owner 2026-07-05.
   */
  loaderConfig?: LoaderConfig;
}) {
  return (
    <ThemeProvider initialMode={initialThemeMode}>
      {/* ⚡ The query cache's IndexedDB copy starts after the page has settled (lib/query-persistence.ts). Nothing reads
          the cache through React, so there is no provider to wrap the page in. */}
      <QueryPersistence />
      <>
          {/*
            App-wide blocking loader overlay (Organic loaders handoff
            2026-06-07). Provides useLoader() to any client component for
            screen-covering "thinking" moments (sign-in, heavy submits) with a
            "Ready ✓" completion. Route-level loading still uses skeletons.
          */}
          {/*
            LoaderConfigProvider sits ABOVE LoaderOverlayProvider so the
            overlay's <SDLoader> (and every other consumer) reads the admin's
            chosen variant / cadence / pop through useLoaderConfig(). Owner
            2026-07-05.
          */}
          <LoaderConfigProvider config={loaderConfig}>
            <LoaderOverlayProvider>
              <BrandProvider markUrl={brandMarkUrl}>
                <ToastProvider>
                  {children}
                  <Suspense fallback={null}>
                    <ToastFromParams />
                  </Suspense>
                  {/* S12 (build-sessions/encoder/S12.md): renders the Rust
                      updater's deferred-install notice as a plain info toast.
                      No search params, so no Suspense boundary needed. */}
                  <DesktopUpdaterListener />
                </ToastProvider>
              </BrandProvider>
            </LoaderOverlayProvider>
          </LoaderConfigProvider>
        {/*
          Sentry browser SDK is lazy-loaded post-hydration via a deferred
          client component so the ~105 kB `@sentry/nextjs` chunk stays
          out of the shared First Load JS bundle. Server-side Sentry
          (instrumentation.ts + sentry.{server,edge}.config.ts) is
          untouched and continues to capture server errors eagerly.
        */}
        <DeferredObservability />
        {/*
          Device-fingerprint capture (fake-inquiry protection · Phase E). Deferred,
          once-per-session, flag-gated OFF by default — records a coarse first-party
          device id into user_devices to power fraud identity-clustering. No-ops
          entirely until NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED is on.
        */}
        <DeviceCapture />
        {/*
          App-wide tap haptics — one passive pointerdown listener fires a
          light `tick` on any interactive control. Owner directive 2026-06-03.
          Renders nothing; no-ops on engines without haptic support.
        */}
        <GlobalHaptics />
        {/* ✕ in every type box while it is typed into (owner 2026-10-31) — `components/clear-field.tsx`. */}
        <GlobalClearField />
        {/*
          App-wide "drag me" hint — one client effect adds a periodic left-right
          knob shake to opted-in line sliders (`.sn-range` / `[data-sn-hint]`)
          and removes it the moment a slider is touched. Owner directive
          2026-07-03. Renders nothing; silent under prefers-reduced-motion.
        */}
        <GlobalSliderHint />
      </>
    </ThemeProvider>
  );
}
