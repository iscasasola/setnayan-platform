'use client';

/**
 * Booked › Schedule in the Suppliers lab — the REAL Event Day rail (`ScheduleDay`) on the Schedule lab's own day,
 * re-tagged with this lab's booked suppliers (`LAB_SCHEDULE_TAGS`), so the Team rows' call times and this rail read
 * the same moments. Drawn after mount: the rail reads the clock (the Schedule lab's own reason).
 */
import { useEffect, useState } from 'react';
import ScheduleLabClient from '../schedule-lab/schedule-lab-client';
import { scheduleSuppliersFrom } from '@/lib/schedule-suppliers';

const SUPPLIERS = scheduleSuppliersFrom(
  [
    { vendor_id: 'v-seda', vendor_name: 'Seda Vertis North', status: 'contracted', marketplace_vendor_id: null, manual_vendor_id: 'c-seda' },
    { vendor_id: 'v-santuario', vendor_name: 'Santuario de San Vicente de Paul', status: 'contracted', marketplace_vendor_id: 'p-santuario', manual_vendor_id: null },
    { vendor_id: 'v-lumina', vendor_name: 'Lumina Studio', status: 'deposit_paid', marketplace_vendor_id: 'p-lumina', manual_vendor_id: null },
    { vendor_id: 'v-asukal', vendor_name: 'Asukal Cakes', status: 'contracted', marketplace_vendor_id: null, manual_vendor_id: 'c-asukal' },
    { vendor_id: 'v-bituin', vendor_name: 'Bituin Catering', status: 'contracted', marketplace_vendor_id: 'p-bituin', manual_vendor_id: null },
  ],
  new Map([
    ['p-santuario', 'Santuario de San Vicente de Paul'],
    ['p-lumina', 'Lumina Studio'],
    ['p-bituin', 'Bituin Catering'],
  ]),
);

export function LabBookedSchedule({ tags }: { tags: Readonly<Record<string, readonly string[]>> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <ScheduleLabClient bare suppliers={SUPPLIERS} tags={tags} /> : null;
}
