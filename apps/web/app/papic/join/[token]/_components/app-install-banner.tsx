'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

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
// already in the app never needs an install nudge) and remember a dismissal for
// the session so it doesn't nag on a re-open.

const DISMISS_KEY = 'papic-join-install-dismissed';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as Mac; the touch-points check disambiguates a real iPad.
  const isIpadOs =
    /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIpadOs) return 'ios';
  if (/Android/.test(ua)) return 'android';
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
  // Render nothing on the server / first paint: platform + native-shell + the
  // dismissed flag are all client-only, and we don't want a flash.
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');

  useEffect(() => {
    if (isNativeShell()) return; // already in the app — no nudge
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // sessionStorage can throw in privacy modes — fall through and show.
    }
    setPlatform(detectPlatform());
    setShow(true);
  }, []);

  if (!show) return null;

  const storeUrl = platform === 'ios' ? iosUrl : platform === 'android' ? androidUrl : undefined;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore — worst case the banner shows again next open
    }
    setShow(false);
  }

  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-3.5 text-left">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mulberry/10 text-mulberry">
        <Smartphone aria-hidden className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Shoot from the Setnayan app</p>
        {storeUrl ? (
          <>
            <p className="mt-0.5 text-xs text-ink/60">
              Keeps Setnayan one tap away. The camera works exactly the same either way.
            </p>
            <a
              href={storeUrl}
              className="mt-2 inline-flex items-center justify-center rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-mulberry-600"
            >
              {platform === 'ios' ? 'Get it on the App Store' : 'Get it on Google Play'}
            </a>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-ink/60">
            The app is coming soon — for now, keep going right here in your browser. Nothing to install.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss app suggestion"
        className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink/40 transition hover:bg-ink/5 hover:text-ink/70"
      >
        <X aria-hidden className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
