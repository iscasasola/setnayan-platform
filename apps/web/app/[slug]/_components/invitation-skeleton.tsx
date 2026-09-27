import type { CSSProperties } from 'react';
import { Logo } from '@/app/_components/logo';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import type { MonogramConfig } from '@/lib/monogram';
import type { EventWords } from '../_lib/event-words';
import { invitationCard, mastheadEyebrow } from '../_lib/invitation-card';
import { PahinaMasthead } from './pahina-masthead';

/**
 * invitation-skeleton.tsx — what a guest sees while the invitation loads.
 *
 * WHY THIS EXISTS. There was no loading or streaming boundary anywhere under
 * `app/[slug]`, and the page runs a dozen-plus sequential awaits (several of
 * them R2 presign round-trips) before it can render. With no boundary the whole
 * page is React's shell, so nothing flushed until the last await resolved: a
 * guest scanning the QR on a crowded venue network got a BLANK WHITE SCREEN —
 * no monogram, no couple's name, not even a spinner — for as long as the server
 * took. Most people tap again, or decide the link is broken.
 *
 * 🔑 IT SHOWS THE COUPLE'S NAME, NOT A SPINNER. The name and the monogram text
 * come from the event row the page has ALREADY read to make its routing
 * decision, so they cost nothing extra and they are the two things that tell a
 * guest standing at a venue that they are in the right place. A spinner says
 * "wait"; a name says "you found it". That distinction is the entire point of
 * rendering anything here at all.
 *
 * ── IT IS THE SAME PAGE, LOADING (owner 2026-09-27) ────────────────────────
 * Owner, watching his own Event Hub load: *"before the actual website runs, i
 * see another website under"* — and chose "A matching skeleton"
 * (`DECISION_LOG.md`, "THE EVENT HUB'S LOADING SCREEN BECOMES A SKELETON OF
 * THE REAL PAGE"). What he saw was a DIFFERENT PAGE: the names in the theme's
 * `font-display` (Playfair under Vintage) where the real masthead sets them in
 * `font-pahina` (Fraunces), a generic "Loading your Invitation…" line, and
 * grey boxes shaped like nothing on the real page — then all of it replaced by
 * a cream card that had never been there.
 *
 * 🔒 SO THE HERO IS NOT DRAWN HERE — IT IS `PahinaMasthead` ITSELF, the one
 * component every real hero call site renders, given the words the page will
 * give it: the eyebrow and invitation line from the SAME `invitationCard` /
 * `mastheadEyebrow` helpers `site-body.tsx` calls, the names split by the same
 * `twoPeople` fact, the date through the same formatter. Only what needs the
 * slow reads is a placeholder: the programme's first time, the scenes, and —
 * only when the couple's mark is their own drawing — the mark. A lettered mark
 * is drawn by the real `HeroMonogram` from the row already in hand (still, not
 * animated: whether a paid animation is ON is one of the slow reads). A drawn
 * mark (studio or upload, up to 400 KB of SVG) is NOT inlined twice into the
 * worst connection the product sees; it gets a shimmer circle the size of the
 * 80px mark, carrying the couple's letters. A copy of the masthead would drift from it the
 * first time anyone touched either; the component cannot drift from itself.
 * `the-loading-screen-is-the-page.test.ts` renders both and compares them.
 *
 * The frame around it is the shell's frame (`invitation-shell.tsx`): the same
 * pinned band with the mark on the right, the same column at every width
 * (including the `xl` stage and the 76rem ceiling), so nothing moves sideways
 * or down when the invitation replaces this. The scene placeholders sit inside
 * `.sn-hub-cards`, the wrapper whose one stylesheet rule gives every real
 * scene its card (radius, hairline, paper, shadow), with the hub's own 1rem
 * rhythm between them.
 *
 * 🎨 EVERY COLOUR AND FACE IS A VARIABLE the layout's `GuestLookScope` already
 * set — `--color-ink`, `--color-cream`, the gild, `--font-pahina-display` via
 * `font-pahina` — so a theme, a couple's palette and a House page each load in
 * their own look with nothing here knowing which theme it is. The shimmer's
 * base and sweep are the theme's ink and paper for the same reason (the house
 * `.skeleton` hard-codes House's espresso, which vanishes on Velvet).
 *
 * Deliberately cheap: no client JS of its own (`Logo` already ships in the
 * shell's bundle), no data beyond the event row and the type profile the page
 * resolved before this boundary, no new face — `font-pahina` is Fraunces, one
 * of the preloaded first-paint faces (`fonts-preload-only-the-first-paint`).
 * The only movement is the house `.skeleton` sweep, which the global
 * `prefers-reduced-motion` block freezes to a still block.
 */

/** The house shimmer, in the theme's own ink and paper. */
const SHIMMER: CSSProperties = {
  backgroundColor: 'rgb(var(--color-ink) / 0.07)',
  backgroundImage:
    'linear-gradient(90deg, rgb(var(--color-cream) / 0) 0%, rgb(var(--color-cream) / 0.6) 50%, rgb(var(--color-cream) / 0) 100%)',
};

function Bar({ className }: { className: string }) {
  return <span aria-hidden className={`skeleton block rounded-full ${className}`} style={SHIMMER} />;
}

/** One scene, still loading — a real scene card (`.sn-hub-cards > section`)
 *  holding the shape of a section: its label, its title, its lines. */
