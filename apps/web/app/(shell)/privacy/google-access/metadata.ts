/**
 * metadata.ts — the page's social/canonical card, split out so a plain node
 * test can read the REAL object.
 *
 * 🔑 WHY THE SPLIT. `google-access.test.ts` guards this metadata by importing
 * it and inspecting the resolved values — deliberately, because deriving the
 * required key set from `app/layout.tsx` at runtime is the only version of that
 * guard that cannot drift. On 2026-08-15 `page.tsx` started mounting the shared
 * app shell, which carries `import 'server-only'`. That package is aliased by
 * the Next bundler and is NOT installed in node_modules, so the moment the page
 * pulled it in, the test could no longer resolve its own import and died with
 * MODULE_NOT_FOUND — a guard silenced by a change it has no opinion about.
 *
 * Two bad ways out were rejected: dropping `import 'server-only'` from the
 * shell (that marker is a real boundary), and rewriting the guard to read the
 * metadata out of source text (a regex over an object literal is exactly the
 * "guard matches a string, not the act" failure this repo keeps paying for).
 *
 * So the metadata moved to a module with no runtime dependencies at all. The
 * page still does a literal `export const metadata = …` — Next's static
 * analysis sees the export it expects, not a re-export chain.
 */

const TITLE = 'What connecting Google does · Setnayan';
const DESCRIPTION =
  'Plain-English explanation of the two optional Google connections Setnayan offers: YouTube, to set up the live broadcast of a wedding, and Google Drive, so photos land in a folder the couple owns. Setnayan only ever touches files it created itself.';

/** The shared 1200×630 brand card, same asset the root layout and `/` serve. */
const OG_IMAGE = '/brand/og-card.webp';

export const GOOGLE_ACCESS_METADATA = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Setnayan',
  alternates: { canonical: '/privacy/google-access' },
  // 🚨 `openGraph` and `twitter` are REPLACED wholesale by a child segment, not
  // deep-merged (next/dist/lib/metadata/resolve-metadata.js does
  // `target.openGraph = resolveOpenGraph(source.openGraph, …)` on a plain
  // `case 'openGraph':`). The homepage learned this the hard way on 2026-08-09.
  // So BOTH objects below are stated in full:
  //   • without `images`, this URL would drop the root layout's 1200×630 card
  //     and share as a bare link;
  //   • without a `twitter` object at all, the root layout's twitter card would
  //     survive intact — meaning this legal summary would be shared under the
  //     homepage's MARKETING title and description.
  // 🔑 An override object must be COMPLETE, not a patch. If you add a key to the
  // root layout's openGraph/twitter, add it here too. Guarded by
  // app/privacy/google-access/google-access.test.ts, which derives the required
  // key set from app/layout.tsx rather than from a hand-typed list.
  openGraph: {
    type: 'website',
    siteName: 'Setnayan',
    locale: 'en_PH',
    title: TITLE,
    description: DESCRIPTION,
    url: '/privacy/google-access',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Setnayan · Set na 'yan. · Filipino wedding planning · verified vendors · 0% commission",
        type: 'image/webp',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};
