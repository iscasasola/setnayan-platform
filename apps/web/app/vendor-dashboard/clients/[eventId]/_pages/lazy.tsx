'use client';

/**
 * ⚡ THE PICKED CLIENT'S PAGES LOAD THEIR OWN CODE ON DEMAND (release blocker, 8 Nov 2026).
 *
 * MEASURED: First Load JS of `/vendor-dashboard/clients/[eventId]` (and the `customers/@client/(..)clients/[eventId]`
 * intercept, which re-exports it) went 312 → 500 kB once `_pages/switch.tsx · pickedPageBodies` built all nine bodies:
 * every client component any body draws was in the route's first load, whichever page was on screen.
 *
 * The DATA still arrives in one go — every body is drawn on the server and a page switch is `history.replaceState`, no
 * request (B1 §8 M5) — only the CODE of a non-Details body's interactive parts moves into its own chunk, loaded by
 * `next/dynamic`:
 *   · the page on screen at first paint is server-rendered as before (`ssr` stays on) and its chunk is preloaded with
 *     the HTML, so it never flashes;
 *   · a page switched to later fetches its chunk once; until it lands, the house's quiet loading line shows (the same
 *     line the Chat · Quotation · Hub bodies show while their reads stream);
 *   · after the first paint has settled, the shell warms every chunk at idle (`warmPickedPages`), so by the time a
 *     supplier taps another page its code is usually already there.
 * Details stays in the first load — nothing here is imported by it.
 *
 * Server components cannot be split this way (their client children are bundled with the route regardless of how the
 * server imports them), so each wrapper sits at the CLIENT boundary: the server body imports the wrapper from here
 * instead of the component itself, with the same props.
 *
 * 🔒 ./the-picked-pages-load-their-code-on-demand.test.ts
 */
import dynamic from 'next/dynamic';

/** The house's quiet loading line — the same words and look the bodies' own <Suspense> fallbacks use. */
function Quiet({ what }: { what: string }) {
  return (
    <p className="px-4 py-6 text-sm text-ink/55" role="status" data-picked-page-loading="">
      Loading {what}&hellip;
    </p>
  );
}

// ── Forms ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const FormsPageBody = dynamic(
  () => import('@/app/vendor-dashboard/forms/_components/forms-page-body').then((m) => m.FormsPageBody),
  { loading: () => <Quiet what="your forms" /> },
);

// ── Files ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const FilesFinder = dynamic(() => import('./files-finder').then((m) => m.FilesFinder), {
  loading: () => <Quiet what="the files" />,
});

// ── Report ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const ReportForm = dynamic(() => import('./report-form').then((m) => m.ReportForm), {
  loading: () => <Quiet what="the report" />,
});

// ── Payment ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const ClientRefunds = dynamic(() => import('../_components/client-refunds').then((m) => m.ClientRefunds), {
  loading: () => <Quiet what="refunds" />,
});

// ── The thumb row a page hands to `SupplierThumbRow` (Payment) — it floats, so it waits quietly (nothing drawn). ─────
export const ThumbRow = dynamic(() => import('@/components/thumb-row').then((m) => m.ThumbRow), {
  loading: () => null,
});

/**
 * Warm every on-demand chunk (no render, no data). Called by the shell once the first paint has settled. The paths are
 * the wrappers' own, so webpack resolves each to the SAME chunk the wrapper loads.
 */
export function warmPickedPages(): void {
  const warm = [
    () => import('@/app/vendor-dashboard/forms/_components/forms-page-body'),
    () => import('./files-finder'),
    () => import('./report-form'),
    () => import('../_components/client-refunds'),
    () => import('@/components/thumb-row'),
  ];
  for (const w of warm) w().catch(() => undefined);
}
