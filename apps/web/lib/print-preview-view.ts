/**
 * print-preview-view.ts — the pure decision behind `<PrintPreview>`
 * (`app/dashboard/[eventId]/launch/_components/print-preview.tsx`).
 *
 * WHY THIS IS ITS OWN FILE. The component is a client component (the image
 * needs `onLoad`/`onError`), and this repo's unit suite (`tsx --test`) has no
 * DOM — there is no jsdom/happy-dom dependency, so a test cannot fire a real
 * `error` event on an `<img>` and watch `useState` react to it. Pulling the
 * three-state → copy mapping out into a pure function means the loading
 * state and the error state are still provable WITHOUT a DOM: this is what
 * `print-preview-view.test.ts` mounts.
 *
 * Contract: no state, no side effects, no imports from React. The component
 * calls this once per render and paints exactly what it returns.
 */
export type PrintPreviewStatus = 'loading' | 'loaded' | 'error';

/**
 * ⚡ HOW A PREVIEW ASKS (owner 2026-09-28: the boarding-pass preview took
 * ~8 s — every piece asked the server at once, at the same priority). The
 * first piece asks eagerly and HIGH; every other one is the browser's own lazy
 * load at LOW priority, so the one the couple is looking at is served first.
 *
 * 🔴 NOT A SCRIPT-HELD QUEUE — MEASURED. A first cut held the other pieces
 * back in JavaScript until the first had drawn. On the local harness it made
 * the cached case SLOWER (a size pick: pass on screen 1.9 s → 2.4 s desktop,
 * 1.5 s → 3.3 s at 390 px) with ZERO server requests, because a held image
 * cannot start until the page has hydrated, while a plain `<img>` in the HTML
 * paints straight from the cache. The browser's own priority does the ordering.
 */
export type PrintPreviewLoad = {
  loading: 'eager' | 'lazy';
  fetchPriority: 'high' | 'low';
};

export function printPreviewLoad(priority: boolean): PrintPreviewLoad {
  return priority ? { loading: 'eager', fetchPriority: 'high' } : { loading: 'lazy', fetchPriority: 'low' };
}

export type PrintPreviewView = {
  /** The real `<img>` stays mounted (so `onLoad`/`onError` keep firing) even
   *  while hidden — only its opacity changes. `showImage` is `true` unless
   *  the piece failed to draw, when the grey box gives way to the error line
   *  entirely rather than sitting behind it doing nothing. */
  showImage: boolean;
  /** The image is visible (opacity-100) only once it has actually loaded. */
  imageVisible: boolean;
  showShimmer: boolean;
  /** "Drawing your <piece>…", or null once loaded/errored. */
  loadingLabel: string | null;
  /** The honest line + Retry, or null while loading/loaded. */
  errorLabel: string | null;
};

/**
 * The one place the three states become copy and flags — never a silent grey
 * box (`status === 'error'` always returns a non-null `errorLabel`), and
 * never a loading label that outlives the load (`status === 'loaded'` returns
 * null for both `loadingLabel` and `errorLabel`).
 */
export function printPreviewView(status: PrintPreviewStatus, label: string): PrintPreviewView {
  if (status === 'error') {
    return {
      showImage: false,
      imageVisible: false,
      showShimmer: false,
      loadingLabel: null,
      errorLabel: `We couldn’t draw your ${label}. Nothing is wrong with your event — please try again.`,
    };
  }
  if (status === 'loaded') {
    return {
      showImage: true,
      imageVisible: true,
      showShimmer: false,
      loadingLabel: null,
      errorLabel: null,
    };
  }
  return {
    showImage: true,
    imageVisible: false,
    showShimmer: true,
    loadingLabel: `Drawing your ${label}…`,
    errorLabel: null,
  };
}
