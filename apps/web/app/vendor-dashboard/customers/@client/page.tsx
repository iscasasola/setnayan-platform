/**
 * ↩ THE CLIENTS ADDRESS ITSELF, IN THE `client` SLOT — nothing (EB-246, 16 Nov 2026).
 *
 * `default.tsx` beside this only answers a HARD load. On a SOFT navigation Next keeps a parallel slot's last page
 * when the new address does not name the slot — so when the picked client's ✕ (or Esc) pushed
 * `/vendor-dashboard/customers` (it does whenever it has no list origin to go back to: a tile list, Money, the
 * calendar's day rows), the address changed and the client card STAYED on screen; only a reload got out.
 * Naming the address here makes every soft arrival at the Clients list draw no client.
 * Held by `client-card-closes-to-its-list.test.ts`.
 */
export default function NoPickedClientOnTheList() {
  return null;
}
