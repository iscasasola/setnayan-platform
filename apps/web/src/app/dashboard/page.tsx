import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redundant with middleware, but defensive — protects this RSC if middleware ever misses.
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-aubergine-50 p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12 flex items-center justify-between">
          <h1 className="font-serif text-3xl text-aubergine-700">Tayo Dashboard</h1>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="rounded-md border border-aubergine-300 bg-white px-4 py-2 font-sans text-sm text-aubergine-700 transition hover:bg-aubergine-100"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="rounded-lg border border-aubergine-200 bg-white p-8">
          <p className="mb-2 font-sans text-xs uppercase tracking-widest text-aubergine-600">
            Signed in as
          </p>
          <p className="font-serif text-2xl text-aubergine-800">{user.email}</p>
          <p className="mt-6 font-sans text-sm text-aubergine-700/70">
            Sprint 1 placeholder. Couple signup form, wedding details, and the
            real dashboard shell come next.
          </p>
        </div>
      </div>
    </main>
  );
}
