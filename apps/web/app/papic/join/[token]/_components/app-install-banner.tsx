'use client';

import { useEffect, useState } from 'react';
import type { CloseRecord } from '@/lib/notices';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
import { deviceOs } from '@/lib/apple-device';

// Papic · hybrid join — PAGE-LOCAL smart app-install banner.
//
// A lightweight nudge to install the Setnayan native app, shown ONLY on the
// hybrid join interstitial. It is deliberately page-local: the global
// SiteChrome / NAV_ROUTES is owned by another wave and must not be touched
// here, so this banner lives and dies with this route.
//
// ⚠ WHAT THE APP DOES *NOT* DO — read before writing copy here.
// The native shell is a REMOTE-URL Capacitor WebView (apps/mobile/capacitor.config.ts:
// "this shell does NOT bundle the app"; server.url -> https://www.setnayan.com). It
// loads the same hosted app and runs the SAME getUserMedia path via
// lib/use-papic-camera.ts. `@capacitor/camera` is a declared dependency with ZERO
// importers anywhere in apps/web.
//
// So installing it does NOT give a faster camera, a better camera, or instant
// uploads — background upload is one of the named-but-unbuilt native gaps
// (Container_App_Strategy_Council_Verdict_2026-07-13.md). This copy previously
// promised "A faster camera and instant uploads", which was false, and sat eight
// lines above the page's own "no app to install" line. Corrected 2026-07-21 per
// Papic_Low_Light_Council_Verdict_2026-07-21.md § 8 A1.
//
// The honest claim today is convenience — a home-screen icon and no browser
// chrome. Do not re-add a capture-quality claim unless a real native capture
// plugin ships AND the frames actually differ.
//
// WHY IT'S MOSTLY DORMANT TODAY — the apps are built but not yet published
// (App Store / Play enrollment is owner-gated). So the store links are
// env-configured: until NEXT_PUBLIC_IOS_APP_STORE_URL / _ANDROID_PLAY_STORE_URL
// are set, the banner shows a single "available soon" line with no dead badges,
// rather than linking to a 404 store page. The moment the owner publishes and
// sets those env vars, the matching badge lights up automatically — no code
// change. We also hide the banner entirely inside the native shell (a friend
// already in the app never needs an install nudge).
//
// 🔔 Inventory #41 — an ask in the one notice system (owner approved 14 Nov 2026): a LINE on Papic join, never a bar,
// "Not now" kept by the one notice memory (the old per-session key is only read, as its legacy).

const DISMISS_KEY = 'papic-join-install-dismissed';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  // iPadOS 13+ reports as Mac; `deviceOs` (lib/apple-device.ts) reads the touch points.
  const os = deviceOs(navigator.userAgent || '', navigator.maxTouchPoints);
  if (os === 'iphone' || os === 'ipad') return 'ios';
  if (os === 'android') return 'android';
  return 'other';
}

function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function AppInstallBanner({
  iosUrl,
  androidUrl,
}: {
  iosUrl?: string;
  androidUrl?: string;
}) {
  // Render nothing on the server / first paint: platform + native-shell are client-only, and we don't want a flash.
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');

  useEffect(() => {
    if (isNativeShell()) return; // already in the app — no nudge
    setPlatform(detectPlatform());
    setShow(true);
  }, []);

  if (!show) return null;

  const storeUrl = platform === 'ios' ? iosUrl : platform === 'android' ? androidUrl : undefined;

  return (
    <InlineNotice
      kind="todo"
      ask
      noticeKey="app-install:papic-join"
      title="Shoot from the Setnayan app"
      detail={
        storeUrl ? (
          'Keeps Setnayan one tap away. The camera works exactly the same either way.'
        ) : (
          <span data-coming-soon="">The app is coming soon — for now, keep going right here in your browser. Nothing to install.</span>
        )
      }
      actions={
        storeUrl ? (
          <a href={storeUrl} className={NOTICE_ACTION}>
            {platform === 'ios' ? 'Get it on the App Store' : 'Get it on Google Play'}
          </a>
        ) : null
      }
      legacy={(): CloseRecord | null => {
        try {
          return sessionStorage.getItem(DISMISS_KEY) === '1' ? { closedAt: Date.now(), count: 1 } : null;
        } catch {
          return null;
        }
      }}
      className="mb-5 text-left"
    />
  );
}
