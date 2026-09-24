import { Logo } from '@/app/_components/logo';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildSitePaletteVars } from '@/lib/site-palette';
import type { InviteThemeId } from '@/lib/invite-themes';
import { siteSkin } from './skins/site-skin';
import {
  PahinaCoverParallax,
  PahinaMotionObserver,
  PahinaMotionRootFlag,
  ArrivalOnce,
} from './pahina-motion';
import { MagicMove } from './magic-move';
import type { MagicTraveller } from '@/lib/magic-move';

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
  hubTheme,
  hubPhoto,
  hubAccent,
  children,
  backdrop,
  rolePalette,
  monogramText,
  fullBleed = false,
  hideWatermark = false,
  customColorVars,
  magicTraveller = null,
}: {
  /** Pahina art direction (PR-5b). Only 'candlelight' stamps an attribute —
   *  daylight renders exactly today's DOM, so every existing event is
   *  byte-stable. The dark recipe is a var block in globals.css. */
  artDirection?: 'daylight' | 'candlelight' | null;
  /**
   * The Event Hub theme, ALREADY RESOLVED by `resolveInviteTheme` upstream —
   * Pro ownership and the wedding fence are decided there, not here. 'house'
   * (or undefined) renders exactly today's page: no attribute, no ground.
   *
   * 🔑 The caller resolves it because the gate needs an orders lookup and a
   * profile, and a shell that took the raw column would be a second opinion
   * about who owns what. See `lib/invite-themes.ts`.
   */
  hubTheme?: InviteThemeId | null;
  /** The couple's reveal background, presigned (`lib/invite-ground.ts`), or null. */
  hubPhoto?: string | null;
  /** The couple's colour — ornament only, mixed into the theme's material. */
  hubAccent?: string | null;
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
  /**
   * MAGIC MOVE — which element travels, already sanitized upstream, or null.
   *
   * 🔑 THE SHELL OWNS THE BERTH AND THE SCRIPT; THE PAGE OWNS THE TRAVELLER.
   * The place the mark arrives is the sticky header right here, and the script
   * that measures both ends mounts beside the two that already run. What
   * actually flies is the hero's own mark, which lives in `children` — so
   * `site-body.tsx` hands the same value to `EditorialContent` and the two ends
   * are set from ONE column.
   *
   * ⛔ NULL RENDERS THE PAGE THAT SHIPPED BEFORE THIS EXISTED. No attribute, no
   * script tag, no rule that matches — the same byte-safety `hubThemeAttr` and
   * `customColorVars` hold themselves to.
   */
  magicTraveller?: MagicTraveller | null;
}) {
  const paletteVars = buildSitePaletteVars(sanitizeRolePalette(rolePalette));
  /*
    The theme's ground + the `--accent` its material mixes with. `siteSkin`
    returns undefined for House and for any theme upstream turned into House, so
    everything below is a no-op for an event that never chose one.
  */
  const skin =
    hubTheme && hubTheme !== 'house'
      ? siteSkin(hubTheme, { photo: hubPhoto ?? null, accent: hubAccent ?? 'currentColor' })
      : undefined;
  /*
    ⚠ `data-hub-theme` IS WITHHELD WHEN THE SKIN IS UNDEFINED, not set to
    'house'. React omits an undefined attribute entirely, so an unthemed event
    renders the DOM it rendered before this feature existed — the same
    byte-safety property `artDirection`'s daylight path has, and the reason a
    theme rollout cannot quietly restyle a page a couple already shared.
  */
  const hubThemeAttr = skin ? hubTheme ?? undefined : undefined;
  // Byte-safety: when there are no custom colours, `themeVars` is IDENTICAL to
  // `paletteVars` (the pre-PR-C value). Only when custom colours exist do we
  // spread them over the palette (custom wins per-role).
  const colourVars =
    customColorVars && Object.keys(customColorVars).length > 0
      ? { ...(paletteVars ?? {}), ...customColorVars }
      : paletteVars;
  /*
    🔑 THE SKIN'S `--accent` IS MERGED IN, THE THEME'S COLOURS ARE NOT. The
    material lives in a STYLESHEET block (globals.css), deliberately: inline
    style beats any stylesheet, so a theme expressed inline would silently
    overwrite the couple's own mood-board palette and Pro hex colours, which
    arrive right here. As a stylesheet the precedence falls out correct for
    free — theme < palette < the couple's own hex. `--accent` is the one
    exception because it IS the couple's colour, not the theme's.
  */
  const themeVars =
    skin || colourVars
      ? { ...(colourVars ?? {}), ...(skin?.style ?? {}) }
      : undefined;
  if (fullBleed) {
    return (
      <main
        /*
          🔴 `bg-cream` IS DROPPED WHEN A GROUND IS PRESENT. It is opaque, and it
          sits ON TOP of the fixed layer below — paint it and the theme's ground
          is invisible on every page while every test still passes. The spatial
          backdrop path has always done this; a skin needs it for the same
          reason. `relative` replaces it so the content still stacks above.
        */
        className={`min-h-dvh text-ink ${skin ? 'relative' : 'bg-cream'} ${
          skin?.className ?? ''
        }`.trim()}
        data-art={artDirection === 'candlelight' ? 'candlelight' : undefined}
        data-hub-theme={hubThemeAttr}
        style={themeVars ? (themeVars as React.CSSProperties) : undefined}
      >
        {children}
      </main>
    );
  }
  return (
    <main
      className={`min-h-dvh text-ink ${backdrop || skin ? 'relative' : 'bg-cream'} ${
        skin?.className ?? ''
      }`.trim()}
      data-art={artDirection === 'candlelight' ? 'candlelight' : undefined}
      data-hub-theme={hubThemeAttr}
      style={themeVars ? (themeVars as React.CSSProperties) : undefined}
    >
      {/* Scroll choreography (design §6). Deliberately NOT on the fullBleed
          path above — the veil reveal and STD film own their own motion and the
          build plan leaves them untouched. Must sit above the content: the flag
          arms the hidden state before first paint, and its partner below the
          content builds the observer. See pahina-motion.tsx for why a failure
          in either one leaves the page fully visible. */}
      <PahinaMotionRootFlag />
      <ArrivalOnce />
      {backdrop}
      {/* `sn-top-label` steps aside for the fixed top-right controls (the
          music button, a guest's Account) — see `.sn-top-label` in
          globals.css. They float over this bar's right end on a phone, and at
          full scroll-top the label sat underneath them (seen live 2026-09-21:
          the music button covering "INVITATION"). */}
      {/* 📌 PINNED, SO THE CORNER BUTTONS ALWAYS SIT ON IT (seen live
          2026-09-21 as a test guest: scrolled, the pinned music and account
          buttons sat on top of the pass's header). The band travels with the
          page top and the corner controls (fixed at top-3, 44px tall) always
          land on its solid ground — 4rem clears 0.75rem + 2.75rem. z-20: above
          the page, under the corner controls (z-40 and up) and every sheet. */}
      <header data-sticky-top className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4rem] w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6 xl:max-w-5xl 2xl:max-w-[76rem] xl:px-8">
          <span className="flex items-center gap-2 text-ink">
            <Logo height={28} />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </span>
          {monogramText && magicTraveller === 'mark' ? (
            /* ✈ THE BERTH — the place the hero's mark is flying to.
               It carries the SAME text at the SAME size, so the box reserves
               exactly the space the mark will occupy and the header does not
               re-flow when it lands. `visibility: hidden` rather than a missing
               node or `display:none`: the script measures this rect, and a
               `display:none` element has no rect at all.
               🪤 IT IS ALSO WHAT A READER GETS WHEN THE SCRIPT NEVER RUNS, so
               `.pahina-js` gates the hiding in globals.css — no flag, no
               travel, and the monogram simply sits here as it always did. Reduced
               motion, a missing IntersectionObserver and the 2s self-heal all
               already remove that flag. `aria-hidden` because the hero's mark is
               the one a screen reader should meet, and two copies of the same
               monogram read as a stutter. */
            <span
              data-magic-berth
              aria-hidden
              className="sn-top-label font-pahina text-lg italic text-gild"
            >
              {monogramText}
            </span>
          ) : monogramText ? (
            <span className="sn-top-label font-pahina text-lg italic text-gild">{monogramText}</span>
          ) : (
            <span className="sn-top-label font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
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

          ⚠ AND IT STOPS AT 76rem. The owner saw the 64rem version on a 2000px
          monitor — 51% of the glass — and asked for a limit rather than
          unbounded growth. 76rem is that ceiling and it is FINAL: the column
          never grows past 1216px, so a 2560px screen gets more margin, not a
          wider invitation. **A page that grows forever stops being a page.**

          🔑 76 and not 80, and the difference is the rail. The rail floats in
          the left margin at `50% − (half the widest column + 7rem + a 1.5rem
          gap)`. At an 80rem ceiling that gap collapses to 0.25rem at 1536px —
          the rail would all but touch the text. At 76rem the gap is a constant
          1.5rem at EVERY width from 1536 to 2560. `rail-fits.test.ts` asserts
          the sum, which is why this was arithmetic and not taste.

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
              'relative z-10 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 xl:max-w-5xl 2xl:max-w-[76rem] xl:px-8 xl:py-20 [text-shadow:0_1px_14px_rgba(251,251,250,0.9),0_0_4px_rgba(251,251,250,0.75),0_1px_1px_rgba(30,34,41,0.18)]'
            : 'mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 xl:max-w-5xl 2xl:max-w-[76rem] xl:px-8 xl:py-20'
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
      {/* ✈ MAGIC MOVE, and only when a couple asked for it.
          Third in the row on purpose: it measures a rect in the header ABOVE
          and a rect in `children` above that, so it has to come after both are
          in the document — the same reason the parallax sits below the content
          it measures.
          🔑 THIS LINE IS THE WHOLE POINT OF THIS CHANGE. `magic-move.tsx` was
          written, tested and merged on 2026-09-23 with NO importer anywhere in
          the tree, and `ugat-both-ends.db.test.ts` failed the branch for it:
          "component-no-mount: mount it from a page, or delete it." A component
          nobody mounts is indistinguishable from a component nobody wrote. */}
      {magicTraveller ? <MagicMove /> : null}
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
