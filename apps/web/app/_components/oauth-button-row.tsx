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
 * 4-color quadrant geometry, Facebook f as a blue disc with white f
 * inside — the standard outward-facing Facebook brand mark). Same
 * approach as PR #405 directions-buttons.tsx (Google Maps + Waze +
 * Apple Maps) — recognized brand marks for deep-link affordances,
 * NOT verbatim trademarked app icon reproductions.
 *
 * 2026-05-30 Clean Editorial unification (CLAUDE.md decision-log).
 * BOTH buttons now use the same neutral chrome pattern: alabaster bg
 * + obsidian text + obsidian/20 border + champagne gold focus ring.
 * The Facebook button flipped from solid blue (#1877F2 chrome + white
 * text) → neutral chrome with the standard Facebook mark (blue circle
 * + white "f") sitting on the alabaster surface. Both styles are
 * sanctioned by Meta's Login button design portal — the neutral
 * version is what apps use when site palette doesn't accommodate the
 * solid blue. Resolves the Champagne Gold + Rich Mulberry CTA palette
 * clash + makes the two OAuth buttons visually symmetric.
 */

type Props = {
  /** Post-auth redirect destination, validated by safeNext() upstream. */
  next: string;
};

// Env-flag gates · owner directive 2026-05-23. Without these flags,
// clicking the Continue with Google / Facebook buttons hits Supabase's
// /auth/v1/authorize endpoint with a provider whose credentials aren't
// pasted into Supabase Studio yet → 404. Hide the buttons entirely
// until owner completes Phase 2D of OWNER_ACTIONS.md (paste OAuth
// credentials into Supabase Studio) AND flips the matching env flag in
// Vercel. Default both flags to "false" so a freshly-cloned dev env
// also doesn't 404 on click.
//
// Why NEXT_PUBLIC_*: these are read at module scope during render of
// the login + signup pages, which are statically generated or server-
// rendered with no per-request auth context. Next.js inlines
// NEXT_PUBLIC_* at build time so the flags work cleanly on both the
// edge and the server runtime.
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true';
const FACEBOOK_ENABLED = process.env.NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED === 'true';

/**
 * Whether at least one OAuth provider is enabled. /login + /signup
 * check this so they can drop the "or continue with email" divider
 * when there's no OAuth row above it to separate.
 */
export const ANY_OAUTH_ENABLED = GOOGLE_ENABLED || FACEBOOK_ENABLED;

export function OAuthButtonRow({ next }: Props) {
  // Both providers off → render nothing. /login + /signup also use
  // ANY_OAUTH_ENABLED to drop the divider line when there's no row.
  if (!GOOGLE_ENABLED && !FACEBOOK_ENABLED) return null;
  return (
    <div className="space-y-2.5">
      {GOOGLE_ENABLED ? (
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
      ) : null}
      {FACEBOOK_ENABLED ? (
        <form action={signInWithFacebook}>
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
          >
            <FacebookFIcon />
            Continue with Facebook
          </button>
        </form>
      ) : null}
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
 * Facebook f brand mark — Facebook brand-blue circular disc
 * (#1877F2 per Meta's brand portal) with white "f" letterform
 * inside. Standard outward-facing mark used on "Continue with
 * Facebook" buttons across the web on neutral-chrome auth surfaces
 * (Apple Sign-in companion pattern · Stripe / Linear / Notion all use
 * this same disc on light buttons). Sits on the alabaster button
 * surface as the only colored element so the brand reads instantly
 * without the chrome taking over. Drawn at 24x24 viewBox so it scales
 * cleanly at 18px display size. NOT a verbatim copy of the
 * trademarked Facebook app icon — this is the nominative-use brand
 * mark for deep-link affordances.
 *
 * Pre-2026-05-30 the disc was inverted (white circle + blue f)
 * because it sat on a solid Facebook-blue button. The Clean Editorial
 * unification flipped the button chrome to neutral so the disc now
 * ships in the standard outward orientation.
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
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#ffffff"
        d="M16 8.5h-2.13c-.36 0-.6.32-.6.65V10.5H16l-.25 2.4h-2.48v6.6H10.5v-6.6H8.5v-2.4h2v-1.5c0-1.66.94-3 2.78-3H16v2.5z"
      />
    </svg>
  );
}
