/**
 * availability-choices.ts — the Availability ▾ options every dropdown on Admin › Categories draws (plan step 2): the
 * seven from lib/availability-styles.ts, each with its label small, then Not set ('' ). A plain module (not 'use
 * client') so the server panels can hand it to a client control as data.
 */
import { AVAILABILITY_NOT_SET, AVAILABILITY_STYLES } from '@/lib/availability-styles';

export type AvailabilityChoice = { key: string; label: string; hint: string };

export const AVAILABILITY_SEVEN: readonly AvailabilityChoice[] = AVAILABILITY_STYLES.map((s) => ({ key: s.value, label: s.name, hint: s.label }));

export const AVAILABILITY_CHOICES: readonly AvailabilityChoice[] = [...AVAILABILITY_SEVEN, { key: '', label: AVAILABILITY_NOT_SET, hint: 'Not decided yet' }];
