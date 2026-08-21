/**
 * THE REPLY CARD OFFERS BACK WHAT THIS PERSON ALREADY TOLD US — and never
 * overrides what they said for THIS event.
 *
 * Owner 2026-08-21: *"we can just grab those answers."*
 *
 * 🪤 THE PRECEDENCE IS THE WHOLE FEATURE, AND IT IS ONE `??` AWAY FROM BEING
 * BACKWARDS. `guest.x ?? profile.x` offers a saved answer into a blank field.
 * `profile.x ?? guest.x` silently replaces the answer this guest gave THIS
 * couple — the one the caterer actually cooks from — with a preference they
 * saved at somebody else's wedding. Both read fine; only one is right. The
 * mutation run found this untested, which is how it earned its own file.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import (tsconfig `jsx: preserve`),
 * plus stubs for `.css` / `server-only`, which this runner cannot resolve.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

async function render(over: {
  guestMeal?: string | null;
  guestDiet?: string | null;
  profileFood?: { mealPreference: string | null; dietaryRestrictions: string | null } | null;
}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: {
        guest_id: 'g-1',
        first_name: 'Ana',
        last_name: 'Cruz',
        display_name: 'Ana Cruz',
        rsvp_status: 'pending',
        meal_preference: over.guestMeal ?? null,
        dietary_restrictions: over.guestDiet ?? null,
        guest_note: null,
        qr_token: 't',
        photo_source: null,
        photo_url: null,
      },
      eventId: 'e-1',
      eventPublicId: 'S89E-X',
      faceMode: 'mode_b',
      profileFood: over.profileFood ?? null,
    } as never),
  );
}

/** Which <option> the browser would have selected. */
function selectedMeal(html: string): string | null {
  const sel = html.slice(html.indexOf('name="meal_preference"'));
  const m = sel.match(/<option value="([^"]+)" selected=""/);
  return m ? m[1]! : null;
}
function dietValue(html: string): string {
  const m = html.match(/name="dietary_restrictions" value="([^"]*)"/);
  return m ? m[1]! : '';
}

test('a blank card is filled from what they saved', async () => {
  const html = await render({
    profileFood: { mealPreference: 'vegetarian', dietaryRestrictions: 'nut allergy' },
  });
  assert.equal(selectedMeal(html), 'vegetarian', 'their saved meal was not offered back');
  assert.equal(dietValue(html), 'nut allergy', 'their saved allergy was not offered back');
});

test('🔴 what they said for THIS event always wins', async () => {
  const html = await render({
    guestMeal: 'fish',
    guestDiet: 'shellfish allergy',
    profileFood: { mealPreference: 'vegetarian', dietaryRestrictions: 'nut allergy' },
  });
  assert.equal(
    selectedMeal(html),
    'fish',
    'a saved preference replaced the answer this guest gave THIS couple — the one the caterer cooks from',
  );
  assert.equal(
    dietValue(html),
    'shellfish allergy',
    'a saved allergy replaced the allergy they entered for this event',
  );
});

test('one blank and one answered fills only the blank', async () => {
  // The half-and-half case, which a single merged fallback gets wrong.
  const html = await render({
    guestMeal: 'beef',
    guestDiet: null,
    profileFood: { mealPreference: 'vegan', dietaryRestrictions: 'coeliac' },
  });
  assert.equal(selectedMeal(html), 'beef', 'the answered field was overwritten');
  assert.equal(dietValue(html), 'coeliac', 'the blank field was not filled');
});

test('no account, no change — the card is exactly as it was', async () => {
  const html = await render({ guestMeal: null, guestDiet: null, profileFood: null });
  assert.equal(selectedMeal(html), 'no_preference');
  assert.equal(dietValue(html), '');
});
