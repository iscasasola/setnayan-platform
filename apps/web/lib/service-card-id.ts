/**
 * Is this address segment a service card's id? Card ids are uuids — the same check the maker's loader makes
 * (`loadCardForEdit`). The risen card maker (`@rise/(.)services/[serviceId]`) rises only for one: a dynamic folder
 * also matches the services pages beside it (`requests`, `their-work` — measured in the rise-route lab), and those load
 * as their own pages, as they always have (final check B8, controller 25 Nov).
 */
export function isServiceCardId(segment: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(segment);
}
