"use client";

import { useMemo, useState, useTransition } from "react";
import type { Capture, ReelTemplate } from "@/lib/db/types";
import { enqueuePersonalReelAction } from "../actions";

interface Props {
  eventId: string;
  slug: string;
  templates: ReelTemplate[];
  captures: Pick<
    Capture,
    "capture_id" | "type" | "captured_at" | "r2_thumbnail_key" | "duration_seconds"
  >[];
}

const FEEL_BADGE: Record<ReelTemplate["feel_category"], string> = {
  bridgerton_feel: "Bridgerton",
  taylor_swift_feel: "Eras",
  mj_feel: "MJ",
  jazz: "Jazz",
  sunday_morning: "Sunday",
  hip_hop: "Hip-Hop",
};

export function ReelBuilder({ eventId, slug, templates, captures }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState<string | null>(
    templates[0]?.template_id ?? null,
  );
  const template = useMemo(
    () => templates.find((t) => t.template_id === templateId) ?? null,
    [templates, templateId],
  );
  const [duration, setDuration] = useState<number>(
    Math.min(15, template?.duration_max_s ?? 15),
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const selectedCount = selected.size;
  const minD = template?.duration_min_s ?? 1;
  const maxD = template?.duration_max_s ?? 30;

  const onPickTemplate = (id: string) => {
    setTemplateId(id);
    const next = templates.find((t) => t.template_id === id);
    if (next) {
      setDuration((d) => Math.min(Math.max(d, next.duration_min_s), next.duration_max_s));
    }
  };

  const toggleCapture = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  };

  const onRender = () => {
    if (!templateId) return setError("Pick a template first.");
    if (selectedCount < 1) return setError("Select at least one photo or clip.");
    setError(null);
    start(async () => {
      const r = await enqueuePersonalReelAction({
        event_id: eventId,
        template_id: templateId,
        selected_capture_ids: Array.from(selected),
        duration_s: duration,
        slug,
      });
      if (!r.ok) setError(r.error);
      // ok branch redirects.
    });
  };

  if (templates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule-strong bg-surface px-6 py-12 text-center text-[13px] text-ink-soft">
        No templates available right now. Check back shortly.
      </div>
    );
  }

  if (captures.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule-strong bg-surface px-6 py-12 text-center text-[13px] text-ink-soft">
        We don&apos;t have any photos or clips tagged with you yet. Check the gallery
        once paparazzi tag your QR through the night.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-4">
        <section>
          <p className="meta-label mb-2">Template</p>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => {
              const active = t.template_id === templateId;
              return (
                <button
                  key={t.template_id}
                  type="button"
                  onClick={() => onPickTemplate(t.template_id)}
                  className={`flex flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-[var(--accent)] outline outline-2 outline-[var(--accent)]"
                      : "border-rule-strong hover:border-ink"
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-label-tight text-ink-faint">
                    {FEEL_BADGE[t.feel_category]}
                  </span>
                  <span className="text-[13px] font-medium text-ink">{t.display_name}</span>
                  <span className="text-[10px] text-ink-soft">
                    {t.duration_min_s}–{t.duration_max_s}s · 9:16
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="meta-label mb-2">
            Length · {duration}s ({minD}–{maxD})
          </p>
          <input
            type="range"
            min={minD}
            max={maxD}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </section>

        <section className="rounded-2xl border border-rule bg-surface px-4 py-3 text-[12px] text-ink-soft">
          <p className="font-medium text-ink">Heads-up</p>
          <ul className="mt-1.5 list-disc pl-4">
            <li>1–5 photos or clips per reel</li>
            <li>9:16 vertical, 1080×1920, H.264</li>
            <li>Render takes 30–90 seconds</li>
          </ul>
        </section>

        {error && (
          <p className="rounded-xl border border-[var(--accent)] bg-surface px-3 py-2 text-[12px] text-[var(--accent-deep)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onRender}
          disabled={pending || !templateId || selectedCount === 0}
          className="btn-primary text-[13px] disabled:opacity-50"
        >
          {pending
            ? "Enqueuing…"
            : `Render reel (${selectedCount}/5)${template ? ` · ${template.display_name}` : ""}`}
        </button>
      </aside>

      <section>
        <p className="meta-label mb-2">
          Pick photos or clips · {selectedCount}/5 selected
        </p>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {captures.map((c) => {
            const isSelected = selected.has(c.capture_id);
            const order = isSelected ? Array.from(selected).indexOf(c.capture_id) + 1 : null;
            return (
              <li key={c.capture_id}>
                <button
                  type="button"
                  onClick={() => toggleCapture(c.capture_id)}
                  className={`relative aspect-square w-full overflow-hidden rounded-2xl border transition ${
                    isSelected
                      ? "border-[var(--accent)] outline outline-2 outline-[var(--accent)]"
                      : "border-rule-strong hover:border-ink"
                  }`}
                  aria-pressed={isSelected}
                >
                  <CapturePreview capture={c} />
                  {c.type === "clip" && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                      ▶ 5s
                    </span>
                  )}
                  {order != null && (
                    <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                      {order}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function CapturePreview({
  capture,
}: {
  capture: Pick<Capture, "type" | "r2_thumbnail_key">;
}) {
  return (
    <div
      aria-hidden
      className="flex h-full w-full items-center justify-center text-2xl text-ink-faint"
      style={{
        background:
          capture.type === "clip"
            ? "linear-gradient(135deg, var(--page-bg-soft), #e8e3d8)"
            : "linear-gradient(135deg, var(--surface-soft), var(--page-bg-soft))",
      }}
    >
      {capture.type === "clip" ? "▶" : "◇"}
    </div>
  );
}
