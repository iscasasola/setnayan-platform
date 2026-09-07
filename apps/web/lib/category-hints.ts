/**
 * category-hints.ts — the ⓘ copy for the bench's folders and for the tiles that
 * no plan group claims.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `categoryHintForTile` (explore-info-copy.ts) resolves a tile's ⓘ from the
 * PLAN GROUP that claims it, and returns null for anything finer — the bench
 * then hides the button rather than inventing copy, which is the right refusal.
 * Measured 2026-09-06: of the 45 tiles reachable from the pick enum, **25 had
 * an ⓘ and 20 were silent**, several of them the ones a couple would most need
 * explained (`escort`, `referee_official`, `reveal_element`,
 * `personal_accident_insurance`). Its own docblock anticipated this: *"Tile-
 * level overrides arrive with the Taxonomy Studio."* This is that override map,
 * arriving early.
 *
 * FOLDERS had no ⓘ at all — no button, no copy, no mechanism. A collapsed
 * "Specialty" or "Dining extras" told a couple nothing until they expanded it.
 *
 * ── THE VOICE, AND THE ONE PLACE IT IS DELIBERATELY DROPPED ─────────────────
 * Every line: what it covers (concrete nouns) + a practical cue (timing or a
 * tip), under ~20 words, matching the 34 plan-group hints already shipping.
 *
 * ⚠ `farewell` is FUNERAL SERVICES. It carries no cue, no booking urgency and
 * no attempt to make anyone want to add it — someone reading it may have just
 * lost a person. The list of what is inside is the whole line. Do not "improve"
 * it into the house pattern.
 *
 * A tile-level entry WINS over the plan-group hint, so a tile whose group hint
 * is too generic can be sharpened here without touching PLAN_GROUPS.
 */

import type { WeddingFolder } from '@/lib/taxonomy';

/** ⓘ for a tile no plan group claims (or one whose group hint is too broad). */
export const TILE_HINTS: Readonly<Record<string, string>> = {
  choir:
    "Real voices rising as you walk in, and again as you walk out. Parish choirs follow the church calendar; ask early.",
  orchestra:
    "Strings swelling as the doors open — for the aisle, the first dance, or a gala. Send your song list 2 months out.",
  performers:
    "Band, acoustic duo, dancers, a cultural or fire show — the part guests film. Confirm set length and sound needs before you sign.",
  speaker_talent:
    "Host, emcee, keynote, or the celebrity guest people whisper about. Popular names hold dates first; book before the program is final.",
  kids_entertainer:
    "Magician, mascot, face painting, a games corner — the small guests stay delighted while the adults linger. Book 1-2 months out.",
  av_production:
    "Sound, lights, LED wall, mics — so every speech lands in the back row. Ask your venue what is in-house before you rent.",
  event_medic:
    "A nurse or paramedic quietly on standby at outdoor, sports, or large events. Many venues and tournaments require one.",
  tour_activity:
    "Island hopping, a city tour, team-building — the day your visiting guests talk about longest. Book once your headcount is firm.",
  tour_guide:
    "A local who knows the route, the stories behind it, and the shortcuts nobody posts. Book alongside your transport.",
  travel_insurance:
    "Cancelled flights, lost bags, medical care while away — handled, for you or a travelling group. Buy when you book flights.",
  restaurant_reservation:
    "A table waiting with your name on it — rehearsal dinner, intimate birthday, team lunch. Reserve 2-4 weeks out; longer on holidays.",
  brides_attire:
    "Gown, veil, shoes, and a second look for the dance floor. Designers need 4-6 months plus fittings.",
  grooms_attire:
    "Suit, barong, or tux, shoes, and the entourage matching you. Tailors need 2-3 months; ready-to-wear, less.",
  souvenir_giveaways:
    "What guests find in their bag next week — a token, a treat, a plant, corporate kits. Order 1-2 months out for personalisation.",
  // ── the six the owner defined on 2026-09-06 ──────────────────────────────
  escort:
    "A convoy clearing the way for the bridal car, VIP arrivals, or a group on the road. Confirm the route first.",
  reveal_element:
    "Cold sparks, confetti, smoke, a drone show, the gender-reveal burst — the gasp moment. Check the venue allows it before booking.",
  event_insurance:
    "Cancellation, postponement, venue damage — covered, so one bad week doesn't cost you twice. Arrange it once deposits go out.",
  personal_accident_insurance:
    "For the two of you, not your guests — medical costs looked after if something happens on the way or on the day.",
  referee_official:
    "Referees, umpires, scorers for tournaments; judges for contests and pageants — calls nobody argues with. Book accredited ones for anything with a prize.",
  massage_chair:
    "Machines for hire, or a therapist working the shoulders. Set them where guests wait: cocktail hour, tournament breaks.",
};

/**
 * ⓘ for a folder — shorter than a tile's, roughly 10-14 words. It ORIENTS; the
 * categories inside do the explaining.
 */
export const FOLDER_HINTS: Readonly<Record<WeddingFolder, string>> = {
  venue: "Churches, gardens, hotels, halls. Where the ceremony and the party happen, together or apart.",
  planning: "Coordinators, planners, day-of teams. They hold the clipboard; you hold the moment.",
  feast: "Caterers, cake makers, dessert tables. The meal guests still mention, and the sweet after.",
  design: "Florists, stylists, lights, drapes. The gasp when guests first walk in.",
  program: "Hosts, emcees, bands, DJs, sound systems. Everything through the mic that moves the room.",
  documentary:
    "Photographers, videographers, drone crews, same-day edit. How you'll relive it in twenty years.",
  look: "Gowns, suits, barong, hair, make-up. What you wear, and the hands that get you ready.",
  booths: "Photo booths, food carts, coffee and cocktail bars. Where guests drift, between courses and conversations.",
  prints: "Invitations, signage, menus, giveaways. What guests hold, read, and keep in a drawer.",
  transport: "Bridal cars, shuttles, vans, coaches. Everyone arrives on time and gets home safely.",
  experience:
    "Performers, games, activity corners, special effects. The parts guests join in, not just watch.",
  dining: "Lechon, grazing tables, dessert stations, drinks. Add-ons that turn the caterer's meal into a feast.",
  logistics_safety:
    "Security, escorts, medics, marshals, generators, portalets. Nobody notices them; that means they worked.",
  insurance: "Event cover and personal accident cover. A bad surprise stays a story, not a bill.",
  specialty: "Officials, tour guides, and the one-off asks. The unusual request that fits nowhere else.",
  // ⚠ No cue, no urgency, no selling. See the docblock.
  farewell: "Funeral homes, memorial chapels, hearse, interment. The services that carry a family through the week.",
};

/** The ⓘ text for a folder. Total — every folder has one, and a guard holds that. */
export function folderHintFor(folder: WeddingFolder): string {
  return FOLDER_HINTS[folder];
}

/** aria-label for the folder ⓘ toggle, mirroring the per-category one. */
export function folderHintButtonLabel(label: string): string {
  return `What does ${label} cover?`;
}
