'use client';

import dynamic from 'next/dynamic';
import { SlotRows } from '../lazy-slot';

/**
 * 📅 The Maker's date Edit, loaded the first time a date part is picked (`date-edit.tsx`). It carries the shipped date
 * sheet (`FactSheet`) and its server doors, which have no place in the Maker's first load — the same stand-in shape as
 * `details-lazy.tsx`: the same name and props, its real piece loaded on first render.
 */
export const DateEdit = dynamic(() => import(/* webpackChunkName: "maker-date-edit" */ './date-edit').then((m) => m.DateEdit), { loading: SlotRows });
