import Link from 'next/link';

export type JoinShellEvent = {
  display_name: string;
  event_date: string | null;
  venue_name: string | null;
} | null;

/** Shared centered card chrome for every /join step (role, claim, verify, pending). */
export function JoinShell({
  event,
  children,
}: {
  event: JoinShellEvent;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">Setnayan</p>
        {event ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{event.display_name}</h1>
            <p className="text-sm text-ink/60">
              {[event.event_date, event.venue_name].filter(Boolean).join(' · ')}
            </p>
          </>
        ) : (
          <h1 className="text-3xl font-semibold tracking-tight">Event invite</h1>
        )}
      </header>
      {children}
    </main>
  );
}

export function InvalidTokenScreen() {
  return (
    <JoinShell event={null}>
      <h2 className="text-xl font-semibold text-ink">This invite link isn&rsquo;t valid.</h2>
      <p className="mt-2 text-ink/70">
        It might have been revoked or the URL got cut off. Ask the couple for a fresh link.
      </p>
      <div className="mt-6">
        <Link className="button-secondary" href="/">
          Back home
        </Link>
      </div>
    </JoinShell>
  );
}
