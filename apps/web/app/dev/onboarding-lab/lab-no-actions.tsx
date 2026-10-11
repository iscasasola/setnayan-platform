'use client';

/**
 * lab-no-actions.tsx — A PRESS ON /dev/onboarding-lab NEVER REACHES THE SERVER.
 *
 * The lab draws the REAL `OnboardingShell`, whose last button calls the real
 * commit (`commitOnboardingWedding`) — on a machine signed in to the app that
 * would create a real event. A server action leaves the browser as a POST that
 * carries a `Next-Action` header; while the lab is on screen, this refuses every
 * such request before it is sent. Nothing else is touched (page loads, images
 * and the dev server's own requests pass), and leaving the lab puts the
 * browser's own `fetch` back.
 *
 * It also lets a card be opened without loading the page again (a dev page
 * load of this flow takes many seconds): `window.__onboardingLab.open(draft)`
 * writes the shell's own draft and mounts the shell afresh, which then resumes
 * from it exactly as a returning person's would.
 */
import { Fragment, useLayoutEffect, useState, type ReactNode } from 'react';
import { ONBOARDING_DRAFT_KEY } from '@/app/onboarding/wedding/types';

declare global {
  interface Window {
    __onboardingLab?: { open: (draft?: Record<string, unknown>) => void };
  }
}

export function carriesAnAction(input: RequestInfo | URL, init?: RequestInit): boolean {
  const has = (h: HeadersInit | undefined) => {
    if (!h) return false;
    if (h instanceof Headers) return h.has('next-action');
    if (Array.isArray(h)) return h.some(([k]) => k.toLowerCase() === 'next-action');
    return Object.keys(h).some((k) => k.toLowerCase() === 'next-action');
  };
  return has(init?.headers) || (input instanceof Request && input.headers.has('next-action'));
}

export function LabNoActions({ children }: { children: ReactNode }) {
  const [mount, setMount] = useState(0);
  useLayoutEffect(() => {
    const real = window.fetch;
    window.fetch = (input, init) =>
      carriesAnAction(input, init)
        ? Promise.reject(new Error('The onboarding lab sends nothing to the server.'))
        : real(input, init);
    window.__onboardingLab = {
      open: (draft) => {
        try {
          if (draft) localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ ...draft, lastSavedAt: new Date().toISOString() }));
          else localStorage.removeItem(ONBOARDING_DRAFT_KEY);
        } catch {
          /* storage blocked — the shell simply opens on its first card */
        }
        setMount((n) => n + 1);
      },
    };
    return () => {
      window.fetch = real;
      delete window.__onboardingLab;
    };
  }, []);
  return (
    <div data-onboarding-lab>
      <Fragment key={mount}>{children}</Fragment>
    </div>
  );
}
