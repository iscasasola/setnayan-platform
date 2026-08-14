/**
 * demo-overlay-bus.ts — how a public product page opens its live demo.
 *
 * ─── THE DEFECT THIS REPAIRS ─────────────────────────────────────────────
 * The Papic, Live Studio and 3D Plan demos never broke. On 2026-08-13 the
 * cinematic homepage (`HomeReskin.tsx`) was deleted, and it held the ONLY five
 * `setOverlay(...)` call sites in the repo. The overlays, their server actions,
 * their WebRTC transport, their QR minting and their `/{product}/demo/[token]`
 * landing pages all survived — and are STILL MOUNTED on every marketing route
 * through `SiteChrome` → `HomeOverlays`. Nothing could open them.
 *
 * 🔑 THE SIXTH "GATE WITH NO HANDLE", AND THE FIRST CREATED BY A DELETION.
 * The register in `gates-have-handles.test.ts` watches for a COLUMN with no
 * writer; this was a mounted COMPONENT with no opener, which that guard's shape
 * does not catch. Nothing threw, nothing logged, CI was green, and the only
 * symptom was an absence — the same family as the phantom column, the phantom
 * enum value and the blocked iframe. Worse: each demo's dead-end screen still
 * tells the visitor to "open a new one from the Papic tile on the Setnayan
 * homepage" — a tile that no longer exists.
 *
 * ─── WHY A MODULE-LEVEL BUS AND NOT REACT CONTEXT ────────────────────────
 * 🚨 A PROVIDER AT THE ONLY SHARED ANCESTOR IS FORBIDDEN BY A MEASURED
 * CONSTRAINT, not by taste. `<SiteChrome/>` is a SIBLING of `{children}` in
 * `app/layout.tsx`, so context from it cannot reach a page. The only common
 * ancestor is the root layout itself — and that file carries a dated note that
 * a provider mounted at exactly this spot cost **0.6 KB gzipped in the SHARED
 * client chunk**, which `main` already fills to 199.8 KB of its locked 200 KB
 * ceiling. Everything the root layout's client tree touches lands there, for
 * every visitor, including the ones who never open a demo.
 *
 * So the opener is a module: pages import a 12-line function, SiteChrome
 * subscribes, and nothing enters the shared chunk. Same idiom the repo already
 * uses for cross-tree client state without a provider — `anyModalOpen()` in
 * `lib/use-modal-a11y.ts` and `commandKeyClaimed()` in `lib/command-key-claim.ts`.
 *
 * ⚠ NOT the URL (`/papic?demo=1`). `useSearchParams()` in a client component
 * that renders inside the ROOT LAYOUT opts every statically-rendered page into
 * client-side rendering — and eight of the nine doorways are `force-static`
 * with `revalidate=3600`. Trading nine edge caches for a query parameter is the
 * bill this repo has twice paid by accident.
 */

/** The overlay ids that are a live product demo. */
export type DemoOverlayId =
  | 'papic-demo'
  | 'panood-demo'
  | 'plan3d-demo'
  | 'alaala-editorial';

type Listener = (id: DemoOverlayId) => void;

const listeners = new Set<Listener>();

/**
 * Open a demo. Called by a button on the product's own public page.
 *
 * ⚠ RETURNS WHETHER ANYTHING HEARD IT, and the caller is expected to care.
 * A button that fires into an empty listener set is a dead control — precisely
 * the defect this file exists to repair — so `TryTheDemoButton` renders nothing
 * at all until it has confirmed a listener is mounted, rather than rendering a
 * control that silently does nothing on a route where `SiteChrome` returns null.
 */
export function openDemoOverlay(id: DemoOverlayId): boolean {
  if (listeners.size === 0) return false;
  for (const fn of listeners) fn(id);
  return true;
}

/** SiteChrome subscribes for as long as it is mounted. */
export function subscribeDemoOverlay(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** True when something is mounted that can actually show a demo. */
export function demoOverlayAvailable(): boolean {
  return listeners.size > 0;
}
