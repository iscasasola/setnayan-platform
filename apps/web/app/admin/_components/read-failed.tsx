/**
 * "Couldn't read this" — the one sentence an admin section prints when its
 * read was refused, in the place the empty state would have been.
 *
 * 🔑 Supabase RESOLVES with `{ error }` instead of throwing, so a refused read
 * arrives as `data: null` and `?? []` turns it into "none". A page that then
 * says "No orders placed." over a paying customer has stated what it did not
 * measure. This line says the true thing instead — we do not know — and the
 * refusal's own words go to the log (`logQueryError`), never to the person.
 *
 * A server component with no client code, so it costs the shared bundle nothing.
 */
export function ReadFailed({ what }: { what: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink"
    >
      Couldn&rsquo;t read {what} &mdash; that is not the same as none. Refresh to try again.
    </p>
  );
}
