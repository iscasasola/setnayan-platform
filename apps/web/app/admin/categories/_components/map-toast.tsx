'use client';

/**
 * map-toast.tsx — the four-level map's one toast: a dark pill at the foot, "Moved to … · Undo" (🌳 ③b; the app's
 * sn-toast shape). Its own file because it is the map's only thing pinned to the screen's foot, and it holds no text
 * field (lib/every-bottom-input-rides-the-keyboard.test.ts reads a file that pins AND types as a riding row).
 */
export function MapToast({ toast, onUndo }: { toast: { msg: string; undo?: () => void } | null; onUndo: () => void }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      data-toast=""
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full bg-ink py-1.5 pl-4 pr-2 text-[13px] text-cream shadow-lg"
    >
      <span className="[overflow-wrap:anywhere]">{toast.msg}</span>
      {toast.undo ? (
        <button type="button" onClick={onUndo} className="min-h-11 rounded-full bg-cream/20 px-3 font-semibold">
          Undo
        </button>
      ) : null}
    </div>
  );
}
