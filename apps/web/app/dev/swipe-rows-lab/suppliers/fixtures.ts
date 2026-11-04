/**
 * FIXTURE rows for /dev/swipe-rows-lab/suppliers (no event, no database, 404 in production) — typed here, never
 * read from event_vendors. Kept out of the page so the agreed-total guard can tell a lab's fixture from a reader.
 */
export const LAB_SUPPLIER_ROWS = [
  { vendor_id: 'v-cater', vendor_name: 'Juan Carlo Catering', category: 'catering', status: 'considering', total_cost_php: 90_000 },
  { vendor_id: 'v-photo', vendor_name: 'Lumière Studio', category: 'photography', status: 'considering', total_cost_php: 65_000 },
];
