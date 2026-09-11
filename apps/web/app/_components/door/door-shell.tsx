/**
 * DoorShell — ONE chrome for every door into Setnayan.
 *
 * WHAT A DOOR IS: a page somebody lands on BEFORE they are inside — a claim
 * link, an invite, a join step, a dead token. They arrive from a printed QR, a
 * Messenger forward or an email, usually on a phone, usually having never seen
 * the product. It is the first thing they meet and, until now, the only part of
 * Setnayan nobody had designed.
 *
 * WHY THIS EXISTS. Before this component the ten token-gated doors carried SIX
 * different hand-rolled wrappers — `min-h-screen bg-cream` centred, `min-h-dvh
 * max-w-md` stacked, `max-w-xl` with its own card, and three more — plus a
 * local `Shell()` re-declared in four separate files. `JoinShell` had the right
 * idea first and never left `/join`: three of its own sibling steps hand-copied
 * its wrapper instead of importing it. This is that idea, finished, and moved
 * where every door can reach it.
 *
 * 🔑 IT IS NOT A NEW DESIGN. It reproduces the register the app already locked
 * for the one door that WAS designed — the sign-in card (`.sn-signin-terra` in
 * home-reskin.css, owner 2026-07-18 "we only want 1 login"): a calm card on
 * paper, a 3px terracotta top edge, a terracotta eyebrow, and exactly one
 * terracotta action. Those rules are re-expressed here in Tailwind rather than
 * imported, on purpose — see BUNDLE below.
 *
 * 🎨 THE EYEBROW IS `text-mulberry`, NEVER `text-terracotta`. In this repo the
 * Tailwind slot named `terracotta` is the ATELIER GOLD #A9834B (tailwind.config
 * .ts: "`terracotta` → ACCENT (Champagne Gold)"), and the CTA terracotta
 * #C24E25 lives in the slot named `mulberry`. The names are inherited and they
 * are backwards. Ten eyebrows and links across the doors read `text-terracotta`
 * and therefore rendered gold at **3.37:1 on cream — a real AA failure**,
 * measured, not assumed. #C24E25 is 4.61:1 and passes. A door is the one screen
 * where the reader has no context to recover from unreadable text.
 *
 * 📦 BUNDLE: no new stylesheet. `main` sits at 199.8 KB of a locked 200 KB and
 * a separate .css file is another module in the shared chunk manifest — the
 * reason the sign-in panel's own rules were put inside home-reskin.css rather
 * than a file of their own. Tailwind utilities add no module.
 *
 * ⛔ NO BOTTOM BAR, EVER. A door is outside the app; the bottom bar is how a
 * phone says you are inside (seam invariant 5). The wordmark is the way out
 * (owner 2026-08-13) and is the only navigation a door carries.
 */
import Link from 'next/link';
import { Wordmark } from '@/app/_components/brand-marks';

/**
 * THRESHOLD vs DEAD-END — the one real branch a door has.
 *
 * `threshold` is a door you can walk through: an invite, a claim, a step. It
 * wears the action colour because there IS an action.
 *
 * `dead_end` is a link that expired, was revoked, or never worked. Painting the
 * action colour on a screen with nothing to act on is a small lie, and these
 * pages are read by someone who has just been refused — the calm neutral edge
 * says "this is a message, not a task". The only control is the way home.
 */
export type DoorTone = 'threshold' | 'dead_end';

export type DoorStep = {
  /** The decision this bead stands for — a name, never a number or a percent. */
  label: string;
  /** Done = a decision already made. */
  done?: boolean;
  /** The step being taken right now. Exactly one, or none. */
  current?: boolean;
};

/**
 * A THEME SKIN — the invite link's themes (lib/invite-themes.ts, owner
 * 2026-09-10). A skin owns what sits BEHIND and AROUND the card; it never owns
 * the card, its 3px edge or its one action, which is what keeps five themes one
 * product. Every slot is decoration (aria-hidden), so a skinned door reads to a
 * screen reader exactly as the bare one does.
 *
 * ⛔ THIS FILE IMPORTS NO STYLESHEET FOR IT. A skin's CSS lives in the skin's own
 * module, imported only by the route that wears it — see BUNDLE above: `main` is
 * a hair under a locked budget, and a theme must never reach the shared chunk.
 */