function ScenePlaceholder({ lines }: { lines: 2 | 3 }) {
  return (
    <section aria-hidden className="space-y-3">
      <Bar className="h-3 w-24" />
      <Bar className="h-6 w-1/2" />
      <Bar className="h-3 w-full" />
      <Bar className="h-3 w-5/6" />
      {lines === 3 ? <Bar className="h-3 w-2/3" /> : null}
    </section>
  );
}

export function InvitationSkeleton({
  displayName,
  monogramText,
  phaseLabel = null,
  words = null,
  eventDate = null,
  heroMedia = false,
  venueName = null,
  showHeader = true,
  mark = null,
}: {
  /** The couple's names, straight off the already-loaded event row. */
  displayName: string | null;
  /** Their monogram letters, if they set any. */
  monogramText: string | null;
  /**
   * The stage's own word (`PUBLIC_STAGE_LABELS`, e.g. "Post Event"), when the
   * caller already knows which one is loading — the Maker's `?editor=1`
   * canvas always does. Null for the ordinary guest link, where the phase
   * isn't decided until after this fallback paints and the generic noun below
   * stays correct for whichever stage the guest is about to land on.
   */
  phaseLabel?: string | null;
  /**
   * The event's words (`eventWordsFromProfile` over the profile page.tsx
   * resolved for its surface gate — pure, no read). They pick the card or the
   * quiet masthead, its eyebrow, its line and whether the names stack, exactly
   * as `site-body.tsx` does. Null → a wedding, the same default the masthead's
   * own `twoPeople` holds.
   */
  words?: Pick<EventWords, 'solemn' | 'twoPeople' | 'eventWord'> | null;
  eventDate?: string | null;
  /** A hero photo/clip is set (`resolveHero`, pure) — the page then opens on
   *  the typographic masthead with its cover plate instead of the card. */
  heroMedia?: boolean;
  venueName?: string | null;
  /** The shell's pinned band. Off in the Maker's canvas, where the real page
   *  draws none either (`editorCanvas` in `invitation-shell.tsx`). */
  showHeader?: boolean;
  /**
   * The couple's lettered mark, resolved from the row already in hand
   * (`resolveMonogram` + its three design columns) — drawn by the real
   * `HeroMonogram`, still. Null when the mark is their own drawing (studio /
   * upload), which is left to the page rather than streamed twice.
   */
  mark?: {
    design: { monogram_style?: string | null; monogram_font_key?: string | null; monogram_frame_key?: string | null };
    monogram: MonogramConfig;
  } | null;
}) {
  const initials = (monogramText ?? '').trim();
  const w = words ?? { solemn: false, twoPeople: true, eventWord: 'wedding' };
  // `firstStartAt: null` — the programme is one of the slow reads. The card
  // simply has no time row until the page arrives with one.
  const card = heroMedia ? null : invitationCard({ words: w, firstStartAt: null });

  const markSlot = mark ? (
    <HeroMonogram
      event={mark.design}
      monogram={mark.monogram}
      animatedMonogram={false}
      bespokeSvg={null}
      shadow={heroMedia}
    />
  ) : (
    <span
      aria-hidden
      className="skeleton relative inline-flex h-20 w-20 items-center justify-center rounded-full"
      style={SHIMMER}
    >
      {initials ? (
        <span className="font-pahina text-2xl italic tracking-tight text-gild/70">{initials}</span>
      ) : null}
    </span>
  );

  return (
    <main
      // The shell's own ground rule, spelled in CSS because the theme is not
      // known here: House keeps its paper, a themed page (or an ombre ground)
      // leaves it off so the layout's fixed ground shows through.
      className="min-h-dvh bg-cream text-ink [[data-hub-theme]_&]:bg-transparent [[data-guest-look]:has(>[data-guest-ombre])_&]:bg-transparent"
      aria-busy="true"
    >
      {showHeader ? (
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur">
          <div className="mx-auto flex min-h-[4rem] w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6 xl:max-w-5xl 2xl:max-w-[76rem] xl:px-8">
            <span className="flex items-center gap-2 text-ink">
              <Logo height={28} />
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/60">Setnayan</span>
            </span>
            {initials ? (
              <span className="sn-top-label font-pahina text-lg italic text-gild">{initials}</span>
            ) : phaseLabel ? (
              <span className="sn-top-label font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
                {phaseLabel}
              </span>
            ) : (
              <Bar className="h-3 w-20" />
            )}
          </div>
        </header>
      ) : null}

      <div
        // Same column as the real page at every width, so the content does not
        // jump sideways (or, at `xl`, grow) when the invitation replaces this.
        className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 xl:max-w-5xl 2xl:max-w-[76rem] xl:px-8 xl:py-20"
      >
        {/* Announced, not drawn: a screen reader hears that it is loading; a
            sighted guest sees the page itself filling in. */}
        <p role="status" className="sr-only">
          Loading your {phaseLabel ?? 'invitation'}…
        </p>

        <div className="space-y-6 text-center">
          <PahinaMasthead
            displayName={displayName ?? ''}
            eventDate={eventDate}
            twoPeople={w.twoPeople}
            eyebrow={mastheadEyebrow(w)}
            venueName={venueName}
            card={card ?? undefined}
            monogramSlot={markSlot}
            mediaSlot={
              heroMedia ? <span aria-hidden className="skeleton absolute inset-0 block" style={SHIMMER} /> : undefined
            }
            mediaCaption={heroMedia ? venueName : null}
          />
        </div>

        <div className="sn-hub-cards mt-8 space-y-4">
          <ScenePlaceholder lines={3} />
          <ScenePlaceholder lines={2} />
        </div>
      </div>
    </main>
  );
}
