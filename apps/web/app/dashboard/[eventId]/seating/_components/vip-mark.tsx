/**
 * 🪑 The small VIP mark a VIP table carries in the List and the 2D plan (owner 2026-11-02: "VIP Table/s will be
 * identified" — "shown with a small VIP mark in List, 2D and 3D"; the 3D room draws `plan3d/vip-table-mark.tsx`).
 * Not pressable, so no frame: a word in the brand's accent.
 * 🔒 lib/vip-tables-seat-role-first.test.ts
 */
export function VipMark() {
  return (
    <span
      data-seat-vip-mark=""
      className="font-mono text-[9px] font-bold uppercase leading-none tracking-wider text-mulberry"
    >
      VIP
    </span>
  );
}