export type DoorSkin = {
  /** The theme's CSS scope, on the page frame. Replaces the bare door's `bg-cream`. */
  className: string;
  /** Custom properties the theme reads — the couple's colour, their photo. */
  style?: React.CSSProperties;
  /** Painted full-bleed behind the page: the couple's photo, a lattice, a veil. */
  ground?: React.ReactNode;
  /** Set on the card's top edge — the couple's seal. */
  crest?: React.ReactNode;
  /**
   * Under the header: the hinge between the invitation (above) and the door
   * (below). When a skin brings one, the rail moves BELOW it, so a progress rail
   * never sits on the printed invitation itself.
   */
  hinge?: React.ReactNode;
  /**
   * ⚖ THE ONE EXCEPTION TO "A SKIN NEVER OWNS THE ACTION" — and it is the
   * OWNER'S, not a drift (Q2 = A, 2026-09-11, DECISION_LOG "the seven
   * invite-theme questions"): on a PRO invite theme the single button takes the
   * couple's own `events.site_button_color`. House — and every other door in the
   * app — keeps #C24E25.
   *
   * 🔑 IT DOES NOT COME FROM A THEME FILE. `app/[slug]/invite/_lib/
   * load-invite-look.ts` resolves it ONCE, for all four Pro themes at once, so
   * the button is the couple's colour the moment a skin ships rather than a line
   * each skin has to remember — and so no theme can quietly paint a different
   * one. Nothing in `app/[slug]/invite/_components/themes/` touches it, which is
   * what keeps `themes-stay-skins.test.ts`'s "a skin never restyles the card's
   * controls" true of the theme stylesheets it guards.
   *
   * The PAIR is deliberate: `lib/invite-button-color.ts` chooses the fill and
   * the label TOGETHER, because a fill whose label nobody can read is worse than
   * the house colour. Never take one half of it into a style without the other.
   */
  action?: { background: string; label: string };
};

export type DoorShellProps = {
  /** Small mono line above the title — the doorway's name. */
  eyebrow?: React.ReactNode;
  /** The one sentence a stranger reads first. */
  title: React.ReactNode;
  /** One supporting sentence. Two is a paragraph, and a door is not a page. */
  sub?: React.ReactNode;
  /**
   * A quiet mono line UNDER the header — a date, a venue, a member count. Facts
   * that qualify the title without competing with it.
   */
  meta?: React.ReactNode;
  tone?: DoorTone;
  /**
   * Named beads, per binding archetype 02 (Wizard): "progress is earned, never
   * percentaged — the beads carry the names of decisions". Omit for a
   * single-screen door; a rail of one bead is noise.
   */
  steps?: DoorStep[];
  /** Wider card for doors that carry a real form (signup-shaped, not notice-shaped). */
  width?: 'md' | 'lg';
  /** A theme skin (the invite link only). Omit and the door is the bare door. */
  skin?: DoorSkin;
  children?: React.ReactNode;
};

const WIDTH: Record<'md' | 'lg', string> = {
  md: 'max-w-md',
  lg: 'max-w-xl',
};

export function DoorShell({
  eyebrow,
  title,
  sub,
  meta,
  tone = 'threshold',
  steps,
  width = 'md',
  skin,
  children,
}: DoorShellProps) {
  const threshold = tone === 'threshold';
  const rail = steps && steps.length > 1 ? <StepRail steps={steps} /> : null;

  /*
    THE COUPLE'S BUTTON COLOUR — carried as two custom properties and read by
    ONE rule in globals.css (`[data-door-action] .button-primary`), scoped to
    this frame. Three reasons it is done this way and not another:

      · NO NEW STYLESHEET. `main` sits a hair under a locked 200 KB and a
        separate .css file is another module in the shared chunk — the same
        constraint the header note above records. globals.css is already on
        every page, and one more rule in it adds no module. The precedent is
        `.app-surface .button-primary`, which re-points the same class for the
        dashboards.
      · IT REACHES THE BUTTON WITHOUT NAMING IT. The action lives inside
        `children` — `JoinFlow`'s Continue, the Reply card's Save, Enter's "Open
        your invitation" — so the shell cannot pass it a prop without every door
        threading one. A scoped rule colours whichever primary the door renders,
        and colours nothing on any door that brings no `action`.
      · IT CANNOT LEAK. The attribute is set only when a skin carries an
        `action`, which only `loadInviteLook` does, only for a Pro theme. Every
        other door — and the Event Hub's own copy of that same RSVP card — is
        outside the scope and renders byte-identically.
  */
  const actionVars = skin?.action
    ? ({
        ['--door-action' as string]: skin.action.background,
        ['--door-action-label' as string]: skin.action.label,
      } as React.CSSProperties)
    : null;

  return (
    <main
      className={[
        'relative isolate flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:px-6',
        skin ? skin.className : 'bg-cream',
      ].join(' ')}
      style={actionVars ? { ...skin?.style, ...actionVars } : skin?.style}
      data-door-action={skin?.action ? '' : undefined}
    >
      {skin?.ground ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {skin.ground}
        </div>
      ) : null}
      <div className={`relative w-full ${WIDTH[width]}`}>
        {/*
          The way out. A door is often the first Setnayan page a person ever
          opens, and on a dead link it is the ONLY thing they can still do — so
          it sits outside the card, above it, and is never conditional.
        */}
        <Link
          href="/"
          aria-label="Setnayan home"
          className="mb-5 inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mulberry focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        >
          <Wordmark size={24} />
        </Link>

        <div
          className={[
            'relative rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm sm:p-8',
            // Only what you can ACT on carries the action colour — the card
            // itself stays paper, exactly as the sign-in panel's own note says
            // ("repainting the whole surface would read as a different
            // product").
            'border-t-[3px]',
            threshold ? 'border-t-mulberry' : 'border-t-ink/20',
          ].join(' ')}
        >
          {skin?.crest ? <div aria-hidden>{skin.crest}</div> : null}
          {skin?.hinge ? null : rail}

          <header className="space-y-2">
            {eyebrow ? (
              <p
                className={[
                  'inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]',
                  // 4.61:1 on cream. NEVER text-terracotta here — see the
                  // header note; that slot is the 3.37:1 gold.
                  threshold ? 'text-mulberry' : 'text-ink/55',
                ].join(' ')}
              >
                {eyebrow}
              </p>
            ) : null}

            <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {title}
            </h1>

            {sub ? <p className="text-sm leading-relaxed text-ink/70">{sub}</p> : null}

            {meta ? (
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink/55">
                {meta}
              </p>
            ) : null}
          </header>

          {skin?.hinge ? (
            <>
              <div aria-hidden>{skin.hinge}</div>
              {rail ? <div className="mt-6">{rail}</div> : null}
            </>
          ) : null}

          {children ? <div className="mt-6 space-y-4">{children}</div> : null}
        </div>
      </div>
    </main>
  );
}

