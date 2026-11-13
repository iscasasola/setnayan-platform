import { NotFoundLinks } from './not-found-links';

// Root 404 — brand-voice per feedback_setnayan_no_dev_text_post_launch lock.
// Next.js auto-routes any unmatched URL here. Implicit entry point via routing.
// Copy is luxurious-Filipino-modern register (Aesop / Aman / Soho House) —
// no exclamation marks, no engineering jargon, no "Oops!" style placeholders.
// Two recovery CTAs: home (always works) and Browse vendors (the highest-
// signal next surface for pilot couples + curious visitors).

export const metadata = {
  title: 'Page not found',
  description: "This page doesn't exist on Setnayan.",
};

export default function NotFound() {
  return (
    // data-dead-end: the browser observer (lib/telemetry/fault-observer.ts)
    // records an in-app tap that lands here, with the page it came from.
    <main data-dead-end="not-found" className="min-h-screen bg-page text-ink flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/40 mb-6">
          Setnayan
        </p>
        <h1 className="font-display italic text-4xl sm:text-5xl leading-tight text-ink mb-6">
          This page doesn&rsquo;t exist on Setnayan.
        </h1>
        <p className="font-sans text-base sm:text-lg text-ink/70 leading-relaxed mb-10 max-w-md mx-auto">
          It may have moved, or never been here. Either way, let&rsquo;s get you
          somewhere useful.
        </p>
        {/* ⚡ A client island, not server <Link>s: see not-found-links.tsx for the ~200KB this saves every page. */}
        <NotFoundLinks />
      </div>
    </main>
  );
}
