/** The guest form's head — prototype § 7, "From guests · saw the result". Server-safe markup, shared with the lab. */
export function GuestReviewHeader({ shopName, eventTitle }: { shopName: string; eventTitle: string }) {
  return (
    <header>
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70">From guests · saw the result</p>
      <h1 className="mb-1.5 mt-1 text-[28px] font-semibold leading-[1.15] tracking-tight">
        {shopName} at {eventTitle}
      </h1>
      <p className="mb-3.5 text-[15px] text-ink/70">Just the result — you were there. Public on their card and page.</p>
    </header>
  );
}
