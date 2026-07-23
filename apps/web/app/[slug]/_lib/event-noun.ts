/** Event-type-adaptive noun for guest-facing copy: weddings keep "wedding"
 *  (byte-identical), every other type reads "event". Now that non-wedding types
 *  can enable the website surface, formerly-hardcoded "wedding" copy routes
 *  through this. Null/legacy event_type defaults to "wedding". */
export function eventNounOf(e: { event_type?: string | null }): 'wedding' | 'event' {
  return e.event_type && e.event_type !== 'wedding' ? 'event' : 'wedding';
}
