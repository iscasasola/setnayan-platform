/**
 * People › Show — the choices of the Show & sort sheet (admin reorg v10). Plain data, so the server page and the client
 * sheet both read ONE list (a server file must never take a value from a client module).
 */
export const PEOPLE_SHOW = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'needs-decision', label: 'Needs my decision' },
  { key: 'to-verify', label: 'To verify' },
  { key: 'documents', label: 'Documents' },
  { key: 'people', label: 'People' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'events', label: 'Events' },
] as const;