/**
 * The named-bead rail from archetype 02.
 *
 * Beads carry DECISION NAMES, not numbers, and the rail is hidden from screen
 * readers in favour of one plain sentence — "Step 2 of 3 · Password" — because
 * a row of eleven disconnected labels is what a bead rail sounds like read
 * aloud.
 */
function StepRail({ steps }: { steps: DoorStep[] }) {
  const currentIndex = steps.findIndex((s) => s.current);
  const current = currentIndex >= 0 ? steps[currentIndex] : undefined;

  return (
    <div className="mb-6">
      <p className="sr-only">
        {current
          ? `Step ${currentIndex + 1} of ${steps.length} · ${current.label}`
          : `${steps.length} steps`}
      </p>
      <ol aria-hidden className="flex items-center gap-2">
        {steps.map((step, i) => {
          const reached = step.done || step.current;
          return (
            <li key={`${step.label}-${i}`} className="flex flex-1 items-center gap-2">
              <span className="flex flex-1 flex-col gap-1.5">
                <span
                  className={[
                    'h-[3px] w-full rounded-full',
                    reached ? 'bg-mulberry' : 'bg-ink/12',
                  ].join(' ')}
                />
                <span
                  className={[
                    'font-mono text-[9px] uppercase tracking-[0.16em]',
                    step.current ? 'text-mulberry' : 'text-ink/45',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The action row. One primary, at most one secondary — a door with three
 * choices is a menu, and nobody arriving from a printed QR came to choose.
 *
 * Stacks on a phone (thumb reach, full-width targets) and sits side by side
 * from `sm`, which is what every current door already did by hand.
 */
export function DoorActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:[&>*]:flex-1">{children}</div>;
}

/**
 * A door's notice — the error / caveat block, in the one shape all ten doors
 * were spelling differently.
 *
 * `alert` gets `role="alert"` because it reports something that just went
 * wrong; `note` is ambient context that was always true and must NOT interrupt
 * a screen reader mid-form.
 */
export function DoorNotice({
  kind = 'note',
  children,
}: {
  kind?: 'alert' | 'note';
  children: React.ReactNode;
}) {
  const alert = kind === 'alert';
  return (
    <p
      {...(alert ? { role: 'alert' as const } : { role: 'status' as const })}
      className={[
        'rounded-md border px-4 py-2.5 text-sm',
        // 🎨 `mulberry-600`, NOT `mulberry-700`, and the difference is dark
        // mode. Measured on the composited tint (#C24E25 @7% over the surface)
        // in BOTH themes: 700 reads 5.86:1 light but **3.05:1 dark** — because
        // in dark mode the 700 slot flips to the LIGHT theme's #C24E25, a dark
        // orange on a dark panel. 600 measures 4.92:1 light / 5.78:1 dark.
        // A light-mode-only contrast check would have passed this.
        alert
          ? 'border-mulberry/30 bg-mulberry/[0.07] text-mulberry-600'
          : 'border-ink/10 bg-ink/[0.03] text-ink/70',
      ].join(' ')}
    >
      {children}
    </p>
  );
}
