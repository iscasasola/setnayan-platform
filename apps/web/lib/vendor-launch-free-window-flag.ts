/**
 * vendor-launch-free-window-flag.ts — the NEXT_PUBLIC flag that decides whether
 * consumers APPLY the launch free window (`vendor-launch-free-window.ts`) to
 * covered paid features.
 *
 * NEXT_PUBLIC so the client price preview and the server charge agree. Default
 * OFF → the window is inert even before its end date; nothing is free until the
 * owner flips it. Kept separate so the window logic module stays I/O-free and
 * `tsx --test`-friendly.
 */
export function isVendorLaunchFreeWindowEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW;
  return v === '1' || v === 'true';
}
