import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-start justify-center gap-10 px-6 py-16 sm:px-8 lg:px-12">
      <header className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Sprint 0 · Platform foundation
        </p>
        <h1 className="font-sans text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
          Setnayan
        </h1>
        <p className="max-w-prose text-lg text-ink/70 sm:text-xl">
          Set na &lsquo;yan. The Philippines-first life-events platform. V1 weddings.
        </p>
      </header>

      <section className="flex flex-col gap-3 sm:flex-row">
        {user ? (
          <>
            <span className="rounded-md border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/70">
              Signed in as <span className="font-mono">{user.email}</span>
            </span>
            <form action="/auth/sign-out" method="post">
              <button className="button-secondary" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link className="button-primary" href="/login">
              Sign in
            </Link>
            <Link className="button-secondary" href="/signup">
              Create account
            </Link>
          </>
        )}
      </section>

      <footer className="mt-auto w-full border-t border-ink/10 pt-6 text-sm text-ink/50">
        <p>Setnayan · setnayan.com</p>
      </footer>
    </main>
  );
}
