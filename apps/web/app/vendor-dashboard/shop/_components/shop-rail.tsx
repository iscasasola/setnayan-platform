import Link from 'next/link';

/**
 * shop-rail.tsx — "On this page": the six doors of My Shop.
 *
 * ─── WHAT THIS IS ──────────────────────────────────────────────────────────
 * The drawing `prototypes/shop_page_2026-09-10.html`, approved by the owner
 * 2026-09-14 (_"doors 1-3 ok"_, DECISION_LOG). Its own words for the rail:
 * *"One page. Pressing a door opens it and scrolls to it — nothing leaves this
 * page."* Six doors, each answering the question a shop owner actually arrives
 * with — "where do I fix my bank details" — rather than naming a subsystem.
 *
 * ⚠ THE RAIL IS A MAP, NOT A ROUTER. It moves nothing and gates nothing. Every
 * control keeps the home it has today; the rail only says which of the six
 * rooms it is in. G1 builds the rail plus door 1; doors 2–6 point at where
 * their content already lives, and are filled in by G2/G3 — which the owner has
 * NOT yet ruled on (doors 4–6 are unseen), so nothing here may assume them.
 *
 * ─── PLAIN ANCHORS, ON PURPOSE ─────────────────────────────────────────────
 * 🔑 No client component, no scroll handler, no JavaScript. `#d1` is a real
 * fragment link: it works before hydration, with JS disabled, from a bookmark,
 * and when a middle-click opens it in a new tab. A scroll handler would replace
 * all of that with something that only works once React has loaded, on a page
 * whose whole job is that a shop owner can find one setting quickly.
 *
 * The one thing a handler buys is smooth scrolling, and CSS already does that
 * (`scroll-mt` on the door shells keeps a heading clear of the sticky header).
 */

/** One door. `href` is a fragment on THIS page — never a route. */
export type ShopDoor = {
  /** `d1`…`d6` — the anchor id the door shell carries. */
  readonly key: string;
  /** The door's name, as drawn. */
  readonly title: string;
  /** The question a shop owner arrives with, in their words — from the drawing. */
  readonly question: string;
  /**
   * Where this door's content lives TODAY. Door 1 is built; the rest point at
   * their existing homes so the rail never advertises a room that is not there.
   */
  readonly href: string;
  /** Built out as a door shell (G1 = door 1 only). */
  readonly built: boolean;
};

/**
 * The six doors, verbatim from the drawing's `DOORS` array — titles and
 * questions both. Kept in one exported constant so the guard can assert the
 * rail against the drawing rather than against a copy of itself.
 *
 * ⛔ DO NOT RE-WORD THESE. They are the owner's approved drawing, and the
 * questions are deliberately in a shop owner's voice ("This is where I upload
 * my Bank and GCash"), not ours.
 */
export const SHOP_DOORS: readonly ShopDoor[] = [
  {
    key: 'd1',
    title: 'Your shop',
    question: 'Shop information, verification, branches and team',
    href: '#d1',
    built: true,
  },
  {
    key: 'd2',
    title: 'Your website',
    question: 'Edit the website couples see',
    // Today the website editor is a panel INSIDE the manage tiles, so that is
    // where this door honestly points until G2 gives it a room of its own.
    href: '#manage-shop',
    built: false,
  },
  {
    key: 'd3',
    title: 'What you sell',
    question: 'Coverage, service cards and packages',
    href: '#packages',
    built: false,
  },
  {
    key: 'd4',
    title: 'Auto-reply',
    question: 'The assistant that answers for you',
    href: '#auto-reply',
    built: false,
  },
  {
    key: 'd5',
    title: 'Getting paid',
    question: 'Bank, GCash and your earnings',
    href: '#earnings',
    built: false,
  },
  {
    key: 'd6',
    title: 'Other tools',
    question: 'Crew gigs and the rest of your tools',
    href: '#shop-folds',
    built: false,
  },
] as const;

/**
 * The door shell — one room on the page.
 *
 * `scroll-mt-24` is what makes the fragment link land with the heading visible
 * instead of tucked under the sticky header; it is the CSS half of "pressing a
 * door scrolls to it".
 */
export function ShopDoorSection({
  id,
  title,
  question,
  children,
}: {
  id: string;
  title: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24 space-y-4">
      <header className="space-y-1 border-b border-ink/10 pb-3">
        <h2 id={`${id}-heading`} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink/60">{question}</p>
      </header>
      {children}
    </section>
  );
}

/**
 * "On this page" — the rail itself.
 *
 * Renders as an ordinary list of links so a screen reader announces it as
 * navigation with six items, in order, each with its number read as part of the
 * link text rather than as decoration beside it.
 */
export function ShopRail() {
  return (
    <nav aria-label="On this page" className="rounded-lg border border-ink/10 bg-cream/60 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
        On this page
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SHOP_DOORS.map((door, i) => (
          <li key={door.key}>
            <Link
              href={door.href}
              className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-700"
            >
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[11px] font-semibold text-ink/70"
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{door.title}</span>
                <span className="block text-xs text-ink/55">{door.question}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-ink/45">
        One page. Pressing a door scrolls to it — nothing leaves this page.
      </p>
    </nav>
  );
}
