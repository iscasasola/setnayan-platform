import Link from 'next/link';

// Global 404 surface. Keep the copy editorial-brand-voice per
// `feedback_setnayan_no_dev_text_post_launch` — terse, polite, no dev jargon
// like "skeleton placeholder" or "not yet wired". Mirrors the canonical
// model: "This vendor still has no review."
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/55">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        This page doesn&rsquo;t exist on Setnayan.
      </h1>
      <p className="mt-4 max-w-prose text-base text-ink/65">
        Double-check the link, or head back to where you were planning from.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-md bg-terracotta px-5 text-sm font-medium text-cream hover:bg-terracotta-600"
        >
          Take me home
        </Link>
        <Link
          href="/help"
          className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-cream px-5 text-sm font-medium text-ink hover:bg-ink/5"
        >
          Get help
        </Link>
      </div>
    </main>
  );
}
