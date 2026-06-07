/**
 * Shared brand "thinking / analyzing" loader.
 *
 * - <SDLoader>            — the visual; inline / section / route-loading use.
 * - LoaderOverlayProvider — app-wide blocking overlay (mounted in providers).
 * - useLoader()           — show/complete/hide the overlay from any client.
 * - LOADER_STEPS          — per-context narration copy (edit there).
 */
export { SDLoader, type SDLoaderProps } from './sd-loader';
export { LoaderOverlayProvider, useLoader } from './loader-overlay';
export { LOADER_STEPS, type LoaderStepKey } from './loader-steps';
