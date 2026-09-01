/**
 * front-door-editorials.ts — a published editorial, shaped for the front door's
 * one shelf.
 *
 * ── THE DEFECT THIS MODULE CLOSES ──────────────────────────────────────────
 * `app/_components/frontdoor/data.ts` has called `loadPublishedShowcases(24)`
 * since the front door shipped, and threw every row away — reducing all 24 to
 * `realWeddingCount`, a number its own type marks "Only ever feeds the SHAPE
 * composer, never the screen". So the home page LOADED the published
 * editorials and rendered none of them: a real celebration's story reached
 * `/realstories` and nowhere else, while the front page's "Stories" chip showed
 * only storyteller CHAPTERS — a different object, from a different table, with
 * a different gate.
 *
 * ── WHAT THIS MODULE IS, AND IS NOT ────────────────────────────────────────
 * PURE. It holds no data and does no I/O: it decides WHAT a showcase looks like
 * once it is a card, and nothing else. The caller does the reading. That is the
 * same shape `lib/business-alaga.ts` uses and for the same reason — the
 * decision can then be asserted without a database, so these rules are held by
 * real assertions instead of a regex over the renderer's source.
 *
 * 🔑 IT ADDS NO GATE AND REMOVES NONE. The RA 10173 consent gate (eligible
 * kind + public slug + T+30d grace + `users.public_summary_consent_at`) lives
 * in `lib/showcase-db.ts` and stays there. Anything that reaches this function
 * has ALREADY passed it. The one thing decided here is the SAMPLE exclusion
 * below, which is a rule about what the front page may CLAIM.
 */

/**
 * The half of `ShowcaseEntry` a card actually needs. Declared structurally so
 * this module never imports the loader — a mapper that pulls in a DB module
 * cannot be tested without one, which is the whole point of it being pure.
 */
export type EditorialSource = {
  href: string;
  coupleNames: string;
  heroImageUrl: string | null;
  heroVideoUrl: string | null;
  isSample: boolean;
};

/**
 * The card shape. Structurally a `FrontDoorStory` — the assignment in `data.ts`
 * is what proves it, and TypeScript fails the build if these ever drift.
 */
export type EditorialStory = {
  href: string;
  title: string;
  ownerName: string;
  kind: 'editorial';
  ownerSlug: null;
  kindLabel: string;
  hasVideo: boolean;
  readingMinutes: null;
  thumbUrl: string | null;
  excerpt: null;
  fromYourPeople: false;
};

/**
 * The card's label — the only thing distinguishing an editorial from a chapter
 * on the shared shelf.
 *
 * 🔴 NOT A WEDDING WORD. `showcase-db.ts` carries a red note that this covers
 * EVERY kind of celebration — a debut, a graduation, a christening, a reunion,
 * a wake — and records that five `.eq('event_type', 'wedding')` filters were
 * deleted from it in 2026-08 because they refused those an editorial outright.
 * Hard-coding "Wedding" here would re-introduce that bug at the last surface,
 * where it is the most visible it could possibly be.
 */
export const EDITORIAL_KIND_LABEL = 'Real story';

/**
 * Map consent-gated showcases onto the front door's shelf.
 *
 * ⚠ SAMPLES ARE DROPPED, and this is the one product rule the function owns.
 * `loadPublishedShowcases` deliberately falls back to a curated sample so
 * `/realstories` is never blank, and that page renders it behind an honest
 * "Sample" badge. The front page is different: a count only shapes a rail,
 * but a CARD makes a claim. The home page saying "here is a celebration
 * somebody had" about a sample would be the page staging the one thing it
 * promises it never stages — the same reason `realWeddingCount` already
 * excludes samples one line from where this is called.
 *
 * 🔑 CONSEQUENCE, STATED RATHER THAN DISCOVERED: with no real consented couple
 * this returns `[]`, and the shelf shows exactly what it shows today. Measured
 * in production 2026-09-01 — 0 accounts with `public_summary_consent_at`. That
 * is the honest empty state, not a broken build, and it fills itself with no
 * further work the day the first couple consents.
 */
export function editorialsToStories(
  showcases: readonly EditorialSource[],
): EditorialStory[] {
  return showcases
    .filter((s) => !s.isSample)
    .map((s) => ({
      // The couple's OWN canonical editorial. `showcase-db.ts` is explicit that
      // this is never a duplicate copy living under /realstories.
      href: s.href,
      title: s.coupleNames,
      ownerName: s.coupleNames,
      kind: 'editorial' as const,
      /*
        🔴 NULL, DELIBERATELY — the byline is PRINTED, never linked.

        A showcase reaches the shelf through `users.public_summary_consent_at`
        (consent to be written up). That is NOT `public_profile_enabled`, which
        is what makes `/u/{slug}` render and which is `DEFAULT FALSE`. So a
        couple can consent to their editorial being public while having no
        public profile page at all, and a byline door would then 404 — on the
        FRONT PAGE, for the first real couple who ever consents.

        Measured in production 2026-09-01: 7 accounts, 1 with
        `public_profile_enabled`, 0 consenters. The trap has not bitten yet
        precisely because nobody has reached it.
      */
      ownerSlug: null as null,
      kindLabel: EDITORIAL_KIND_LABEL,
      /*
        ⚠ THE CLIP, NEVER THE STILL. `heroImageUrl` is a picture; `heroVideoUrl`
        is the video. Deriving "has video" from the poster is the #4402 bug that
        `data.ts` already carries two warnings about — it answers NO for a story
        that is entirely video, dropping the ▶ from its card.
      */
      hasVideo: s.heroVideoUrl !== null,
      /*
        An editorial has no chapter body at this loader, so there is no honest
        number of minutes. `null` makes the card show none — "no minutes rather
        than a guess", the rule the story type already states.
      */
      readingMinutes: null as null,
      // The couple's website hero, already resolved to a display URL by the
      // loader. `null` is legitimate — the card falls back to its own treatment.
      thumbUrl: s.heroImageUrl,
      /*
        NO EXCERPT, DELIBERATELY. An editorial's opening line is not among the
        fields `ShowcaseEntry` carries, and synthesising one from the city, the
        date or the couple's names would put words on the front page that the
        couple never wrote about their own wedding. The card's own terminal
        fallback handles it.
      */
      excerpt: null as null,
      /*
        FAIL CLOSED, ALWAYS. "Your people" is a claim about who somebody knows,
        resolved from PUBLIC PROFILE slugs (`lib/your-people.ts`) — the very
        thing an editorial's author may not have. There is nothing to match on,
        so the honest answer is `false`, never a `true` nobody computed.
      */
      fromYourPeople: false as false,
    }));
}
