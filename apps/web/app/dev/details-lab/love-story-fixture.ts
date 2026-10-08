/**
 * 🧪 maria-and-jose's LOVE STORY ON FIXTURES (DEV-ONLY — the Maker lab). A plain file with no "use client": the lab
 * shows this story in TWO places at once — Studio › Love Story's list (`studio-lab-fixtures.tsx`, a client file) and
 * the Details words panel beside it (`details-lab-node.tsx`, a server file) — and both must be handed THE SAME story.
 *
 * 🔑 WHY THAT MATTERS (found 2026-10-08, by picking two photos in a row in the lab): the Maker keeps ONE copy of the
 * story being edited (`lib/maker-draft-store.ts`) and trusts it only while it is built on the story the server last
 * drew. With the list on this story and the words panel on an empty one, each save left the copy "built on" the
 * other reader's story, the next change read the fixture afresh, and whatever came before it was lost — a second
 * picked photo replaced the first; renaming one moment un-named the one renamed before it. One event has one story.
 */
import type { LoveStoryBlob } from '@/app/dashboard/[eventId]/website/our-story/_components/story-fields';

/** Two of maria-and-jose's own demo pictures, standing in for stored photos (a lab has no storage to read). */
export const LAB_PHOTOS: Record<string, string> = {
  'r2://setnayan-media/events/lab/love-story/a.jpg': '/demo/maria-jose/wall-1.webp',
  'r2://setnayan-media/events/lab/love-story/b.jpg': '/demo/maria-jose/wall-6.webp',
};

/**
 * maria-and-jose's Love Story on fixtures — every state the Timeline row has: a chapter known only by its YEAR, one
 * by MONTH and year, one by FULL date; one with two photos, one kept off the Event Hub; each with 4c's title, in the
 * couple's own order.
 */
export const LAB_LOVE_STORY: LoveStoryBlob = {
  moments: [
    { id: 'ls-umbrella', date: { y: 2019 }, title: 'One umbrella', line: 'A rainy Tuesday in Katipunan — one umbrella, two strangers, no bus for an hour.', anchor: 'met', order: 0, media: Object.keys(LAB_PHOTOS), canvas: {} },
    { id: 'ls-trip', date: { y: 2021, m: 2, d: 14 }, title: 'Our first trip', line: 'Baguio, on a bus that left at four in the morning.', place: 'Baguio', order: 1, canvas: {} },
    { id: 'ls-siargao', date: { y: 2022, m: 6 }, title: 'Siargao', line: 'He asked. She said yes before he finished the question.', place: 'Siargao', anchor: 'yes', order: 2, canvas: {} },
    { id: 'ls-fitting', date: { y: 2026, m: 9 }, title: 'The fitting', line: 'Her mother cried first.', hidden: true, order: 3, canvas: {} },
  ],
} as unknown as LoveStoryBlob;
