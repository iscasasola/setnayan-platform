/**
 * Default render for the `@drawer` parallel slot on the event layout.
 *
 * When the URL matches no `(.)`-intercepting route in this slot (the normal
 * case — you're just on a page, or you hard-loaded an interceptable URL so the
 * FULL page rendered in `children`), the slot renders nothing. The drawer only
 * appears when a soft navigation is intercepted. See `_components/section-drawer.tsx`.
 */
export default function DrawerDefault() {
  return null;
}
