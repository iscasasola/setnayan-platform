import Link from 'next/link';

// Bare-root 404 — the slug resolved to NOTHING the dispatcher could serve.
//
// ⚠ THIS PAGE SERVES TWO AUDIENCES, NOT ONE. app/[slug]/page.tsx tries the
// event first and then falls through to renderVendorBySlug (line ~219), so
// this same not-found renders for BOTH a dead invitation link and a vendor
// shop address that isn't approved yet — and a hidden shop is the resting
// state for every unapproved vendor (owner ruling 2026-07-27, see
// lib/vendor-visibility.ts). It used to say "This invitation link can't be
// found" and tell the visitor to ask "the host": the owner opened their own
// shop address, www.setnayan.com/setnaprod, and was handed a wedding guest's
// error message. Correct 404, wrong audience — it reads as a broken product
// rather than a shop that simply hasn't gone live. Do not narrow this copy
// back to invitations while the vendor fall-through lands here.
//
// Recovery paths, in the order a real visitor needs them: (a) a guest with a
// mistyped/expired link who should ask whoever sent it, (b) someone handed a
// shop address before that shop was approved, (c) the host or vendor
// themselves, who should sign in.
//
// Per feedback_setnayan_no_dev_text_post_launch: brand-voice on every visible
// surface. This page is reachable by guests at the venue scanning a printed
// QR code — copy must be calm and route-forward, never "ERROR 404".

export const metadata = {
  title: 'Link not found',
  description: "This Setnayan link can't be found.",
};

export default function SlugNotFound() {
  return (
    <main className="min-h-screen bg-cream text-ink flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/40 mb-6">
          Setnayan
        </p>
        <h1 className="font-display italic text-4xl sm:text-5xl leading-tight text-ink mb-6">
          This link can&rsquo;t be found.
        </h1>
        <p className="font-sans text-base sm:text-lg text-ink/70 leading-relaxed mb-10 max-w-md mx-auto">
          If someone sent you an invitation, check the link with them &mdash; it
          may have changed. If you&rsquo;re looking for a business, their page
          may not be open to the public yet. And if the page is yours, sign in
          below.
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
