/**
 * lib/service-names.ts — THE ONE LIST OF WHAT EACH SERVICE IS CALLED.
 *
 * ⚖ Owner tracker d17 (2026-10-02): *"plain names first, the Setnayan name small
 * underneath"* — "Guest photos · Papic", "Video booth · Patiktok", "Music ·
 * Music Maker", "Live stream · Live Watch", "Planner · Setnayan AI". A person
 * reads what the thing DOES first; the brand is the small line under it.
 *
 * 🔑 ONE LIST. Every surface that names a service — the Home's "Your services",
 * the More sheet and the rail, the service cards, onboarding — reads `plain` and
 * `brand` from here. A second table of names is how two screens end up calling
 * one thing two things.
 *
 * Keys are the service-card keys (`lib/our-services.ts`); identifiers and routes
 * do not change (`pakanta` is still Music Maker's catalogue key).
 */
export type ServiceNameKey = 'setnayan-ai' | 'papic' | 'live-studio' | 'music-maker' | 'patiktok';

export type ServiceName = {
  /** What it does, in the words a person would use — shown first. */
  plain: string;
  /** The Setnayan name — shown small, underneath. */
  brand: string;
};

export const SERVICE_NAMES: Readonly<Record<ServiceNameKey, ServiceName>> = {
  'setnayan-ai': { plain: 'Planner', brand: 'Setnayan AI' },
  papic: { plain: 'Guest photos', brand: 'Papic' },
  'live-studio': { plain: 'Live stream', brand: 'Live Watch' },
  'music-maker': { plain: 'Music', brand: 'Music Maker' },
  patiktok: { plain: 'Video booth', brand: 'Patiktok' },
};

export function serviceName(key: ServiceNameKey): ServiceName {
  return SERVICE_NAMES[key];
}

/** The pair on one line, where there is no room for two: "Guest photos · Papic". */
export function serviceNameLine(key: ServiceNameKey): string {
  const n = SERVICE_NAMES[key];
  return `${n.plain} · ${n.brand}`;
}
