import { Logo } from '@/app/_components/logo';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildSitePaletteVars } from '@/lib/site-palette';
import {
  PahinaCoverParallax,
  PahinaMotionObserver,
  PahinaMotionRootFlag,
} from './pahina-motion';

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
  artDirection,
  children,
  backdrop,
  rolePalette,
  monogramText,
  fullBleed = false,
  hideWatermark = false,
  customColorVars,
}: {
  /** Pahina art direction (PR-5b). Only 'candlelight' stamps an attribute —
   *  daylight renders exactly today's DOM, so every existing event is
   *  byte-stable. The dark recipe is a var block in globals.css. */
  artDirection?: 'daylight' | 'candlelight' | null;
  children: React.ReactNode;
  /** Pahina (wave A PR-2): couple's monogram text for the header right slot —
   *  gild Fraunces italic. Falls back to the mono "Invitation" label. */
  monogramText?: string | null;
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
  // Website Pro net-new manual site colours (Launch settings §4.4 · PR-C) —
  // pre-computed --color-* overrides (lib/site-palette buildCustomSiteColorVars),
  // ALREADY gated on ACTIVE Website Pro upstream (loadMedia). When present they
  // layer OVER the Mood-Board palette (couple's manual pick wins). When
  // undefined/null the merge is a NO-OP: `themeVars` stays byte-identical to the
  // palette-only result, so a non-Pro / unset event renders exactly as today.
  customColorVars?: Record<string, string> | null;
}) {
  const paletteVars = buildSitePaletteVars(sanitizeRolePalette(rolePalette));
  // Byte-safety: when there are no custom colours, `themeVars` is IDENTICAL to
  // `paletteVars` (the pre-PR-C value). Only when custom colours exist do we
  // spread them over the palette (custom wins per-role).
  const themeVars =
    customColorVars && Object.keys(customColorVars).length > 0
      ? { ...(paletteVars ?? {}), ...customColorVars }
      : paletteVars;
  if (fullBleed) {
    return (
      <main
        className="min-h-dvh bg-cream text-ink"
        data-art={artDirection === 'candlelight' ? 'candlelight' : undefined}
        style={themeVars ? (themeVars as React.CSSProperties) : undefined}
      >
        {children}
      </main>
    );
  }
  return (
    <main
      className={`min-h-dvh text-ink ${backdrop ? 'relative' : 'bg-cream'}`}
      data-art={artDirection === 'candlelight' ? 'candlelight' : undefined}
      style={themeVars ? (themeVars as React.CSSProperties) : undefined}
    >
      {/* Scroll choreography (design §6). Deliberately NOT on the fullBleed
          path above — the veil reveal and STD film own their own motion and the
          build plan leaves them untouched. Must sit above the content: the flag
          arms the hidden state before first paint, and its partner below the
          content builds the observer. See pahina-motion.tsx for why a failure
          in either one leaves the page fully visible. */}
      <PahinaMotionRootFlag />
      {backdrop}
      <header className="relative z-10 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6 xl:max-w-5xl xl:px-8">
          <span className="flex items-center gap-2 text-ink">
            <Logo height={28} />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </span>
          {monogramText ? (
            <span className="font-pahina text-lg italic text-gild">{monogramText}</span>
          ) : (
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
              Invitation
            </span>
          )}
        </div>
      </header>
      {/* THE PAGE'S COLUMN.
          🔴 THIS ONE CLASS WAS THE "NARROW COLUMN IN A WIDE WINDOW". It capped
          the ENTIRE guest page at the 48rem plate at EVERY width, so on a
          2000px monitor the event page was a ribbon adrift in cream. The owner
          saw it, and moving the navigation twice did not touch it — because the
          navigation was never what was narrow.

          At `xl` it opens to the STAGE (64rem). That is not a new decision:
          `_lib/measures.ts` already defines the stage as "the widest anything
          may ever be", and the three-widths study names **the desktop shell**
          as a stage-measure thing in the same sentence.

          🔒 PROSE DOES NOT WIDEN WITH IT. Every sentence inside still sits at
          its own reading measure (~65 characters), so nothing a guest READS
          gets a longer line — the room around the words grows, not the words.
          The study says the same: *"the masthead does not grow — the room
          around it does"*.

          ⚠ `xl`, the same threshold the desktop rail uses, deliberately: one
          desktop switch, not two. And the rail's own arithmetic was already
          computed against a 64rem widest column, so this cannot push it into
          the page — `rail-fits.test.ts` asserts that sum. */}
      <div
        className={
          backdrop
            ? // text-shadow INHERITS: every text node in the column gets a soft
              // cream halo — invisible on the widgets' own cream cards, but it
              // rims the LOOSE dark text (intro copy, eyebrows, greetings) so
              // it stays readable directly on the world art. This carries the
              // legibility duty the retired vellum/wash used to (v3, owner
              // screenshot feedback: even the /35 wash read as a white veil).
              'relative z-10 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 xl:max-w-5xl xl:px-8 xl:py-20 [text-shadow:0_1px_14px_rgba(251,251,250,0.9),0_0_4px_rgba(251,251,250,0.75),0_1px_1px_rgba(30,34,41,0.18)]'
            : 'mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 xl:max-w-5xl xl:px-8 xl:py-20'
        }
      >
        {children}
      </div>
      <PahinaMotionObserver />
      {/* Hero cover parallax (design §6). Below the content because it measures
          the masthead's cover plate; a no-op (returns immediately) on every page
          that has no plate — /find-my-table, the text-only hero, the private
          landing — so the one mount safely serves the whole shell. NOT on the
          fullBleed path above, same as the reveal: the STD film owns its own
          motion. */}
      <PahinaCoverParallax />
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
          className={`font-pahina text-lg italic ${
            backdrop ? 'text-cream/90' : 'text-gild'
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
