"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  PAPARAZZI_GALLERY_FILTERS,
  PAPARAZZI_GALLERY_FILTER_LABELS,
  type CaptureType,
  type PaparazziGalleryFilter,
} from "@/lib/db/types";

interface Props {
  filter: PaparazziGalleryFilter;
  typeNarrow: CaptureType | "all";
  showHidden: boolean;
  counts: { all: number; untagged: number; hidden: number };
}

export function FilterPills({ filter, typeNarrow, showHidden, counts }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.push(qs ? `?${qs}` : "?");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PAPARAZZI_GALLERY_FILTERS.map((f) => {
        const active = filter === f;
        const count =
          f === "untagged" ? counts.untagged : f === "chronological" ? counts.all : null;
        return (
          <button
            key={f}
            type="button"
            onClick={() =>
              setParam({
                filter: f === "chronological" ? null : f,
                type: f === "type" ? typeNarrow : null,
              })
            }
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
              active
                ? "bg-ink text-white"
                : "border border-rule-strong bg-surface text-ink-soft hover:text-ink"
            }`}
          >
            {PAPARAZZI_GALLERY_FILTER_LABELS[f]}
            {count != null && count > 0 ? (
              <span className={`ml-1.5 ${active ? "opacity-70" : "text-ink-faint"}`}>
                {count}
              </span>
            ) : null}
          </button>
        );
      })}

      {filter === "type" && (
        <div className="ml-1 flex gap-1 rounded-full border border-rule-strong bg-surface p-0.5">
          {(["all", "photo", "clip"] as const).map((t) => {
            const active = typeNarrow === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setParam({ type: t === "all" ? null : t })}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  active ? "bg-ink text-white" : "text-ink-soft"
                }`}
              >
                {t === "all" ? "All" : t === "photo" ? "Photos" : "Clips"}
              </button>
            );
          })}
        </div>
      )}

      <span className="ml-auto inline-flex items-center gap-2 text-[12px] text-ink-soft">
        <input
          id="show-hidden"
          type="checkbox"
          checked={showHidden}
          onChange={(e) => setParam({ showHidden: e.target.checked ? "1" : null })}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
        <label htmlFor="show-hidden">
          Show hidden{counts.hidden > 0 ? ` (${counts.hidden})` : ""}
        </label>
      </span>
    </div>
  );
}
