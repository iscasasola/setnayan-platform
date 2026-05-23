import {
  signInWithFacebook,
  signInWithGoogle,
} from '@/app/auth/oauth-actions';

/**
 * OAuth provider button row — Google + Facebook (Apple deferred V1.1
 * per owner directive 2026-05-23).
 *
 * Mounted at the TOP of /login and /signup, above the "or continue with
 * email" divider. Industry-standard placement (Stripe, Linear, GitHub,
 * Notion all put OAuth-first when both are offered) — for Filipino
 * couples who default to Facebook for everything, "Continue with
 * Facebook" being the first thing they see massively shortens the
 * mental path to dashboard.
 *
 * Server component — no client JS needed. Each button is a separate
 * `<form action={serverAction}>` with a hidden `next` input so the
 * post-auth redirect destination round-trips through the OAuth flow.
 * Same pattern as the existing signInWithPassword + signInWithMagicLink
 * forms on /login/page.tsx so the surrounding code already understands
 * the contract.
 *
 * Brand icons are nominative-use inline SVGs (Google G in standard
 * 4-color quadrant geometry, Facebook f as white on FB-blue circle).
 * Same approach as PR #405 directions-buttons.tsx (Google Maps + Waze
 * + Apple Maps) — recognized brand marks for deep-link affordances,
 * NOT verbatim trademarked app icon reproductions.
 */

type Props = {
  /** Post-auth redirect destination, validated by safeNext() upstream. */
  next: string;
};

export function OAuthButtonRow({ next }: Props) {
  return (
    <div className="space-y-2.5">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
        >
          <GoogleGIcon />
          Continue with Google
        </button>
      </form>
      <form action={signInWithFacebook}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#155bd1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        >
          <FacebookFIcon />
          Continue with Facebook
        </button>
      </form>
    </div>
  );
}

/**
 * Google G brand mark — standardized 4-color quadrant geometry used
 * universally on "Sign in with Google" buttons per Google's brand
 * guidelines (developers.google.com/identity/branding-guidelines).
 * Colors locked to Google's brand palette: red #EA4335, blue #4285F4,
 * yellow #FBBC05, green #34A853. Drawn at 24x24 viewBox so it renders
 * crisp at 18px display size next to the button label.
 */
function GoogleGIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      aria-hidden
      role="img"
      focusable={false}
    >
      <path
        fill="#EA4335"
        d="M12 5c1.6168 0 3.1013.5557 4.2607 1.6427l3.1734-3.1747C17.5066 1.5947 14.9419.5 12 .5 7.7027.5 3.9893 2.9787 2.1933 6.6053l3.6913 2.8693C6.7613 6.6213 9.1453 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.273c0-.8453-.075-1.6587-.215-2.4407H12v4.6147h6.4607c-.2787 1.502-1.124 2.7733-2.394 3.624l3.8773 3.0067C22.207 19.057 23.5 15.9197 23.5 12.273z"
      />
      <path
        fill="#FBBC05"
        d="M5.884 14.474c-.2007-.6-.314-1.2387-.314-1.974s.1133-1.374.314-1.974L2.1927 7.6307C1.4173 9.1707 1 10.4733 1 12.5c0 2.0267.4173 3.3293 1.1927 4.8693l3.6913-2.8953z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c2.9407 0 5.4067-.9707 7.207-2.6293l-3.8767-3.0067c-1.072.72-2.4513 1.1453-3.3303 1.1453-2.855 0-5.2387-1.6207-6.116-3.8067L2.1933 18.064C3.99 21.6913 7.7033 23.5 12 23.5z"
      />
    </svg>
  );
}

/**
 * Facebook f brand mark — white "f" on Facebook brand-blue circular
 * background (#1877F2 per Meta's brand portal). Standard mark used on
 * "Continue with Facebook" buttons across the web; immediately
 * recognizable on a sign-in page. Drawn at 24x24 viewBox so it scales
 * cleanly. NOT a verbatim copy of the trademarked Facebook app icon
 * — this is the nominative-use brand mark for deep-link affordances.
 */
function FacebookFIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      aria-hidden
      role="img"
      focusable={false}
    >
      <circle cx="12" cy="12" r="12" fill="#fff" fillOpacity="0.95" />
      <path
        fill="#1877F2"
        d="M16 8.5h-2.13c-.36 0-.6.32-.6.65V10.5H16l-.25 2.4h-2.48v6.6H10.5v-6.6H8.5v-2.4h2v-1.5c0-1.66.94-3 2.78-3H16v2.5z"
      />
    </svg>
  );
}
