/**
 * Server component shown when an authenticated user has no event yet.
 * In V1 the seed migration always creates an event for the founder; this
 * fallback exists for cases where the migration hasn't been applied or the
 * RLS policy filters out all events.
 */

export function NoEventState({ userEmail }: { userEmail: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page-bg p-6">
      <div className="max-w-md rounded-2xl border border-rule bg-surface p-8 shadow-tayo-md">
        <p className="meta-label mb-3">No event yet</p>
        <h1 className="display-title mb-3">Your wedding workspace is empty.</h1>
        <p className="text-sm text-ink-soft">
          We didn't find an event linked to <span className="font-mono">{userEmail}</span>.
          If you just signed in for the first time, ask the development team to
          run the database seed for your account, or paste the canonical seed
          script into the Supabase SQL Editor.
        </p>
        <div className="meta-label mt-6">
          File reference · supabase/seed.sql
        </div>
      </div>
    </main>
  );
}
