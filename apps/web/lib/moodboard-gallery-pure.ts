/**
 * lib/moodboard-gallery-pure.ts — the handful of supplier-gallery constants a
 * CLIENT component is allowed to hold. No imports, at all.
 *
 * 🛑 WHY THIS FILE EXISTS, AND WHY IT MAY NOT GROW. `lib/moodboard-gallery.ts`
 * imports `lib/taxonomy.ts` (a ~1,300-line constant map) and, through
 * `lib/vendor-counts.ts`, reaches `lib/supabase/admin.ts` — a `server-only`
 * module. Its own docblock says so: "everything this module exports is either
 * server-side or a type, and it must stay that way." MB11's upload form is a
 * `'use client'` component and needs exactly two values from that world: the
 * asset-type literal it posts, and the warranty sentence it renders.
 *
 * Importing them from the server modules turned `lint-server-only-boundary`
 * red — correctly. That guard exists because the alternative feedback loop is
 * `next build`, which takes minutes and cannot run on this machine.
 *
 * ⚠ ADD NOTHING HERE THAT NEEDS A LOOKUP. The moment this file imports the
 * taxonomy it becomes the same problem with a different name. The slot list the
 * form renders is DERIVED SERVER-SIDE and passed in as a prop for exactly that
 * reason.
 */

/** `moodboard_library_assets.asset_type` for a supplier's own portfolio photo. */
export const SUPPLIER_GALLERY_ASSET_TYPE = 'supplier_gallery' as const;

/**
 * Which wording the uploader accepted. Written to
 * `moodboard_library_assets.rights_warranty_version` beside the timestamp —
 * MB10's CHECK pairs them, and a timestamp alone cannot say what was agreed to.
 *
 * 🔑 BUMP THIS STRING WHENEVER THE TEXT BELOW CHANGES. An unbumped version on
 * changed wording is worse than no version: it asserts consent to words the
 * uploader never saw.
 */
export const RIGHTS_WARRANTY_VERSION = 'gallery-rights-v1-2026-09-04';

/** The exact sentence the uploader ticks. Rendered verbatim on the form. */
export const RIGHTS_WARRANTY_TEXT =
  'I took this photo or hold the rights to publish it, everyone shown has agreed to it being used, and Setnayan may show it to couples on their mood boards with my shop credited.';
