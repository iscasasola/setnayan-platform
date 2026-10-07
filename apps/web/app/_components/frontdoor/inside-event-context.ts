'use client';

/**
 * inside-event-context.ts — "is this shell standing inside ONE event?"
 *
 * Provided by `FrontDoorShell` from its own `insideEvent` prop (which
 * `AppRailShell` sets from `studioEventId`, passed only by
 * `app/dashboard/[eventId]/layout.tsx`). Read by the top-bar search so it can
 * stand down inside an event without the two search mounts (`/` and the rail)
 * handing the shell different expressions — see `one-top-bar.test.ts`.
 */

import { createContext } from 'react';

export const InsideEventContext = createContext(false);
