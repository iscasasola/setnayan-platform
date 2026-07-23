import { Logo } from '@/app/_components/logo';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildSitePaletteVars } from '@/lib/site-palette';

/**
 * Page chrome shared by every landing state. When `backdrop` is provided (the
 * spatial RSVP backdrop), the world renders FIXED behind everything and the
 * content column sits DIRECTLY on the world — no panel. (Owner 2026-06-11:
 * "remove the white background, so the widgets feel seamless" — the original
 * vellum sheet read as a big white card.) Each widget keeps its own cream
 * card surface, so the cards float on the art; legibility for the LOOSE text
 * between cards comes from the soft blurred light-column the SpatialBackdrop
 * itself renders behind the content area (reads as ambient glow, not paper).
 * The footer goes transparent over the backdrop's bottom vignette.
 */
export function InvitationShell({
  children,
  backdrop,
  rolePalette,
  fullBleed = false,
  hideWatermark = false,
}: {
  children: React.ReactNode;
  backdrop?: React.ReactNode;
  // Paid COUPLE_WEBSITE_PRO perk (retired/unbundled) — when the event owns the ACTIVE
  // upgrade, drop the freemium "Powered by Setnayan · setnayan.com" footer
  // watermark. Resolved once at the top-level page (eventCoupleWebsiteProActive)
  // + threaded through each render branch. Defaults false → free site keeps it.
  hideWatermark?: boolean;
  // Couple's mood-board palette (events.role_palette). When present + themeable,
  // it overrides the --color-* tokens for THIS subtree only, re-skinning every
  // cream/ink/terracotta/mulberry class on the couple site (all four phases).
  // Null/thin palette → no override → the Clean-Editorial defaults apply.
  rolePalette?: unknown;
  // Full-screen mode (owner 2026-06-19): the Save-the-Date film IS the whole
  // experience — drop the Setnayan/Invitation top bar + footer + the centred
  // max-width column so it plays edge-to-edge with no chrome.
  fullBleed?: boolean;
}) {
  const themeVars = buildSitePaletteVars(sanitizeRolePalette(rolePalette));
  if (fullBleed) {
    return (
      <main
        className="min-h-dvh bg-cream text-ink"
        style={themeVars ? (themeVars as React.CSSProperties) : undefined}
      >
        {children}
      </main>
    );
  }
  return (
    <main
      className={`min-h-dvh text-ink ${backdrop ? 'relative' : 'bg-cream'}`}
      style={themeVars ? (themeVars as React.CSSProperties) : undefined}
    >
      {backdrop}
      <header className="relative z-10 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-ink">
            <Logo height={28} />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
            Invitation
          </span>
        </div>
      </header>
      <div
        className={
          backdrop
            ? // text-shadow INHERITS: every text node in the column gets a soft
              // cream halo — invisible on the widgets' own cream cards, but it
              // rims the LOOSE dark text (intro copy, eyebrows, greetings) so
              // it stays readable directly on the world art. This carries the
              // legibility duty the retired vellum/wash used to (v3, owner
              // screenshot feedback: even the /35 wash read as a white veil).
              'relative z-10 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 [text-shadow:0_1px_14px_rgba(251,251,250,0.9),0_0_4px_rgba(251,251,250,0.75),0_1px_1px_rgba(30,34,41,0.18)]'
            : 'mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14'
        }
      >
        {children}
      </div>
      {/* Quiet footer signature — structural addition from v2.1 guest-microsite
          template's "See you on the 12th." closing line. Italic serif treatment
          gives the page an editorial sign-off without competing with the
          functional widgets above. Couple palette tokens (terracotta · ink)
          untouched. */}
      <footer
        className={`relative z-10 px-4 py-8 text-center ${
          backdrop ? 'border-t border-cream/15' : 'border-t border-ink/10'
        }`}
      >
        <p
          className={`font-serif text-lg italic ${
            backdrop ? 'text-cream/90' : 'text-terracotta'
          }`}
        >
          See you soon.
        </p>
        {hideWatermark ? null : (
          <p className={`mt-3 text-xs ${backdrop ? 'text-cream/55' : 'text-ink/50'}`}>
            Powered by Setnayan · setnayan.com
          </p>
        )}
      </footer>
    </main>
  );
}
