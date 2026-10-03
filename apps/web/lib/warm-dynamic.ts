/**
 * 🔥 WARM A `next/dynamic` PIECE — download its code AND make its first render
 * instant.
 *
 * MEASURED (phone profile, 2026-10-02, `rd/maker-preloads-tools`): fetching a
 * Maker tool's chunk early was not enough. `next/dynamic` draws its piece
 * through `React.lazy`, and a lazy component suspends on its FIRST render even
 * when its module is already on the phone (its promise settles a microtask
 * later). The tap then commits the piece's placeholder, and React holds the
 * real piece back until 300 ms after a placeholder was shown (its Suspense
 * reveal throttle) — so a tool whose code had long arrived still opened in
 * 400–800 ms behind a skeleton.
 *
 * Warming does what that first render would: it starts the piece's own loader
 * (the SAME `import()` the stand-in names, so the same chunk) and, once it has
 * settled, the lazy is resolved — the tap renders the real piece in the same
 * frame, with no placeholder and no throttle.
 *
 * HOW, in one place (and held against the installed React + Next by
 * `warm-dynamic.test.ts`, so an upgrade that changes either shape fails CI
 * rather than quietly making every tap slow again): calling a `next/dynamic`
 * component as a function returns its element tree (it uses no hooks); the lazy
 * element in it carries React's `_init`/`_payload`. `_init` starts the load —
 * exactly what React calls when it renders it.
 *
 * A bare `React.lazy` export (a piece that never renders on the server, like
 * `CoupleLogo`'s player) is warmed the same way, from its own `_init`.
 *
 * ⚠ A FAILED LOAD IS PUT BACK. `React.lazy` remembers a rejection forever, so a
 * background preload that failed (a dropped connection) would make that tool
 * throw when tapped. The lazy is returned to "not started", so the tap asks
 * for it again exactly as it did before preloading existed.
 */

const LAZY = Symbol.for('react.lazy');

type LazyPayload = { _status: number; _result: unknown };
type LazyType = { $$typeof: symbol; _payload: LazyPayload; _init: (p: LazyPayload) => unknown };
type ElementLike = { type?: unknown; props?: { children?: unknown } };

/** Is this a `next/dynamic` component (`LoadableComponent`)? */
export function isDynamicComponent(c: unknown): c is (props: object) => unknown {
  return typeof c === 'function' && (c as { displayName?: string }).displayName === 'LoadableComponent';
}

function findLazy(node: unknown, depth = 0): LazyType | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findLazy(n, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const el = node as ElementLike;
  const t = el.type as { $$typeof?: symbol } | undefined;
  if (t && typeof t === 'object' && t.$$typeof === LAZY) return t as LazyType;
  return findLazy(el.props?.children, depth + 1);
}

/**
 * Warm one `next/dynamic` component. Resolves when its code has arrived;
 * rejects when it failed (the lazy is reset first, so a tap loads it afresh).
 * Anything that is not a dynamic component resolves at once.
 */
/** Is this a bare `React.lazy` component (a stand-in that needs no SSR, e.g. `CoupleLogo`'s player)? */
export function isLazyComponent(c: unknown): c is LazyType {
  return Boolean(c) && typeof c === 'object' && (c as { $$typeof?: symbol }).$$typeof === LAZY;
}

export function warmDynamic(c: unknown): Promise<void> {
  if (isLazyComponent(c)) return warmLazy(c);
  if (!isDynamicComponent(c)) return Promise.resolve();
  let lazy: LazyType | null;
  try {
    lazy = findLazy(c({}));
  } catch {
    return Promise.resolve();
  }
  if (!lazy) return Promise.resolve();
  return warmLazy(lazy);
}

/** Start a lazy's load (React's own `_init`) and resolve once it has settled; a failure is put back. */
function warmLazy(lazy: LazyType): Promise<void> {
  const payload = lazy._payload;
  const ctor = payload._status === -1 ? payload._result : null;
  try {
    lazy._init(payload);
    return Promise.resolve();
  } catch (thrown) {
    if (!thrown || typeof (thrown as { then?: unknown }).then !== 'function') return Promise.resolve();
    return Promise.resolve(thrown as PromiseLike<unknown>).then(
      () => undefined,
      (err: unknown) => {
        // Forget the failure: the next render loads it afresh, as it always did.
        if (ctor && payload._status === 2) {
          payload._status = -1;
          payload._result = ctor;
        }
        throw err;
      },
    );
  }
}

/**
 * Warm every lazy export of a stand-in module — a `next/dynamic` component, or a
 * bare `React.lazy` (one that never renders on the server, so it needs none of
 * `next/dynamic`'s machinery on the page). Resolves when all have arrived;
 * rejects if any failed.
 */
export function warmDynamicExports(ns: Record<string, unknown>): Promise<void> {
  const pieces = Object.values(ns).filter((c) => isDynamicComponent(c) || isLazyComponent(c));
  return Promise.all(pieces.map(warmDynamic)).then(() => undefined);
}
