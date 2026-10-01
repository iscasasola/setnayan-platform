import type { ReactNode } from 'react';
import type { TourSlide } from '@/lib/tours';

/**
 * ⚡ A TOUR SLIDE AS THE PHONE RECEIVES IT — built on the server, one tour only.
 *
 * `lib/tours.ts` holds the words of EVERY tour (~10.5KB gz once minified), and
 * a slide's icon is a component, which cannot cross into a client component as
 * a prop. So the carousels (`guided-tour-card.tsx`, the Maker's `maker-tour.tsx`)
 * used to import the whole file, and every dashboard page — the Maker's first
 * load included — downloaded all of it to show at most one tour.
 *
 * Here the server draws the icon (an element CAN cross) and hands over just the
 * slides of the tour being shown. Same markup as before: the icon carries the
 * exact classes the carousels drew it with.
 * 🛡 `lib/tours-stay-on-the-server.test.ts` fails if a client file imports TOURS.
 */
export type TourSlideView = {
  icon: ReactNode;
  /** PLAIN TEXT — see `TourSlide.title`. */
  title: string;
  /** HTML — see `TourSlide.body`. */
  body: string;
};

/** One tour, ready for a carousel: its slides plus the words behind its ⓘ. */
export type GuidedTourView = { slides: TourSlideView[]; label: string; blurb: string };

export function tourSlideView(slide: Pick<TourSlide, 'Icon' | 'title' | 'body'>): TourSlideView {
  return {
    icon: <slide.Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />,
    title: slide.title,
    body: slide.body,
  };
}
