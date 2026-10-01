/**
 * name-style-save.ts — 🔤 the ONE way a Maker control saves the event's Name
 * style: the prints' own door (`POST /api/hub-print/name-style` →
 * `events.print_details.name_style`, `app/api/hub-print/[piece]/route.ts`).
 * Details' Name style ▾ (`NameStylePicker`) and the hero names' Wording ▾
 * (`type-in-place.tsx`) both call it — one setting, never a second.
 *
 * Resolves true when it saved; false on any refusal or a lost connection
 * (the caller puts the last saved style back and says so).
 */
import type { NameStyle } from './name-style';

export function saveNameStyle(eventId: string, style: NameStyle): Promise<boolean> {
  const fd = new FormData();
  fd.set('event_id', eventId);
  fd.set('style', style);
  return fetch('/api/hub-print/name-style', { method: 'POST', body: fd, headers: { accept: 'application/json' } })
    .then((r) => r.ok)
    .catch(() => false);
}
