/**
 * Where a requester's OWN Digital ticket is fetched while their request is
 * pending (frame B of `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html`).
 * No id in the address — the route reads this browser's remembered request
 * (lib/request-key.server.ts). Pure constant, safe for any bundle.
 */
export const REQUEST_TICKET_ROUTE = '/api/guest/request-ticket';
