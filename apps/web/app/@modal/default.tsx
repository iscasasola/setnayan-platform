/**
 * Default render for the root `@modal` parallel slot.
 *
 * The modal slot exists to host the intercepted /login overlay
 * (app/@modal/(.)login). For EVERY other URL — and for a hard load / refresh of
 * /login itself, where the `(.)` interceptor deliberately does NOT match — this
 * default renders, so the slot contributes nothing. Required by Next.js: a
 * parallel slot without a matching segment (or default) 404s the route.
 */
export default function ModalDefault() {
  return null;
}
