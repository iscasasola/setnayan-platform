/**
 * SERVICE INQUIRY FOCUS — the one-way bus that points the inquiry composer at
 * the service the couple is actually looking at.
 *
 * WHY A BUS AND NOT A CONTEXT. On `/v/[slug]` the services gallery and the
 * inquiry composer are two independent client islands mounted in two different
 * sections of one SERVER-rendered page (`Services & pricing` and
 * `#get-in-touch`, ~130 lines of JSX apart). A React context would need a
 * provider wrapping that whole span, i.e. a client component swallowing the
 * page body just to carry one string. The repo already solves exactly this
 * shape with a window CustomEvent bus in a plain (non-`'use client'`) lib
 * module — `BB_TAB_EVENT` / `goToBuildTab` in `lib/budget-build.ts`, and
 * `OPEN_CONSENT_EVENT` in `lib/cookie-consent.ts` — so this is that pattern,
 * not a new one.
 *
 * NOT a `'use client'` module on purpose: it exports no data and no component,
 * so a server component may import the event name without dragging anything
 * into a client bundle, and the RSC "no data exports from a client module" rule
 * has nothing to bite on.
 *
 * The payload is a `vendor_services.vendor_service_id` and nothing else. The
 * LISTENER decides whether it knows that id — an unknown id is ignored — so a
 * stale card, a second gallery, or a hand-fired event can never make the
 * composer inquire about a service the server did not hand it.
 *
 * Inert unless `serviceDetailsEnabled()` — the gallery only dispatches, and the
 * composer only subscribes, when the flag is on.
 */

/** The window event name. One channel, one payload shape. */
export const SERVICE_INQUIRY_FOCUS_EVENT = 'sn:inquire-service';

/**
 * Ask the inquiry composer to open on ONE specific service.
 *
 * Fire-and-forget by design: if no composer is mounted (a signed-out visitor,
 * an eventless viewer, a not-yet-bookable vendor) nothing listens and nothing
 * happens — which is why the caller must only render the button when the server
 * said a composer is there.
 */
export function focusServiceInquiry(vendorServiceId: string): void {
  const id = String(vendorServiceId ?? '').trim();
  if (!id) return;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<string>(SERVICE_INQUIRY_FOCUS_EVENT, { detail: id }),
  );
}

/**
 * Subscribe to focus requests. Returns the unsubscribe function, so a React
 * effect can `return onServiceInquiryFocus(handler)` directly.
 *
 * A no-op (and a no-op teardown) during SSR.
 */
export function onServiceInquiryFocus(
  handler: (vendorServiceId: string) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<unknown>).detail;
    if (typeof detail !== 'string') return;
    const id = detail.trim();
    if (id) handler(id);
  };
  window.addEventListener(SERVICE_INQUIRY_FOCUS_EVENT, listener);
  return () => window.removeEventListener(SERVICE_INQUIRY_FOCUS_EVENT, listener);
}
