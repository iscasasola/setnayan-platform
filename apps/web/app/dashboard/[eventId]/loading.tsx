/**
 * Renders while any child route of /dashboard/[eventId] is loading.
 * Shows the same layout shape as the page beneath it so navigation feels
 * instantaneous instead of blank.
 */
export default function EventSectionLoading() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-ink/[0.07]" />
        <div className="h-4 w-3/4 max-w-md animate-pulse rounded bg-ink/[0.05]" />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="h-20 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
          />
        ))}
      </ul>
      <div className="h-32 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]" />
      <ul className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="h-14 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
          />
        ))}
      </ul>
    </section>
  );
}
