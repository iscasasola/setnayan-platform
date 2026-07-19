/**
 * vendor-overview-inquiry-card.ts — the pure DTO + builder for a PRE-ACCEPT
 * inquiry card in the vendor Overview "What's new" feed.
 *
 * WHY THIS IS ITS OWN (non-server-only) MODULE — anonymization-until-accept
 * (Glass PR-6b · spec `Vendor_Inquiry_Anonymization_Spec_2026-07-15`) is a
 * DATA-LAYER guarantee: the card served to the client for a pending inquiry must
 * never carry the couple's identity (display_name / photo / event title /
 * contact). #3266 stopped assembling `display_name` into the card, but the field
 * was still NAMED `eventName` — a name that invites a future edit to drop the
 * couple's real event name straight back in. This module removes that foot-gun
 * STRUCTURALLY: the inquiry card has NO `eventName` field at all. It ships a
 * single anonymous `descriptor` ("A couple planning a {event_type} in {city}")
 * built only from event_type + city, plus non-identifying facts (date, city,
 * category, token cost). There is no input path through which a display_name can
 * reach the card — which is exactly what the DTO test locks.
 *
 * Kept free of `server-only` so the builder is unit-testable (the server
 * assembly in `vendor-overview.ts` imports both the type and the builder).
 */
import { regionBurnTokens } from '@/lib/v2/region-token-burn';
import { regionLabel } from '@/lib/region-source';
import { inquiryPlaceholderLabel } from '@/lib/inquiry-mask';

/**
 * A single PRE-ACCEPT inquiry card. Deliberately carries NO couple identity —
 * `descriptor` is the neutral placeholder, never the event's display_name.
 * Identity is revealed only after Accept (the flat 1-token burn), at which point
 * the card leaves the feed.
 */
export type InquiryWhatsNewCard = {
  kind: 'inquiry';
  id: string;
  threadId: string;
  title: string; // "New inquiry — New customer"
  /** Neutral anonymous descriptor ("A couple planning a {type} in {city}"). */
  descriptor: string;
  eventDate: string | null;
  /** City/area-level place ONLY — never a venue name or address. */
  place: string | null;
  category: string | null;
  /** Region-banded token cost to Accept (◎N). */
  tokenCost: number;
  createdAt: string;
};

/**
 * Assemble a masked inquiry card from ONLY non-identifying inputs. There is no
 * `displayName` / `venue` / `contact` parameter — the couple's identity cannot
 * enter here by construction, so the placeholder can never be bypassed.
 */
export function buildInquiryCard(input: {
  threadId: string;
  createdAt: string;
  /** Event date (month/day granularity is fine); permitted pre-accept. */
  eventDate: string | null;
  /** Raw event-type slug (feeds the placeholder noun). */
  eventType: string | null;
  /** Region slug — resolved to a city/area label; never a venue. */
  region: string | null;
  /** The vendor's own primary service label (what they were inquired FOR). */
  category: string | null;
}): InquiryWhatsNewCard {
  const city = regionLabel(input.region);
  return {
    kind: 'inquiry',
    id: `inq-${input.threadId}`,
    threadId: input.threadId,
    title: 'New inquiry — New customer',
    descriptor: inquiryPlaceholderLabel({ eventType: input.eventType, city }),
    eventDate: input.eventDate,
    place: city,
    category: input.category,
    tokenCost: regionBurnTokens(input.region),
    createdAt: input.createdAt,
  };
}
