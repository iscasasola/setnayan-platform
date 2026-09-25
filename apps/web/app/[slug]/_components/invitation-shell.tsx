import { Logo } from '@/app/_components/logo';
import type { InviteThemeId } from '@/lib/invite-themes';
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
  hubTheme,
  children,
  backdrop,
  monogramText,
  fullBleed = false,
  editorCanvas = false,
  hideWatermark = false,
  magicTraveller = null,
  ownGround = false,
}: {
  /**
   * 🌈 The couple chose an OMBRÉ background (`lib/ombre.ts`): the layout's
   * paper paints it, and this shell must leave its own opaque paper off exactly
   * as it does for a themed ground — Classic included, which otherwise keeps
   * `bg-cream`. Decided upstream from the same overlaid row the page renders.
   */
  ownGround?: boolean;
  /**
   * The Event Hub theme, ALREADY RESOLVED by `resolveInviteTheme` upstream —
   * Pro ownership and the wedding fence are decided there, not here.
   *
   * ⛔ THE SHELL NO LONGER WEARS THE LOOK — `[slug]/layout.tsx` does, once, for
   * every page of the guest tree (owner 2026-09-25: *"yes place it there"*).
   * The theme's attribute, its fonts, the couple's `--accent`, the mood-board
   * palette, the Pro colours and face and the candlelight art direction all
   * used to be stamped on THIS `<main>`, which only the landing page and the
   * private landing render — so `/find-seat`, `/seat`, `/hub`, `/everyone` and
   * the rest never wore any of it. Stamping them here as well would re-declare
   * them on a descendant, and a re-declared `data-hub-theme` beneath the
   * layout's inline palette would let the theme's stylesheet beat the couple's
   * own colours — the precedence `theme < palette < their own hex` inverted.
   *
   * What the shell still needs is the NAME, for one decision: a themed page
   * leaves its paper off (see `themed` below).
   */
  hubTheme?: InviteThemeId | null;
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
  /** 🖼 The Maker's canvas (`isEditorCanvas`, verified upstream) — the site
   *  header is chrome, not a section, so it is not drawn there. */
  editorCanvas?: boolean;
  // Full-screen mode (owner 2026-06-19): the Save-the-Date film IS the whole
  // experience — drop the Setnayan/Invitation top bar + footer + the centred
  // max-width column so it plays edge-to-edge with no chrome.
  fullBleed?: boolean;
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
   * script tag, no rule that matches — the same byte-safety the layout's look
   * holds itself to.
   */
  magicTraveller?: MagicTraveller | null;
}) {
  /*
    House — and anything upstream turned into House — keeps today's opaque
    paper, so an event that never chose a theme renders the DOM it always did.
  */
  const themed = Boolean(hubTheme && hubTheme !== 'house') || ownGround;
  if (fullBleed) {
    return (
      <main
        /*
          🔴 `bg-cream` IS DROPPED WHEN A GROUND IS PRESENT. It is opaque, and it
          sits ON TOP of the fixed ground the layout lays behind every themed
          page — paint it and a theme's ground is invisible while every test
          still passes. The spatial backdrop path has always done this; a theme
          needs it for the same reason. `relative` replaces it so the content
          still stacks above.
        */
        className={`min-h-dvh text-ink ${themed ? 'relative' : 'bg-cream'}`}
      >
        {children}
      </main>
    );
  }
  return (
    <main
      className={`min-h-dvh text-ink ${backdrop || themed ? 'relative' : 'bg-cream'}`}
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
      {editorCanvas ? null : (
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
      )}
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
