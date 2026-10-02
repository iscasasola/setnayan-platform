import { TOURS, type TourKey } from '@/lib/tours';
import { GuidedTourCard } from './guided-tour-card';
import { tourSlideView, type GuidedTourView } from './tour-slide-view';

type Props = {
  tourKey: TourKey;
  // Server action invoked when the user finishes or skips the tour. The key
  // is passed back so the action can append to `users.tour_seen_keys`.
  completeAction: (tourKey: TourKey) => Promise<void>;
  /** In the app-store shell a slide marked `sells` is dropped (App Review 3.1.1). */
  storeShell?: boolean;
};

// ⚡ A SERVER COMPONENT, so `lib/tours.ts` stays on the server (the diet,
// 2026-10-01). It used to be the carousel itself, `'use client'`, reading TOURS
// in the browser — because a slide's Lucide `Icon` is a function and Next 15 /
// React 19 refuses to pass functions across the server → client boundary. That
// shipped the words of EVERY tour (~10.5KB gz) to every page that mounts one
// (all four role layouts, and so the Maker's first load) to show at most one.
// Now the server picks the one tour, draws each icon into an element (which
// CAN cross — `tour-slide-view.tsx`) and hands the carousel
// (`guided-tour-card.tsx`) just those slides. Same props as before, same markup.
/** One tour, drawn for a carousel — server side. The guest page uses it too (`guest-guided-tour.tsx`). */
export function guidedTourView(tourKey: TourKey, storeShell = false): GuidedTourView {
  const tour = TOURS[tourKey];
  return {
    slides: tour.slides.filter((s) => !(storeShell && s.sells)).map(tourSlideView),
    label: tour.label,
    blurb: tour.blurb,
  };
}

export function GuidedTour({ tourKey, completeAction, storeShell = false }: Props) {
  return <GuidedTourCard tourKey={tourKey} {...guidedTourView(tourKey, storeShell)} completeAction={completeAction} />;
}
