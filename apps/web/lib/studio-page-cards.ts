/**
 * lib/studio-page-cards.ts — WHAT EACH STUDIO PAGE CARD SAYS (owner 2026-10-08: *"we can improve the page card as
 * well. how they can be presented — Logo / Topic / Description and a small (i) that will give a more detailed
 * explanation"*; the designer's eleven, `prototypes/studio_home_2026-10-08_fable.html` `TILES`).
 *
 * For each of the eleven pages: ONE plain line saying what the couple does there (a sentence — never nouns joined by
 * dots), and the three short things its ⓘ explains: what the page controls · where a guest sees it · what to do
 * first. Words only — the card's name, its ✓ / Missing and which pages an event draws are `lib/studio-tiles.ts`'s.
 *
 * Pure strings: no React, no I/O. `studio-home.tsx` (loaded when Studio is first opened) reads them; nothing here
 * reaches the Maker's first load.
 */
import type { StudioTileKey } from './studio-tile-defs';

/** A tile whose fact could not be read says so — on the card, never hidden behind the ⓘ. */
export const STUDIO_TILE_UNREAD = 'Could not be read just now';

export type StudioPageCard = {
  /** One plain line: what the couple does on this page. */
  description: string;
  /** ⓘ · what the page controls. */
  controls: string;
  /** ⓘ · "Guests see it:" where. (Named `seenAt`, not `guests`: it is words, never a count.) */
  seenAt: string;
  /** ⓘ · "Do this first:" one thing. */
  first: string;
};

export const STUDIO_PAGE_CARDS: Readonly<Record<StudioTileKey, StudioPageCard>> = {
  info: {
    description: 'Your names, the first words of the invitation, and the messages guests read.',
    controls: 'Your names and how they are written, the opening line, a special message, what to bring, and your Event Hub’s address and QR.',
    seenAt: 'On the first page of the Event Hub, on every print and every pass.',
    first: 'Check your names and pick an opening line — everything else can wait.',
  },
  look: {
    description: 'The background, the colours and fonts, and the music of your Event Hub.',
    controls: 'The main background behind every page (a colour, a scene, a video or your own photo), effects on top, your five colours, your fonts, your buttons, and the music.',
    seenAt: 'Everywhere — every page of the Event Hub wears it, the cover included.',
    first: 'Pick a background and see your names on it; the rest follows your Mood Board.',
  },
  logo: {
    description: 'A mark made from your names, and how it moves.',
    controls: 'A monogram or a drawn mark from your initials, its fonts, and whether it travels into the bar as guests scroll.',
    seenAt: 'At the top of the Event Hub and on the invitation.',
    first: 'Try the monogram first — it is made for you from your names.',
  },
  mood: {
    description: 'Your five colours, and what guests should wear.',
    controls: 'The five colours every page is dressed from, your inspiration photos, and the attire for each role — guests, sponsors, the entourage.',
    seenAt: 'The colours on every page; the dress code on the Details page.',
    first: 'Set the five colours — Look, buttons and the music button all follow them.',
  },
  schedule: {
    description: 'The times of the day, moment by moment.',
    controls: 'The ceremony, the reception and every moment in between, with times, and announcements for the day.',
    seenAt: 'On the Day page and the countdown.',
    first: 'Put in the ceremony time; the rest can be added as you book.',
  },
  story: {
    description: 'How you met, told in short chapters with a photo each.',
    controls: 'Chapters of your story, each with a title, a few lines and a photo; the order they are read in.',
    seenAt: 'On the Our Love Story page.',
    first: 'Write one chapter — how you met — and add a photo.',
  },
  march: {
    description: 'Who walks, in what order, down both aisles.',
    controls: 'The entourage in two columns, dragged into the order they walk; parents, sponsors and the bridal party.',
    seenAt: 'On the Details page as the wedding march.',
    first: 'Add your parents and sponsors first; the rest fills in as you confirm people.',
  },
  seats: {
    description: 'The tables, and who sits where.',
    controls: 'Your tables, their sizes and shapes, and each guest’s seat; the room as a map.',
    seenAt: 'On a guest’s pass (their table) and on the Day page.',
    first: 'Make the tables; seat people once replies are in.',
  },
  gifts: {
    description: 'How guests can send a gift, and your thank-you.',
    controls: 'Where gifts are received — GCash, Maya, a bank, PayPal, a registry link — and the thank-you message a guest sees after giving.',
    seenAt: 'On the Gifts page of the Event Hub.',
    first: 'Add one way to give; write the thank-you later.',
  },
  rsvp: {
    description: 'What the reply form asks, and the date to reply by.',
    /* The designer's line named "meal, plus-one, song requests" — not checked against what the form ships; said without the list. */
    controls: 'What the reply form asks your guests, who may reply, and the reply-by date.',
    seenAt: 'On the RSVP page, and in the reminder emails.',
    first: 'Set the reply-by date; the questions have good defaults.',
  },
  prints: {
    description: 'The invitation set and the printed pieces for the day.',
    /* The pieces that SHIP (`lib/print-pieces.ts`) — the designer's line named an RSVP card and programmes, which do not. */
    controls: 'The invitation, the entourage, the details card, the menu, passes, posters, and table signs and place cards — each as a file to print.',
    seenAt: 'In the hands of your guests and on the tables.',
    first: 'Download the invitation once Info and Look are done; it carries both.',
  },
};
