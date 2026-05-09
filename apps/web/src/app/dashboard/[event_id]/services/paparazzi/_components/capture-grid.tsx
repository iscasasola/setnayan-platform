"use client";

import { useMemo, useState, useTransition } from "react";
import type { CaptureWithTags, PaparazziGalleryFilter } from "@/lib/db/types";
import { bulkHideCapturesAction, bulkUnhideCapturesAction } from "../actions";

interface Props {
  eventId: string;
  captures: CaptureWithTags[];
  filter: PaparazziGalleryFilter;
  showHidden: boolean;
  emptyHint: string;
}

export function CaptureGrid({ eventId, captures, filter, showHidden, emptyHint }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allSelectedAreHidden = useMemo(
    () =>
      selectedIds.length > 0 &&
      selectedIds.every(
        (id) => captures.find((c) => c.capture_id === id)?.hidden_by_couple_at,
      ),
    [selectedIds, captures],
  );

  if (captures.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule-strong bg-surface px-6 py-12 text-center text-[13px] text-ink-soft">
        {emptyHint}
      </div>
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const onHide = () => {
    if (selectedIds.length === 0) return;
    setError(null);
    start(async () => {
      const r = await bulkHideCapturesAction(eventId, selectedIds, "Bulk hide from gallery review");
      if (!r.ok) setError(r.error);
      else clearSelection();
    });
  };
  const onUnhide = () => {
    if (selectedIds.length === 0) return;
    setError(null);
    start(async () => {
      const r = await bulkUnhideCapturesAction(eventId, selectedIds);
      if (!r.ok) setError(r.error);
      else clearSelection();
    });
  };

  return (
    <>
      {selectedIds.length > 0 && (
        <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 rounded-2xl border border-rule-strong bg-surface px-4 py-2.5 shadow-sm lg:-mx-8 lg:px-6">
          <p className="text-[12px] text-ink-soft">
            {selectedIds.length} selected
            {filter === "untagged" ? " · untagged batch" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="btn-ghost text-[12px]"
              disabled={pending}
            >
              Clear
            </button>
            {showHidden || allSelectedAreHidden ? (
              <button
                type="button"
                onClick={onUnhide}
                className="btn-default text-[12px]"
                disabled={pending}
              >
                Unhide
              </button>
            ) : (
              <button
                type="button"
                onClick={onHide}
                className="btn-primary text-[12px]"
                disabled={pending}
              >
                Hide from public
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rule bg-surface px-4 py-2 text-[12px] text-[var(--accent-deep)]">
          {error}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {captures.map((c) => {
          const isSelected = selected.has(c.capture_id);
          const isHidden = !!c.hidden_by_couple_at;
          const isClip = c.type === "clip";
          return (
            <li key={c.capture_id}>
              <button
                type="button"
                onClick={() => toggle(c.capture_id)}
                className={`group relative aspect-square w-full overflow-hidden rounded-2xl border transition ${
                  isSelected
                    ? "border-[var(--accent)] outline outline-2 outline-[var(--accent)]"
                    : "border-rule-strong"
                } ${isHidden ? "opacity-60" : ""}`}
                aria-pressed={isSelected}
              >
                <CaptureThumbnail capture={c} />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] text-white">
                  <span>
                    {new Date(c.captured_at).toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {isClip && <span aria-label="5-second clip">▶ 5s</span>}
                    {c.flash_used && <span aria-label="flash">⚡</span>}
                    <span aria-label={`${c.tags_count} tags`}>{c.tags_count}/10</span>
                  </span>
                </div>
                {isHidden && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                    Hidden
                  </span>
                )}
                {c.moderation_status === "flagged" && (
                  <span className="absolute right-2 top-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium text-white">
                    Flagged
                  </span>
                )}
                {isSelected && (
                  <span className="absolute right-2 bottom-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CaptureThumbnail({ capture }: { capture: CaptureWithTags }) {
  // r2_thumbnail_key is wired in 0012, but the upload pipeline that populates
  // it is V1.5 (native app). Until then, render a solid placeholder so the
  // grid layout, selection UX, and overlay chrome are real.
  const initials = capture.type === "clip" ? "▶" : "◇";
  return (
    <div
      aria-hidden
      className="flex h-full w-full items-center justify-center text-2xl font-light text-ink-faint"
      style={{
        background:
          capture.type === "clip"
            ? "linear-gradient(135deg, var(--page-bg-soft), #e8e3d8)"
            : "linear-gradient(135deg, var(--surface-soft), var(--page-bg-soft))",
      }}
    >
      {initials}
    </div>
  );
}
