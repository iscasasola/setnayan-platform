import {
  signInWithApple,
  signInWithGoogle,
} from '@/app/auth/oauth-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { GoogleGIcon, AppleIcon } from '@/app/_components/oauth-icons';
import { OAuthAccountTypeMirror } from '@/app/_components/oauth-account-type-mirror';

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
  /**
   * Color treatment. 'light' (default) is the Clean Editorial alabaster button
   * used on /signup and the legacy /login card. 'dark' is the translucent
   * light-on-dark treatment for the full-bleed sign-in rail (frosted obsidian
   * panel) — white text + a white Apple glyph so the buttons read on the dark
   * surface. Default keeps every existing call site unchanged.
   */
  variant?: 'light' | 'dark';
  /**
   * /signup only: carry the Couple/Vendor selection into the OAuth forms so a
   * vendor signing up via Google/Apple isn't misclassified as a customer. Each
   * form gets a hidden `account_type` input mirrored from the radio by
   * <OAuthAccountTypeMirror>. Omitted on /login (existing users — no selector),
   * keeping that surface byte-identical.
   */
  withAccountType?: boolean;
  /**
   * SSR default for the hidden OAuth `account_type` (only when withAccountType).
   * Pass the URL-derived intent (e.g. /signup?as=vendor → 'vendor') so a
   * deep-linked vendor's OAuth submit carries the right value BEFORE the mirror
   * hydrates — and even with JS off. The mirror then only tracks runtime radio
   * toggles. Defaults to 'customer'.
   */
  defaultAccountType?: 'customer' | 'vendor';
};

// Button chrome per variant. Light = alabaster/obsidian (unchanged). Dark =
// translucent white on the obsidian rail, mirroring the mockup's OAuth pills.
const BTN_LIGHT =
  'flex w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40';
const BTN_DARK =
  'flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

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

export function OAuthButtonRow({
  next,
  variant = 'light',
  withAccountType = false,
  defaultAccountType = 'customer',
}: Props) {
  // Both providers off → render nothing. /login + /signup also use
  // ANY_OAUTH_ENABLED to drop the divider line when there's no row.
  if (!GOOGLE_ENABLED && !APPLE_ENABLED) return null;
  const btn = variant === 'dark' ? BTN_DARK : BTN_LIGHT;
  // White Apple glyph on the dark rail (the black default is invisible there).
  const appleFill = variant === 'dark' ? '#FFFFFF' : '#000000';
  // /signup: a hidden account_type input per OAuth form, SSR'd to the URL-derived
  // intent (so a deep-linked vendor is correct pre-hydration / no-JS) and kept in
  // sync with the Couple/Vendor radio at runtime by <OAuthAccountTypeMirror>.
  const accountTypeField = withAccountType ? (
    <input
      type="hidden"
      name="account_type"
      defaultValue={defaultAccountType}
      data-oauth-account-type
    />
  ) : null;
  return (
    <div className="space-y-2.5">
      {GOOGLE_ENABLED ? (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          {accountTypeField}
          <SubmitButton className={btn} pendingLabel="Redirecting to Google…">
            <GoogleGIcon />
            Continue with Google
          </SubmitButton>
        </form>
      ) : null}
      {APPLE_ENABLED ? (
        <form action={signInWithApple}>
          <input type="hidden" name="next" value={next} />
          {accountTypeField}
          <SubmitButton className={btn} pendingLabel="Redirecting to Apple…">
            <AppleIcon fill={appleFill} />
            Continue with Apple
          </SubmitButton>
        </form>
      ) : null}
      {withAccountType ? <OAuthAccountTypeMirror /> : null}
    </div>
  );
}

// GoogleGIcon + AppleIcon moved to ./oauth-icons (shared with the desktop
// system-browser OAuth buttons). Imported above.
