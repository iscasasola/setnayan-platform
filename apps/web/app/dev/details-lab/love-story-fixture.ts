import type { LoveStoryBlob } from '@/app/dashboard/[eventId]/website/our-story/_components/story-fields';

/** The lab's couple — a story told in three moments (`love-story-lab.tsx`). */
export const LAB_STORY: LoveStoryBlob = {
  how_we_met: 'One jeepney, two strangers, and rain that would not stop.',
  met_year: '2018',
  moments: [
    { id: 'm-met00001', date: { y: 2018, m: 6 }, line: 'One jeepney, two strangers, and rain.', place: 'Baguio', anchor: 'met', canvas: {} },
    { id: 'm-fall0001', date: { y: 2020 }, line: 'The first apartment, and the first plant we did not kill.', canvas: {} },
    { id: 'm-yes00001', date: { y: 2025, m: 2, d: 14 }, line: 'At sunrise on the ridge.', anchor: 'yes', canvas: {} },
  ],
};

/** `?seed=1` — a couple who never opened the scrapbook: their onboarding words ARE the moments (`resolveMoments`). */
export const LAB_STORY_SEED: LoveStoryBlob = {
  how_we_met: 'One jeepney, two strangers, and rain that would not stop.',
  met_year: '2018',
  spark: 'The way she laughed before the punchline.',
  proposal: 'At sunrise on the ridge.',
  proposal_year: '2025',
};
