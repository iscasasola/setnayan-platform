import { sendMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-aubergine-50 p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center font-serif text-5xl font-medium text-aubergine-700">
          Tayo
        </h1>
        <p className="mb-8 text-center font-sans text-sm text-aubergine-800/70">
          Sign in to plan your wedding
        </p>

        <form action={sendMagicLink} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-sans text-xs uppercase tracking-widest text-aubergine-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-aubergine-200 bg-white px-4 py-3 font-sans text-base text-aubergine-900 placeholder:text-aubergine-400 focus:border-aubergine-500 focus:outline-none focus:ring-2 focus:ring-aubergine-300"
            />
          </div>

          {params.message && (
            <p className="rounded-md bg-aubergine-100 px-4 py-3 font-sans text-sm text-aubergine-800">
              {params.message}
            </p>
          )}
          {params.error && (
            <p className="rounded-md bg-red-100 px-4 py-3 font-sans text-sm text-red-800">
              {params.error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-aubergine-700 px-4 py-3 font-sans text-base font-medium text-white transition hover:bg-aubergine-800 focus:outline-none focus:ring-2 focus:ring-aubergine-500 focus:ring-offset-2"
          >
            Send magic link
          </button>
        </form>

        <p className="mt-8 text-center font-sans text-xs uppercase tracking-widest text-aubergine-600/60">
          No password needed · 1-click email sign-in
        </p>
      </div>
    </main>
  );
}
