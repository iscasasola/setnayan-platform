import Link from 'next/link';

// Day-of guest 404 — invitation slug couldn't be resolved (event missing,
// archived, wrong slug, or non-wedding event_type). Different recovery path
// from the root 404: the visitor is most likely either (a) a guest with a
// mistyped/expired link who needs to ask the host, or (b) a host whose own
// event slug changed who should sign in.
//
// Per feedback_setnayan_no_dev_text_post_launch: brand-voice on every visible
// surface. This page is reachable by guests at the venue scanning a printed
// QR code — copy must be calm and route-forward, never "ERROR 404".

export const metadata = {
  title: 'Invitation not found',
  description: "This invitation link can't be found.",
};

export default function SlugNotFound() {
  return (
    <main className="min-h-screen bg-cream text-ink flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/40 mb-6">
          Setnayan
        </p>
        <h1 className="font-display italic text-4xl sm:text-5xl leading-tight text-ink mb-6">
          This invitation link can&rsquo;t be found.
        </h1>
        <p className="font-sans text-base sm:text-lg text-ink/70 leading-relaxed mb-10 max-w-md mx-auto">
          Double-check the link with the host, or if you&rsquo;re the host, sign
          in to your dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 bg-mulberry text-cream font-sans text-sm font-medium tracking-wide hover:bg-mulberry-600 transition-colors rounded-sm"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-ink/20 text-ink font-sans text-sm font-medium tracking-wide hover:bg-ink/5 transition-colors rounded-sm"
          >
            Take me home
          </Link>
        </div>
      </div>
    </main>
  );
}
