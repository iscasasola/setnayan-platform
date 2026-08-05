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
 * Deliberately static: no client JS, no animation beyond a CSS pulse, and it
 * respects `prefers-reduced-motion` — this renders on the worst connection the
 * product ever sees, which is also where a heavy fallback hurts most.
 */

export function InvitationSkeleton({
  displayName,
  monogramText,
}: {
  /** The couple's names, straight off the already-loaded event row. */
  displayName: string | null;
  /** Their monogram letters, if they set any. */
  monogramText: string | null;
}) {
  const initials = (monogramText ?? '').trim();

  return (
    <main
      // Same column as the real page, so the content does not jump sideways
      // when the invitation replaces this.
      className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
      aria-busy="true"
    >
      <div className="flex flex-col items-center text-center">
        {initials ? (
          <p className="font-display text-3xl italic tracking-tight text-terracotta/70">
            {initials}
          </p>
        ) : null}

        {displayName ? (
          <h1 className="mt-3 font-display text-2xl italic leading-tight text-ink sm:text-3xl">
            {displayName}
          </h1>
        ) : null}

        {/* The only moving part, and it is announced rather than implied — a
            guest on a slow connection should be told this is loading, not left
            to infer it from grey boxes. */}
        <p role="status" className="mt-4 text-sm text-ink/55">
          Loading your invitation…
        </p>

        <div className="mt-10 w-full space-y-4 motion-safe:animate-pulse">
          <div className="h-40 w-full rounded-2xl bg-ink/[0.06]" />
          <div className="mx-auto h-3 w-2/3 rounded-full bg-ink/[0.06]" />
          <div className="mx-auto h-3 w-1/2 rounded-full bg-ink/[0.06]" />
          <div className="h-28 w-full rounded-2xl bg-ink/[0.06]" />
        </div>
      </div>
    </main>
  );
}
