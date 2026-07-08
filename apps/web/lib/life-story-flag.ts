/**
 * Life Story rollout flag — a ROLLOUT switch, not a legal gate.
 *
 * Deliberately distinct from the counsel-gated NEXT_PUBLIC_PERSON_LIFE_STORIES
 * (cross-event participant media, Phase 1.5): Life Story Phase 1 reads only the
 * viewer's OWN events, so it carries no counsel dependency — this flag just
 * lets every lane merge to main with zero exposure until the owner flips it
 * after preview QA (Build Plan §0).
 *
 * Kept as a function (not a module const) so it's re-read per request rather
 * than captured — same convention as personLifeStoriesEnabled().
 */
export function lifeStoryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LIFE_STORY === '1';
}
