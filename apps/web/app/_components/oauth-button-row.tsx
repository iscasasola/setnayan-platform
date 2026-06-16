import {
  signInWithApple,
  signInWithGoogle,
} from '@/app/auth/oauth-actions';
import { SubmitButton } from '@/app/_components/submit-button';

/**
 * OAuth provider button row — Google + Apple.
 *
 * 2026-06-15 provider-set change (owner directive): the V1 OAuth set is
 * Google + Apple. Facebook OAuth login was removed; Apple was promoted
 * out of its earlier V1.1 deferral. (Facebook *sharing* —
 * lib/social/facebook.ts et al. — is a separate feature and is
 * untouched.) Apple Sign-In gates on Apple Developer Program enrollment
 * ($99/yr) + the Apple provider toggled ON in Supabase Studio, surfaced
 * via the NEXT_PUBLIC_OAUTH_APPLE_ENABLED flag below.
 *
 * Mounted at the TOP of /login and /signup, above the "or continue with
 * email" divider. Industry-standard placement (Stripe, Linear, GitHub,
 * Notion all put OAuth-first when both are offered).
 *
 * Each button is a separate `<form action={serverAction}>` with a hidden
 * `next` input so the post-auth redirect destination round-trips through
 * the OAuth flow. Same pattern as the existing signInWithPassword form on
 * /login/page.tsx so the surrounding code already understands the
 * contract.
 *
 * Brand icons are nominative-use inline SVGs (Google G in standard
 * 4-color quadrant geometry, Apple as the monochrome Apple logo glyph —
 * the standard mark on "Sign in with Apple" buttons). Same approach as
 * PR #405 directions-buttons.tsx (Google Maps + Waze + Apple Maps) —
 * recognized brand marks for deep-link affordances, NOT verbatim
 * trademarked app icon reproductions.
 *
 * Clean Editorial chrome: both buttons use the same neutral pattern —
 * alabaster bg + obsidian text + obsidian/20 border + champagne gold
 * focus ring — with the brand mark as the only contrasting element. The
 * black Apple glyph on a white button is Apple's own sanctioned
 * light-mode treatment, so the two OAuth buttons stay visually
 * symmetric.
 *
 * Instant loading state (CLAUDE.md decision-log — perceived-login-lag
 * fix). Both OAuth buttons use `<SubmitButton>` so the moment the form
 * action fires, the button:
 *   • Disables (prevents double-tap during the 1–3s OAuth round-trip
 *     through Supabase /auth/v1/authorize → provider consent → callback
 *     → exchange → /dashboard → /dashboard/[eventId]).
 *   • Swaps content for a Loader2 spinner + "Redirecting to Google…" /
 *     "Redirecting to Apple…" so the user has an instant "something is
 *     happening" signal instead of a frozen button.
 * The brand-mark SVG hides during pending — the spinner is the active
 * visual signal — and reappears after the redirect lands. Since
 * SubmitButton is a client component, this file ships a small client-
 * boundary at each button, but the parent `OAuthButtonRow` stays a
 * server component so the env-flag gates at module scope still resolve
 * at build time.
 */

type Props = {
  /** Post-auth redirect destination, validated by safeNext() upstream. */
  next: string;
};

// Env-flag gates. Without these flags, clicking the Continue with
// Google / Apple buttons hits Supabase's /auth/v1/authorize endpoint
// with a provider whose credentials aren't pasted into Supabase Studio
// yet → 404. Hide the buttons entirely until owner completes Phase 2D
// of OWNER_ACTIONS.md (paste OAuth credentials into Supabase Studio)
// AND flips the matching env flag in Vercel. Default both flags to
// "false" so a freshly-cloned dev env also doesn't 404 on click.
//
// Why NEXT_PUBLIC_*: these are read at module scope during render of
// the login + signup pages, which are statically generated or server-
// rendered with no per-request auth context. Next.js inlines
// NEXT_PUBLIC_* at build time so the flags work cleanly on both the
// edge and the server runtime.
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true';
const APPLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED === 'true';

/**
 * Whether at least one OAuth provider is enabled. /login + /signup
 * check this so they can drop the "or continue with email" divider
 * when there's no OAuth row above it to separate.
 */
export const ANY_OAUTH_ENABLED = GOOGLE_ENABLED || APPLE_ENABLED;

export function OAuthButtonRow({ next }: Props) {
  // Both providers off → render nothing. /login + /signup also use
  // ANY_OAUTH_ENABLED to drop the divider line when there's no row.
  if (!GOOGLE_ENABLED && !APPLE_ENABLED) return null;
  return (
    <div className="space-y-2.5">
      {GOOGLE_ENABLED ? (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <SubmitButton
            className="flex w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
            pendingLabel="Redirecting to Google…"
          >
            <GoogleGIcon />
            Continue with Google
          </SubmitButton>
        </form>
      ) : null}
      {APPLE_ENABLED ? (
        <form action={signInWithApple}>
          <input type="hidden" name="next" value={next} />
          <SubmitButton
            className="flex w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
            pendingLabel="Redirecting to Apple…"
          >
            <AppleIcon />
            Continue with Apple
          </SubmitButton>
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
 * Apple brand mark — the monochrome Apple logo glyph used on "Sign in
 * with Apple" buttons. Drawn solid black (#000) which is Apple's
 * sanctioned mark for light-mode buttons, sitting on the alabaster
 * button surface as the only contrasting element so the brand reads
 * instantly without the chrome taking over. Drawn at 24x24 viewBox so
 * it scales cleanly at 18px display size. NOT a verbatim copy of the
 * trademarked app icon — this is the nominative-use brand mark for the
 * sign-in affordance, per Apple's "Sign in with Apple" button
 * guidelines.
 */
function AppleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      aria-hidden
      role="img"
      focusable={false}
    >
      <path
        fill="#000000"
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.91 1.33-1.852 2.66-3.347 2.69-1.468.03-1.94-.87-3.61-.87-1.67 0-2.19.84-3.58.9-1.44.05-2.53-1.43-3.45-2.75-1.886-2.71-3.32-7.65-1.39-10.99.96-1.65 2.68-2.7 4.54-2.73 1.42-.03 2.76.96 3.63.96.86 0 2.5-1.19 4.22-1.01.72.03 2.74.29 4.04 2.18-.105.07-2.41 1.41-2.38 4.22.03 3.36 2.95 4.48 2.98 4.49z"
      />
    </svg>
  );
}
