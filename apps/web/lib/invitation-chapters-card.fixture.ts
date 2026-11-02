/** 🧪 Renders the real reply card (`RsvpWidget`) with chapters, for the Step 5 guards. Fake guest, fake event. */
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

export async function renderReplyCard(props: Record<string, unknown>, guestOver: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../app/[slug]/_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: {
        guest_id: 'g-1',
        first_name: 'Tita',
        last_name: 'Baby',
        display_name: 'Tita Baby',
        rsvp_status: 'pending',
        meal_preference: null,
        dietary_restrictions: null,
        guest_note: null,
        email: null,
        mobile: null,
        qr_token: 't',
        photo_source: null,
        photo_url: null,
        plus_one_allowed: false,
        ...guestOver,
      },
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      doorAction: async () => {},
      ...props,
    } as never),
  );
}

/** The chapter ids the card's "Which part can't you make?" offers. */
export const cantTicks = (html: string) =>
  [...html.matchAll(/<input[^>]*name="cant_chapter"[^>]*>/g)].map((m) => m[0].match(/value="([^"]*)"/)?.[1]);
