/**
 * Loading boundary for the picked client drawn OVER the Clients list (the `@client` slot).
 *
 * 🔑 IT RENDERS NOTHING ON PURPOSE. Without this file the slot borrows `vendor-dashboard/loading.tsx`, which paints
 * the whole supplier-home skeleton (a page title, stat tiles, rows) — furniture the picked client never draws, laid
 * over a list that is still on screen. Null leaves the list exactly where it is until the client's sheet lands.
 *
 * ⚖ Status-neutral: this slot only renders on a SOFT tap from the list (an intercepted navigation), which has no HTTP
 * status to commit. A hard load of `/vendor-dashboard/clients/<id>` is not intercepted and keeps
 * `clients/loading.tsx`.
 */
export default function PickedClientLoading() {
  return null;
}
