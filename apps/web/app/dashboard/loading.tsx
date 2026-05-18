/**
 * Renders while any /dashboard/* page is loading server-side. Sibling to
 * [eventId]/loading.tsx — that one handles event-scoped pages; this one
 * handles the dashboard root + non-event surfaces (/dashboard,
 * /dashboard/profile, /dashboard/notifications, /dashboard/create-event,
 * /dashboard/api-keys). Without it, top-nav clicks held a blank screen
 * until the server render finished.
 */
export default function DashboardLoading() {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-ink/[0.05]" />
        <div className="h-9 w-64 animate-pulse rounded bg-ink/[0.07]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-ink/[0.05]" />
      </header>
      <ul className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="h-24 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
          />
        ))}
      </ul>
    </section>
  );
}
