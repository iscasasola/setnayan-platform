import { OAuthButtons } from "./oauth-buttons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-page-bg p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center font-serif text-5xl font-medium text-ink">
          Tayo
        </h1>
        <p className="mb-8 text-center font-sans text-sm text-ink-soft">
          Sign in to plan your wedding
        </p>

        <OAuthButtons />

        {params.error && (
          <p
            className="mt-4 rounded-md bg-rsvp-declined-soft px-4 py-3 font-sans text-sm text-rsvp-declined-ink"
            role="alert"
          >
            {params.error}
          </p>
        )}

        <p className="meta-label mt-8 text-center">
          By continuing you agree to Tayo's Terms &amp; Privacy
        </p>
      </div>
    </main>
  );
}
