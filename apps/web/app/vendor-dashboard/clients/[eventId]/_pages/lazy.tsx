'use client';

/**
 * ⚡ THE PICKED CLIENT'S PAGES LOAD THEIR OWN CODE ON DEMAND (release blocker, 8 Nov 2026).
 *
 * MEASURED: First Load JS of `/vendor-dashboard/clients/[eventId]` (and the `customers/@client/(..)clients/[eventId]`
 * intercept, which re-exports it) went 312 → 500 kB once `_pages/switch.tsx · pickedPageBodies` built all nine bodies:
 * every client component any body draws was in the route's first load, whichever page was on screen.
 *
 * The DATA still arrives in one go — every body is drawn on the server and a page switch is `history.replaceState`, no
 * request (B1 §8 M5) — only the CODE of a non-Details body's interactive parts moves into its own chunk, loaded by a
 * dynamic `import()` behind `React.lazy` (`onDemand` below):
 *   · the page on screen at first paint is still server-rendered in full (the server resolves the import before the
 *     HTML is final), and the browser keeps that HTML while the chunk arrives — no flash, no empty page;
 *   · a page switched to later fetches its chunk once; until it lands, the house's quiet loading line shows (the same
 *     line the Chat · Quotation · Hub bodies show while their reads stream);
 *   · after the first paint has settled, the shell warms every chunk at idle (`warmPickedPages`), so by the time a
 *     supplier taps another page its code is usually already there.
 * Details stays in the first load — nothing here is imported by it.
 *
 * Why not `next/dynamic`: it is the same `React.lazy` + `<Suspense>` underneath in the App Router, but outside a Next
 * build (the guards that render these bodies with `react-dom`) `next/dynamic` resolves to the Pages-router loader, which
 * never renders anything but the loading line — the guards could no longer see the page they hold.
 *
 * Server components cannot be split this way (their client children are bundled with the route regardless of how the
 * server imports them), so each wrapper sits at the CLIENT boundary: the server body imports the wrapper from here
 * under the component's own name, with the same props.
 *
 * 🔒 ./the-picked-pages-load-their-code-on-demand.test.ts
 */
import { Suspense, lazy, type ComponentType, type ReactNode } from 'react';

/** The house's quiet loading line — the same words and look the bodies' own <Suspense> fallbacks use. */
function Quiet({ what }: { what: string }) {
  return (
    <p className="px-4 py-6 text-sm text-ink/70" role="status" data-picked-page-loading="">
      Loading {what}&hellip;
    </p>
  );
}

/** A component whose code is fetched the first time it renders (its own chunk), drawn with `loading` until then. */
function onDemand<P extends object>(load: () => Promise<ComponentType<P>>, loading: ReactNode) {
  const Lazy = lazy(() => load().then((Component) => ({ default: Component })));
  function OnDemand(props: P) {
    return (
      <Suspense fallback={loading}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  return OnDemand;
}

// ── Forms ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const FormsPageBody = onDemand(
  () => import(/* webpackChunkName: "picked-pages" */ '@/app/vendor-dashboard/forms/_components/forms-page-body').then((m) => m.FormsPageBody),
  <Quiet what="your forms" />,
);

// ── Files ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const FilesFinder = onDemand(() => import(/* webpackChunkName: "picked-pages" */ './files-finder').then((m) => m.FilesFinder), <Quiet what="the files" />);

// 📁 Piece 3b — a supplier's files for this event (Files + the Hub's Event photos).
export const EventFilesBoard = onDemand(
  () => import(/* webpackChunkName: "picked-pages" */ '../_components/event-files-board').then((m) => m.EventFilesBoard),
  <Quiet what="this event’s files" />,
);

// ── Report ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const ReportForm = onDemand(() => import(/* webpackChunkName: "picked-pages" */ './report-form').then((m) => m.ReportForm), <Quiet what="the report" />);

// ── Payment ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const ClientRefunds = onDemand(
  () => import(/* webpackChunkName: "picked-pages" */ '../_components/client-refunds').then((m) => m.ClientRefunds),
  <Quiet what="refunds" />,
);

// ── The thumb row a page hands to `SupplierThumbRow` (Payment) — it floats, so it waits quietly (nothing drawn). ─────
export const ThumbRow = onDemand(() => import(/* webpackChunkName: "picked-pages" */ '@/components/thumb-row').then((m) => m.ThumbRow), null);

/**
 * Warm every on-demand chunk (no render, no data). Called by the shell once the first paint has settled. The paths are
 * the wrappers' own, so webpack resolves each to the SAME chunk the wrapper loads.
 */
export function warmPickedPages(): void {
  const warm = [
    () => import(/* webpackChunkName: "picked-pages" */ '@/app/vendor-dashboard/forms/_components/forms-page-body'),
    () => import(/* webpackChunkName: "picked-pages" */ './files-finder'),
    () => import(/* webpackChunkName: "picked-pages" */ '../_components/event-files-board'),
    () => import(/* webpackChunkName: "picked-pages" */ './report-form'),
    () => import(/* webpackChunkName: "picked-pages" */ '../_components/client-refunds'),
    () => import(/* webpackChunkName: "picked-pages" */ '@/components/thumb-row'),
  ];
  for (const w of warm) w().catch(() => undefined);
}
