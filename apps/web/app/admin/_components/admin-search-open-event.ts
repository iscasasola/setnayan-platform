/**
 * The one name both halves of the admin search agree on.
 *
 * 🔑 A LEAF, so the visible button and the palette cannot drift onto two
 * different event names — which would leave a button that looks alive and opens
 * nothing, the quietest failure this repo keeps paying for. A guard asserts both
 * files import it rather than typing the string.
 */
export const ADMIN_SEARCH_OPEN_EVENT = 'setnayan:admin-search-open';
