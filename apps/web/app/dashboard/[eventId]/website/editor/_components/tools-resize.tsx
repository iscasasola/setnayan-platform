'use client';

/* ── THE TOOLS COLUMN'S WIDTH ──────────────────────────────────────────────
   Default 340px (what it was); 280–560px, and never so wide that the canvas
   drops below CANVAS_MIN_W — the page being edited must stay usable. */
export const INSPECTOR_DEFAULT_W = 340;
export const INSPECTOR_MIN_W = 280;
export const INSPECTOR_MAX_W = 560;
export const CANVAS_MIN_W = 420;
export function clampToolsWidth(want: number, viewport: number, navWidth: number): number {
  const room = viewport - navWidth - CANVAS_MIN_W;
  return Math.round(Math.max(INSPECTOR_MIN_W, Math.min(INSPECTOR_MAX_W, room, want)));
}
export type ToolsResize = { width: number; onPointerDown: (e: React.PointerEvent) => void };

/** The tools column's left edge — the navigator's separator, mirrored. Desktop only. */
export function ToolsResizeHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize the tools"
      onPointerDown={onPointerDown}
      className="absolute inset-y-0 left-0 hidden w-1.5 cursor-col-resize hover:bg-terracotta/30 lg:block"
    />
  );
}
