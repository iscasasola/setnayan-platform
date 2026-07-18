// lib/vendor-autoreply/answer.ts
//
// Deterministic answer assembly (Phase 2) — templated replies built ONLY from
// the vendor's own store snapshot + the inquiring couple's own event. Returns
// null when the store has no data to answer factually (engine then hands off).
// Because every number comes from a live row, the bot structurally cannot
// misquote (build plan §2/§3).

import type {
  EngineInput,
  EngineSignals,
  EventBriefLite,
  Intent,
  StoreService,
  VendorStoreSnapshot,
} from './types';

const PESO = '₱'; // ₱

export function formatPhp(php: number | null | undefined): string {
  if (php == null || !Number.isFinite(php)) return '';
  return PESO + Math.round(php).toLocaleString('en-PH');
}

export function formatCentavosPhp(centavos: number | null | undefined): string {
  if (centavos == null || !Number.isFinite(centavos)) return '';
  return formatPhp(centavos / 100);
}

function labelize(v: string): string {
  return v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function serviceTitle(s: StoreService): string {
  return s.title && s.title.trim() ? s.title.trim() : labelize(s.category);
}

function servicePriceLine(s: StoreService): string | null {
  if (s.startingPricePhp == null) return null;
  let line = `${serviceTitle(s)} starts at ${formatPhp(s.startingPricePhp)}`;
  if (s.pricingBasis === 'per_pax' && s.perPaxPricePhp != null) {
    line += ` (${formatPhp(s.perPaxPricePhp)}/guest${s.minPax != null ? `, min ${s.minPax} pax` : ''})`;
  } else if (s.pricingBasis === 'per_hour' && s.hourBasePhp != null) {
    // Never invent a duration: only state the covered hours when the vendor set
    // minHours (else just the extra-hour rate, if any). No hardcoded "1 hr".
    if (s.minHours != null) {
      line += ` (covers ${s.minHours} hr${s.minHours === 1 ? '' : 's'}${
        s.extraHourPhp != null ? `, +${formatPhp(s.extraHourPhp)}/extra hr` : ''
      })`;
    } else if (s.extraHourPhp != null) {
      line += ` (+${formatPhp(s.extraHourPhp)}/extra hr)`;
    }
  } else if (s.basePax != null) {
    line += ` (up to ${s.basePax} pax)`;
  }
  return line;
}

function buildPrice(store: VendorStoreSnapshot): string | null {
  const lines = store.services
    .filter((s) => s.startingPricePhp != null)
    .map(servicePriceLine)
    .filter((x): x is string => !!x);
  const pkgs = store.packages.filter((p) => p.totalPriceCentavos > 0);
  if (lines.length === 0 && pkgs.length === 0) return null;

  const parts: string[] = [];
  if (lines.length === 1) parts.push(`Our ${lines[0]}.`);
  else if (lines.length > 1) parts.push(`Our starting rates — ${lines.slice(0, 3).join('; ')}.`);
  if (pkgs.length > 0) {
    parts.push(`Our ${pkgs[0].name} package is ${formatCentavosPhp(pkgs[0].totalPriceCentavos)}.`);
  }
  return parts.join(' ');
}

function buildInclusions(store: VendorStoreSnapshot): string | null {
  const pkg = store.packages.find((p) => p.items.some((i) => i.included));
  if (pkg) {
    const items = pkg.items.filter((i) => i.included).map((i) => i.description).slice(0, 8);
    if (items.length) return `Our ${pkg.name} includes: ${items.join(', ')}.`;
  }
  const inc = store.services.flatMap((s) => s.inclusions.map((i) => i.label)).slice(0, 8);
  if (inc.length) return `Included with our services: ${inc.join(', ')}.`;
  return null;
}

// vendor_coverages is service + event-type + faith coverage — NOT geography.
// So describe event-type / faith coverage honestly; never print a service
// category as if it were an area (a place the vendor never stated). Purely
// geographic "do you cover <city>?" questions have no data here and fall to
// handoff, which is the correct/safe direction.
function buildCoverage(store: VendorStoreSnapshot): string | null {
  if (store.coverages.length === 0) return null;
  const eventTypes = Array.from(new Set(store.coverages.flatMap((c) => c.eventTypes)))
    .map(labelize)
    .slice(0, 6);
  const faiths = Array.from(new Set(store.coverages.flatMap((c) => c.faiths))).slice(0, 6);
  if (eventTypes.length === 0 && faiths.length === 0) return null;
  let s = eventTypes.length ? `We serve ${eventTypes.join(', ')} events` : `We'd be glad to help`;
  if (faiths.length) s += ` (${faiths.join(', ')} ceremonies welcome)`;
  return s + '.';
}

function buildDiscount(store: VendorStoreSnapshot): string {
  const ds = store.services.flatMap((s) => s.discounts);
  if (ds.length === 0) return `We don't have a running promo at the moment.`;
  const parts = ds
    .slice(0, 3)
    .map((d) =>
      d.unit === 'pct'
        ? `${d.rate}% off (${labelize(d.type)})`
        : `${formatPhp(d.rate)} off (${labelize(d.type)})`,
    );
  return `Current offers: ${parts.join(', ')}.`;
}

function buildSocialProof(store: VendorStoreSnapshot): string | null {
  if (store.avgRating == null || (store.reviewCount ?? 0) <= 0) return null;
  let s = `We're rated ${store.avgRating.toFixed(1)}★ from ${store.reviewCount} review${
    store.reviewCount === 1 ? '' : 's'
  }.`;
  const recent = store.reviews.find((r) => r.body && r.body.trim().length > 0);
  if (recent && recent.body) {
    const body = recent.body.trim();
    const snip = body.slice(0, 140);
    s += ` A recent couple said: "${snip}${body.length > 140 ? '…' : ''}"`;
  }
  return s;
}

function buildCapability(store: VendorStoreSnapshot): string | null {
  const titles = Array.from(new Set(store.services.map(serviceTitle))).slice(0, 8);
  if (titles.length === 0) return null;
  return `Yes — we offer ${titles.join(', ')}.`;
}

function buildLeadTime(store: VendorStoreSnapshot): string | null {
  const s = store.services.find(
    (x) =>
      x.recommendedLeadTimeMonths != null ||
      x.lastMinuteEndMonths != null ||
      (x.lastMinuteSurchargePct != null && x.lastMinuteSurchargePct > 0),
  );
  if (!s) return null;
  const parts: string[] = [];
  if (s.recommendedLeadTimeMonths != null) {
    parts.push(
      `We recommend booking about ${s.recommendedLeadTimeMonths} month${
        s.recommendedLeadTimeMonths === 1 ? '' : 's'
      } ahead`,
    );
  }
  if (s.lastMinuteSurchargePct != null && s.lastMinuteSurchargePct > 0) {
    parts.push(`last-minute dates carry a ${s.lastMinuteSurchargePct}% rush fee`);
  } else if (s.lastMinuteEndMonths != null) {
    parts.push(`we can still take last-minute dates`);
  }
  return parts.length ? parts.join('; ') + '.' : null;
}

function prettyDate(iso: string): string {
  const withTime = iso.length === 10 ? `${iso}T00:00:00Z` : iso;
  const d = new Date(withTime);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function buildAvailability(
  event: EventBriefLite | null | undefined,
  signals: EngineSignals | null | undefined,
): string {
  const date = event?.primaryDate ?? null;
  if (!date) return `Happy to check our availability — which date are you looking at?`;
  const pretty = prettyDate(date);
  const avail = signals?.dateAvailable;
  if (avail === true) return `Good news — ${pretty} looks open! Would you like to hear about our packages?`;
  if (avail === false) {
    return `Unfortunately ${pretty} is already booked. If you have a backup date, we'd love to check it.`;
  }
  return `Let me confirm ${pretty} for you — I'll get right back to you.`;
}

// Returns reply text, or null when the store can't answer -> engine hands off.
export function buildAnswer(intent: Intent, input: EngineInput): string | null {
  const { store, event, signals } = input;
  switch (intent) {
    case 'price':
      return buildPrice(store);
    case 'inclusions':
      return buildInclusions(store);
    case 'coverage':
      return buildCoverage(store);
    case 'discount':
      return buildDiscount(store);
    case 'social_proof':
      return buildSocialProof(store);
    case 'capability':
      return buildCapability(store);
    case 'lead_time':
      return buildLeadTime(store);
    case 'availability':
      return buildAvailability(event, signals);
    default:
      return null;
  }
}
