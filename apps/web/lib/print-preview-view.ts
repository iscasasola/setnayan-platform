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
