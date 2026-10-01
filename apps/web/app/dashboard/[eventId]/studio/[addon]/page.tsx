import { notFound, redirect } from 'next/navigation';

/**
 * /dashboard/[eventId]/studio/[addon] — a REDIRECTOR, nothing else.
 *
 * ─── WHAT IT USED TO RENDER (removed 2026-09-30) ──────────────────────────
 * An "iteration placeholder" card per add-on whose blurbs were developer notes
 * shown to couples: "Cloudflare Stream Live SFU → YouTube RTMP relay",
 * "Same FFmpeg pipeline backbone…", "Cart · checkout · BDO + GCash QR ·
 * screenshot upload · admin reconciliation (24-hr SLA)". Every key but one was
 * already SHADOWED by its own literal folder (`studio/panood`, `studio/papic`,
 * `studio/patiktok`, `studio/photo-delivery`, `studio/mood-board`), so those
 * cards could never render; the one that could (`orders`) showed a spec note
 * where the couple's orders should be. A placeholder is not a page — every
 * key now lands on its real home, and an unknown key is a 404 as before.
 *
 * Keep in sync with the same-key branches in `addOnHref()`
 * (lib/add-ons-catalog.ts). Owner 2026-06-21: every Studio button must land
 * somewhere usable — open the service, or its paywall.
 */
const SHIPPED_REDIRECTS: { readonly [addon: string]: string } = {
  'monogram-creator': 'monogram', // Monogram Maker (iteration 0037) is live
  'landing-page': 'website', // → the wedding-website hub
  'music-creator': 'studio/pakanta', // → Pakanta (the realized music feature)
  orders: 'orders', // → the couple's real orders list
  /* Paprint (iteration 0018) — RETIRED as a page 2026-09-30. It was a cart over
     mock products whose checkout was permanently disabled, reachable from no
     link at all, and it called itself both "Paprint" and "Setnayan Supplies".
     Its catalogue entry stays (`status: 'coming_soon'`, `studioGroup:
     'utility'`, so no card shows it) and `lib/supplies/` keeps the pricing
     substrate for when it is real. An old bookmark lands on Our Services. */
  'supplies-marketplace': 'studio',
};

type Props = {
  params: Promise<{ eventId: string; addon: string }>;
};

export default async function AddOnDetailPage({ params }: Props) {
  const { eventId, addon } = await params;
  // The three website-part keys live in the full-screen editor (a top-level
  // route OUTSIDE /dashboard), so they can't be expressed via SHIPPED_REDIRECTS
  // (which prefixes /dashboard/[eventId]/). Mirror addOnHref()'s same-key branch
  // so a direct hit / old bookmark to /studio/<phase> lands in the editor.
  if (addon === 'rsvp' || addon === 'event' || addon === 'editorial') {
    redirect(`/dashboard/${eventId}/website/editor`);
  }
  const shipped = SHIPPED_REDIRECTS[addon];
  if (shipped) redirect(`/dashboard/${eventId}/${shipped}`);
  notFound();
}
