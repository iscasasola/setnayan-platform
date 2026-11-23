/**
 * The launcher's MAIN slot (`children`) when the page under it is not Home — the fallback that lets the create-event
 * sheet open from anywhere under /dashboard (walk 13 Nov 2026, F-W3-13).
 *
 * `@modal/(.)create-event` intercepts a CLIENT navigation to /dashboard/create-event from any page under /dashboard,
 * and draws its sheet inside THIS layout. From Home that is fine: the main slot is Home. From any page in another
 * group — a Group (`(account)/samahan/[id]`), Life flash, the Library — this layout's main slot has no page of its
 * own, and with no `default` Next answers it with not-found: "This page doesn't exist on Setnayan", HTTP 200. A full
 * load of the same URL is never intercepted, which is why a refresh showed the real page.
 *
 * Nothing is drawn here: the sheet is the content, and closing it (`CreateEventPanel` → `router.back()`) returns to
 * the page the tap came from. Pinned by `create-event-opens-from-every-page.test.ts`.
 */
export default function LauncherMainDefault() {
  return null;
}
