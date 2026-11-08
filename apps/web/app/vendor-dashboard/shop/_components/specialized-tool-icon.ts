import { ClipboardList, Eye, Gamepad2, ListMusic, Megaphone, Music, ScanLine, Shapes, Timer, Users, type LucideIcon } from 'lucide-react';
import type { SpecializedToolKey } from '@/lib/specialized-tools';

/** Each Specialized tools tile's icon (kept out of `lib/specialized-tools.ts`, which stays free of UI imports). */
const ICONS: Readonly<Record<SpecializedToolKey, LucideIcon>> = {
  scanner: ScanLine,
  song_bank: Music,
  song_desk: ListMusic,
  emcee_script: Megaphone,
  floor_command: ClipboardList,
  run_of_show: Timer,
  headcount: Users,
  live_watch: Eye,
  papic_challenge: Gamepad2,
  plan_3d: Shapes,
};

export function toolIcon(k: SpecializedToolKey): LucideIcon {
  return ICONS[k];
}
