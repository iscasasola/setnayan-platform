/**
 * 📦 ONE COPY PER LAYOUT — a module a layout already ships is never shipped
 * again by a page beneath it.
 *
 * MEASURED 2026-10-13 (next build of release batch 3, the Maker's 65 first-load
 * chunks parsed into webpack modules): 81 modules shipped TWO TO FOUR TIMES in
 * one cold open of the Maker — lucide's icon base, the loader overlay, the
 * client-type cookie, SubmitButton, the safe-link helpers … — 50.9KB raw that
 * the phone downloaded and parsed more than once. Every copy sat in a
 * DIFFERENT entry's chunks: the root layout, the dashboard layout, the event
 * layout, the two loading files and the Maker page.
 *
 * 🔑 WHY WEBPACK DOES THAT. The app router gives every layout, loading file and
 * page its OWN webpack entry; the browser loads a page's entry together with
 * every layout above it, but webpack does not know that — to webpack they are
 * unrelated entry points. A module two entries share is only pulled into a
 * shared chunk when that set is ≥ 20KB (Next's `splitChunks.minSize`) and the
 * entry is under 25 initial requests (`maxInitialRequests`); everything else is
 * copied into both. So a small module that a layout and a page both import
 * ships twice on every page under that layout.
 *
 * 🔧 THE RULE. For each layout / loading / template file (an ANCHOR — every page
 * below its folder loads it), one split-chunk group: a module that the anchor's
 * own entry contains AND another entry under the same folder contains moves
 * into ONE chunk named for the anchor, loaded by the anchor and by those
 * entries. Outer anchors win (higher priority), so a module in the root layout
 * and the event layout lands in the root layout's chunk.
 *
 * 🛡 WHY NO PAGE CAN GROW. The chunk holds only modules of the anchor's entry,
 * and is only added to entries under the anchor's folder — every one of which
 * loads the anchor, so already downloads every byte in it. Async chunks
 * (`import()`, `next/dynamic`) are not touched, so webpack's runtime — on every
 * page, under the shared-bundle ceiling — gains no entry. `global-error`
 * renders WITHOUT the root layout, so the root group skips it. Measured on every
 * route of the build: see the PR / changelog fragment.
 *
 * Plain module, node built-ins only: next.config.ts loads it.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export type LayoutAnchorKind = 'layout' | 'loading' | 'template';

export type LayoutAnchor = {
  /** The anchor's webpack entry name, e.g. `app/dashboard/[eventId]/layout`. */
  readonly entry: string;
  /** Every entry under this prefix loads the anchor, e.g. `app/dashboard/[eventId]/`. */
  readonly dir: string;
  readonly depth: number;
  readonly kind: LayoutAnchorKind;
};

const ANCHOR_FILE = /^(layout|loading|template)\.(tsx|ts|jsx|js)$/;

/** Every layout / loading / template file under `appDir`, outermost first. */
export function findLayoutAnchors(appDir: string): LayoutAnchor[] {
  const out: LayoutAnchor[] = [];
  const walk = (abs: string, rel: string) => {
    for (const d of readdirSync(abs, { withFileTypes: true })) {
      if (d.isDirectory()) {
        // `_private` folders and `node_modules` are not routes.
        if (d.name.startsWith('_') || d.name === 'node_modules') continue;
        walk(join(abs, d.name), rel ? `${rel}/${d.name}` : d.name);
        continue;
      }
      const m = ANCHOR_FILE.exec(d.name);
      if (!m) continue;
      const dir = rel ? `app/${rel}/` : 'app/';
      out.push({ entry: `${dir}${m[1]}`, dir, depth: rel ? rel.split('/').length : 0, kind: m[1] as LayoutAnchorKind });
    }
  };
  walk(appDir, '');
  return out.sort((a, b) => a.depth - b.depth || a.entry.localeCompare(b.entry));
}

/** The minimal slice of webpack's types the groups touch (no webpack import: next.config.ts loads this). */
type ChunkLike = { name?: string | null };
type ModuleLike = { type?: string };
type GroupContext = { chunkGraph: { getModuleChunksIterable(m: ModuleLike): Iterable<ChunkLike> } };

/** The chunk an anchor's shared modules travel in — a flat, filename-safe name. */
export function anchorChunkName(a: LayoutAnchor): string {
  return `one-copy-${a.entry.replace(/^app\//, '').replace(/[^A-Za-z0-9-]+/g, '_')}`;
}

/** Entry chunks that load the anchor: every entry under its folder (the root skips `global-error`). */
export function underAnchor(a: LayoutAnchor, chunk: ChunkLike): boolean {
  const n = chunk.name;
  if (typeof n !== 'string' || !n.startsWith(a.dir)) return false;
  return !(a.dir === 'app/' && n === 'app/global-error');
}

/** A JS module the anchor's own entry contains. */
export function inAnchor(a: LayoutAnchor, module: ModuleLike, ctx: GroupContext): boolean {
  if (typeof module.type === 'string' && module.type.startsWith('css')) return false;
  for (const c of ctx.chunkGraph.getModuleChunksIterable(module)) if (c.name === a.entry) return true;
  return false;
}

/** Client `splitChunks.cacheGroups` — one group per anchor. */
export function oneCopyPerLayoutGroups(anchors: readonly LayoutAnchor[]): Record<string, object> {
  const groups: Record<string, object> = {};
  for (const a of anchors) {
    const name = anchorChunkName(a);
    groups[name] = {
      name,
      chunks: (chunk: ChunkLike) => underAnchor(a, chunk),
      test: (module: ModuleLike, ctx: GroupContext) => inAnchor(a, module, ctx),
      // Only a module ANOTHER entry under the anchor also ships — the anchor's own modules stay put.
      minChunks: 2,
      // Outer anchors first; a layout before the loading/template of the same folder.
      // Below Next's `framework` (40) and `lib` (30); above webpack's defaults (-10, -20).
      priority: 20 - 2 * a.depth - (a.kind === 'layout' ? 0 : 1),
      // Next's 20KB / 25-request limits are exactly what leaves these copies behind.
      minSize: 0,
      maxInitialRequests: Infinity,
      reuseExistingChunk: false,
    };
  }
  return groups;
}
