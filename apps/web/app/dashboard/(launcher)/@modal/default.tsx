/**
 * The launcher's `@modal` slot when nothing is intercepted — i.e. always,
 * except while the collection template's add flow is open over the board
 * (`(.)create-event/page.tsx`). Rendering nothing is the whole job: without a
 * default, a hard load of `/dashboard` would 404 the slot.
 */
export default function LauncherModalDefault() {
  return null;
}
