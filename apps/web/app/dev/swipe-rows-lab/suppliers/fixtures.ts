/**
 * FIXTURE rows for /dev/swipe-rows-lab/suppliers?part=team — two candidates in the build, no event, no database
 * (the lab 404s in production). Priced NULL on purpose: the lab is for the rows' swipe, so it prints no price at all
 * ("—", the unpriced note) rather than a made-up one. On the agreed-total roster as NOT_A_PRICE_SHOWN.
 */
export const LAB_TEAM_ROWS = [
  { vendor_id: 'v-cater', vendor_name: 'Juan Carlo Catering', category: 'catering', status: 'considering', total_cost_php: null },
  { vendor_id: 'v-photo', vendor_name: 'Lumière Studio', category: 'photography', status: 'considering', total_cost_php: null },
];
