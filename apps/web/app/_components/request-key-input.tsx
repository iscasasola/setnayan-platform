'use client';

import { useEffect, useState } from 'react';

/**
 * 🔁 THE FORM'S OWN KEY — event-day L1·3 (migration 20271273586425).
 *
 * A hidden `request_key` minted IN THIS BROWSER when the form mounts. Every
 * resubmission of the same form — a double tap, a retry after the redirect was
 * lost on venue signal — carries the same key, and the join writer answers it
 * with the request it already wrote: one row, one notice to the couple.
 *
 * 🔒 MINTED ON THE CLIENT, NEVER IN A SERVER RENDER. A key drawn into server
 * HTML could one day be served from a shared cache to two different people,
 * and the second would be handed the first one's request. A browser-made key
 * belongs to that browser only. Before hydration (or with no script) the field
 * is empty and the request is written exactly as before.
 */
export function RequestKeyInput() {
  const [key, setKey] = useState('');
  useEffect(() => {
    setKey(typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '');
  }, []);
  return <input type="hidden" name="request_key" value={key} data-request-key="" />;
}
