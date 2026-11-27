import { CakeSlice, Camera, ChefHat, ClipboardList, Eye, Gamepad2, HandHeart, LayoutGrid, ListChecks, ListMusic, Megaphone, Music, ScanLine, Shapes, Shirt, Star, Timer, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import type { SpecializedToolKey } from '@/lib/specialized-tools';

/** Each Specialized tools tile's icon (kept out of `lib/specialized-tools.ts`, which stays free of UI imports). */
const ICONS: Readonly<Record<SpecializedToolKey, LucideIcon>> = {
  scanner: ScanLine,
  cake_tool: CakeSlice,
  gown_tool: Shirt, // the taxonomy's attire mark (lib/taxonomy-icons.ts)
  song_bank: Music,
  song_desk: ListMusic,
  emcee_script: Megaphone,
  floor_command: ClipboardList,
  run_of_show: Timer,
  headcount: Users,
  live_watch: Eye,
  papic_challenge: Gamepad2,
  plan_3d: Shapes,
  spaces: LayoutGrid,
  // The day-of console's own marks for the same tools (on-the-day/live/[eventId]/_components/event-day-body.tsx TOOL_ICON).
  shot_list: ListChecks,
  issues_log: TriangleAlert,
  production_sheet: ChefHat,
  live_reviews: Star,
  handover: HandHeart,
  seat_plan: LayoutGrid, // the client page's own Seat plan mark
  papic_camera: Camera,
};

export function toolIcon(k: SpecializedToolKey): LucideIcon {
  return ICONS[k];
}
