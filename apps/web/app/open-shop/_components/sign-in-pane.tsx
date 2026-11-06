'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SidePanel } from '@/app/_components/side-panel';
import { SignInCard } from '@/app/login/_components/sign-in-card';

/**
 * "Have an account? Sign in — what you typed stays." on the sign-up door (owner 2026-11-06, the redesign: "on
 * tablet and desktop a pop-up is a THIRD PANE on the right, never floating; on the phone it is the bottom sheet").
 *
 * RULE 0 — the shell is the shipped `SidePanel` in the exact shape `CreateEventPanel` uses (`size="wide"`,
 * `phone="sheet"`), and the card inside is the shipped `SignInCard` in its in-place mode. The seam is the one
 * `SignInHerePanel` keeps: on success `router.refresh()` re-renders the SERVER page with the session while this
 * client tree stays mounted — so the wizard keeps every field, and step 4 simply loses its account half.
 *
 * ⚠ THE CONTROL IS A REAL LINK (`href` = the no-JavaScript fallback, as `SignInHereLink`'s doc explains); the press
 * is intercepted only for a plain primary click.
 */
export function OpenShopSignIn({
  href,
  oauth,
  className,
  children,
}: {
  href: string;
  oauth: { show: boolean; desktop: boolean; native: boolean };
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState('/open-shop');
  useEffect(() => {
    setHere(`${window.location.pathname}${window.location.search}`);
  }, [open]);
  const close = useCallback(() => setOpen(false), []);
  const signedIn = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <>
      <a
        href={href}
        className={className}
        aria-haspopup="dialog"
        data-open-shop-sign-in=""
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </a>
      <SidePanel
        open={open}
        onClose={close}
        title="Sign in"
        info="Pick up where you left off — what you typed stays."
        size="wide"
        phone="sheet"
      >
        {open ? (
          <SignInCard
            next={here}
            signupHref={`/signup?next=${encodeURIComponent(here)}`}
            showOAuth={oauth.show}
            desktopOAuth={oauth.desktop}
            nativeOAuth={oauth.native}
            onNavigate={close}
            onSignedIn={signedIn}
          />
        ) : null}
      </SidePanel>
    </>
  );
}
