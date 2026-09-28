import Link from 'next/link';

/**
 * The find-your-seat page's chrome, in the COUPLE'S theme (owner 2026-09-27,
 * prototype `find_your_seat_2026-09-27.html`, "Theme, not chrome").
 *
 * 🎨 NOTHING HERE PAINTS A COLOUR OF ITS OWN. The look is worn once, by
 * `GuestLookScope` in `[slug]/layout.tsx` (theme attribute, palette, faces, and
 * the theme's loop under its scrim); every class below is a token that scope
 * remaps — `ink`, `cream`, `gild`, `--hub-radius`. `<main>` deliberately paints
 * NO paper, so the theme's ground shows through, as it does on the landing page;
 * an event with no theme sits on the body's own paper exactly as before.
 *
 * Server-safe and presentational: no reads, so the harness and the tests can
 * render every state from fixtures.
 */
export function SeatFrame({
  slug,
  who,
  postmark = null,
  roomFooter,
  names,
  footer = true,
  children,
}: {
  slug: string;
  /** "Signed in · Ana" · "For Ana" · the couple's names for a stranger. */
  who: string;
  /** The Vintage theme's postmark date, or null — the ornament is that theme's own. */
  postmark?: string | null;
  /**
   * The rooms strip (`<RoomFooter>`) — mounted by the PAGE and handed in, so the
   * route's own file carries the way out that `room-links.test.ts` looks for.
   */
  roomFooter: React.ReactNode;
  names: string;
  /** The "See you soon" sign-off. Off on the day, where A2 must fit one screen. */
  footer?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-dvh text-ink" data-find-seat>
      {postmark ? <Postmark date={postmark} /> : null}
      <header className="mx-auto flex h-[52px] w-full max-w-5xl items-center justify-between px-3 pt-[env(safe-area-inset-top)] lg:px-9">
        <Link
          href={`/${slug}`}
          aria-label="Back to the invitation"
          className="grid h-10 w-10 place-items-center rounded-full bg-ink text-cream"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Link>
        <span className="text-xs font-extrabold tracking-[0.18em] text-ink">SETNAYAN</span>
        <span className="max-w-[46%] truncate rounded-[var(--hub-radius,0.375rem)] bg-cream/70 px-2.5 py-2 text-[0.6875rem] uppercase tracking-[0.14em] text-terracotta-700">
          {who}
        </span>
      </header>
      <div className="relative mx-auto w-full max-w-md pb-6 lg:max-w-5xl lg:px-16">{children}</div>
      {footer ? (
        <p className="px-6 pb-2 pt-4 text-center text-xs text-ink/70">
          <span aria-hidden className="block font-serif text-2xl italic leading-tight text-terracotta-700">
            See you soon.
          </span>
          {names} · Event Hub by Setnayan
        </p>
      ) : null}
      {roomFooter}
    </main>
  );
}

/**
 * The Vintage theme's postmark (its ornament is `lace-postmark`) — decorative,
 * behind nothing a guest taps. A screen whose head collapses (a search that
 * answered) leaves it out, so it never sits on the field.
 */
export function Postmark({ date, top = 'top-16' }: { date: string; top?: 'top-16' | 'top-3' }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute right-5 ${top} grid h-[78px] w-[78px] rotate-[-12deg] place-items-center rounded-full border-[1.5px] border-gild p-2 text-center text-[0.53rem] uppercase leading-snug tracking-[0.12em] text-terracotta-700 opacity-50 lg:hidden`}
    >
      <span className="absolute inset-[5px] rounded-full border border-dashed border-gild" />
      {date.split(' · ').map((part) => (
        <span key={part} className="block">
          {part}
        </span>
      ))}
    </div>
  );
}

/** The lace hairline with its star — the one ornament every state shares. */
export function Lace({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`relative mx-auto h-3.5 w-[220px] ${className}`}>
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(var(--color-gild)) 1.1px, transparent 1.3px)',
          backgroundSize: '8px 4px',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: '0 50%',
        }}
      />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-cream px-2 text-[0.6875rem] leading-none text-terracotta-700">
        ✦
      </span>
    </div>
  );
}

/**
 * The room before there is a room to show — three unlabelled tables and the
 * door, drawn faintly under a veil. Used when the couple has not published the
 * plan (B5, and a key holder before publication): it draws NOTHING of the
 * couple's real layout, so a draft reveals nothing.
 */
export function RoomPlaceholder({ veil }: { veil: string }) {
  return (
    <div className="relative mx-6 overflow-hidden rounded-[var(--hub-radius,1rem)] border border-ink/25 bg-cream/60">
      <svg viewBox="0 0 342 160" role="img" aria-label={veil} className="block h-auto w-full">
        <rect x="111" y="10" width="120" height="18" rx="2" className="fill-ink/[0.06] stroke-ink/40" strokeDasharray="2 2" />
        {[
          [90, 80],
          [171, 90],
          [252, 80],
        ].map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r={21} className="fill-transparent stroke-ink/35" strokeDasharray="3 3" />
        ))}
        <circle cx="171" cy="142" r="10" className="fill-cream stroke-gild" strokeWidth={1.5} />
      </svg>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[var(--hub-radius,0.375rem)] border border-ink/25 bg-cream/95 px-4 py-2.5 text-[0.8125rem] italic text-ink/75">
        {veil}
      </span>
    </div>
  );
}

/** The dashed "you can do more with your invitation" card — never a second button. */
export function StepUp({ children, slug }: { children: React.ReactNode; slug: string }) {
  return (
    <div className="mx-6 mt-3 flex items-center gap-3 rounded-[var(--hub-radius,0.75rem)] border border-dashed border-ink/45 px-3.5 py-3 text-left text-[0.8125rem] leading-relaxed text-ink/75">
      <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0 text-terracotta-700" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="14" r="4" />
        <path d="m11 11 8-8M16 6l2 2M14 8l2 2" />
      </svg>
      <span>
        {children}{' '}
        <Link href={`/${slug}`} className="whitespace-nowrap text-terracotta-700 underline underline-offset-[3px]">
          Get inside
        </Link>
      </span>
    </div>
  );
}
