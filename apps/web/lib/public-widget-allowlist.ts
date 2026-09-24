/**
 * The public-widget firewall (OPEN-BROWSE PR1 — council build plan §3 row 1).
 *
 * The ONLY hideable widget types the anonymous public landing path
 * (`PublicLanding` in `app/[slug]/page.tsx`) may render. Every type here
 * carries event-level data only (no per-guest fields), so it is safe to show
 * a visitor with no guest session. The 4 always-on widgets (hero · greeting ·
 * qr_card · rsvp) and the 2 guest-personalized hideable widgets
 * (event_details · your_photos) are deliberately ABSENT — they need a guest
 * object / session cookie to be meaningful, and rendering them anonymously
 * would leak guest-personal surface.
 *
 * Extracted verbatim from PublicLanding's inline allow-list so it is a named,
 * unit-tested constant (`lib/public-widget-allowlist.test.ts` asserts the
 * guest-personal types can never creep in). The open-browse program's later
 * CI anonymous-bytes check builds on this constant — treat any addition here
 * as a privacy decision, not a rendering convenience.
 */
import type { WidgetType } from './invitation-widgets';

export const PUBLIC_WIDGET_ALLOWLIST: readonly WidgetType[] = [
  'countdown',
  'schedule',
  'venue_map',
  'dress_code',
  'photo_moments',
  'tier_comparison',
  'special_message',
  'what_to_bring',
  'our_photos',
  'our_love_story',
  /* THE COUPLE'S OWN SECTIONS (owner 2026-09-23). A PRIVACY DECISION, made
     against this file's own rule — event-level data only, no per-guest fields
     — and not a rendering convenience.

     The words in a custom section are text the couple typed into their own
     website editor. There is no guest object anywhere near it: no name, no
     seat, no RSVP, nothing read from a session. It is the same class as
     `special_message` and `our_love_story` above, which are already here.

     🔑 AND IT IS THE COUPLE'S CHOICE TWICE OVER. A section reaches a stranger
     only if they turned open-browse ON, wrote something in it, and left it
     visible. An empty slot has no content and the Auto machinery hides it.

     ⚠ If a custom section ever gains a per-guest field — a name, a seat, a
     "you" — these six must come straight back out. */
  'custom_1',
  'custom_2',
  'custom_3',
  'custom_4',
  'custom_5',
  'custom_6',
];
