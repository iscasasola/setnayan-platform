'use client';

import { createContext } from 'react';

/**
 * Does THIS event have sides at all? (owner 2026-09-30: "why is there groom and
 * bride's side for a simple event"). Provided by GuestsScreen from the
 * event-type profile (`eventHasSides`), read by every row, header, bulk form and
 * arrange menu below it. Defaults to TRUE so a surface mounted outside the
 * provider keeps the wedding behaviour it always had.
 */
export const GuestListHasSidesContext = createContext(true);
