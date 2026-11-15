// ============================================================================
// The Preparation item kinds — Task / Meeting / Payment — shared by BOTH the
// couple add sheet (prep-item-controls.tsx) and the supplier add sheet
// (vendor-dashboard/bookings/_components/vendor-prep-add.tsx), each of which
// lists them in ONE PickMenu dropdown (design template 14 Nov 2026, rule 4:
// "picks ▾"). The segmented PrepKindPicker this file used to draw was retired
// with the supplier sheet's move onto the template (batch T03) — nothing drew
// it any more. Kept here (couple folder) as the single source of truth.
// ============================================================================

import { ListPlus, Users, Wallet, type LucideIcon } from 'lucide-react';

export type PrepKind = 'task' | 'meeting' | 'payment';

/** The three kinds, in order — the couple's add sheet lists them in ONE dropdown (`prep-item-controls.tsx`). */
export const PREP_KIND_OPTIONS: ReadonlyArray<{ value: PrepKind; label: string; Icon: LucideIcon }> = [
  { value: 'task', label: 'Task', Icon: ListPlus },
  { value: 'meeting', label: 'Meeting', Icon: Users },
  { value: 'payment', label: 'Payment', Icon: Wallet },
];
