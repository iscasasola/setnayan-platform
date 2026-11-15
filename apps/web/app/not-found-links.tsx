'use client';

/**
 * The root 404's two ways out, as a CLIENT island — and the reason is speed, not the links.
 *
 * ⚡ THE ROOT not-found IS IN EVERY PAGE'S PAYLOAD. Next embeds the root `not-found.tsx` element in the RSC payload
 * of every route under the root layout (it is the root not-found boundary), and every `<Link>` a SERVER component
 * renders there is written as a client reference to `next/link` WITH A CHUNK LIST. Next 15.5 builds that list per
 * route by merging the root group's manifests with `Object.assign` (`flight-manifest-plugin.js` `mergeManifest`), so
 * the root group's LAST recorder wins — and that was `app/page`, the front door. Measured 2026-11-13 on a production
 * build: `/login` downloaded `app/page-*.js` and all seventeen of the front door's chunks (~200KB of script it never
 * runs), which held its Lighthouse mobile LCP near 6 s.
 *
 * Here, `next/link` is imported client → client, so it is not a client reference of its own: the only reference the
 * payload carries is this file, recorded by the not-found entry alone with the not-found's own (small) chunk list.
 * 🛡 Held by `app/the-root-404-pulls-in-no-page.test.ts`. Same markup, same classes, same hrefs as before.
 */
import Link from 'next/link';

export function NotFoundLinks() {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-center">
      <Link
        href="/"
        className="inline-flex items-center justify-center px-6 py-3 bg-mulberry text-cream font-sans text-sm font-medium tracking-wide hover:bg-mulberry-600 transition-colors rounded-sm"
      >
        Take me home
      </Link>
      <Link
        href="/?browse=1"
        className="inline-flex items-center justify-center px-6 py-3 border border-ink/20 text-ink font-sans text-sm font-medium tracking-wide hover:bg-ink/5 transition-colors rounded-sm"
      >
        Browse suppliers
      </Link>
    </div>
  );
}
