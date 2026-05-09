"use client";

import { useState, useTransition } from "react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import { csvRowSchema, type CsvRow } from "@/lib/schemas/guest";
import { bulkImportGuestsAction } from "../actions";

interface Props {
  onClose: () => void;
}

const REQUIRED_COLUMNS = [
  "first_name",
  "last_name",
  "side",
  "group_category",
  "role",
] as const;

const OPTIONAL_COLUMNS = [
  "household",
  "plus_one_allowed",
  "email",
  "mobile",
] as const;

interface ParsedRow {
  raw: Record<string, string>;
  data?: CsvRow;
  error?: string;
}

export function CsvImportDialog({ onClose }: Props) {
  const params = useParams<{ event_id: string }>();
  const eventId = params.event_id;
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    setRows(null);
    if (file.size > 1_500_000) {
      setError("File too large (max ~1.5MB).");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        if (result.errors.length > 0) {
          setError(`CSV parse error: ${result.errors[0]?.message ?? "Unknown error"}`);
          return;
        }
        if (result.data.length === 0) {
          setError("CSV is empty.");
          return;
        }
        if (result.data.length > 200) {
          setError("Maximum 200 rows per import. Please split your file.");
          return;
        }
        const parsed: ParsedRow[] = result.data.map((raw) => {
          const candidate: Record<string, unknown> = { ...raw };
          // Coerce empties to undefined
          for (const k in candidate) {
            if (typeof candidate[k] === "string" && (candidate[k] as string).trim() === "") {
              candidate[k] = undefined;
            }
          }
          const v = csvRowSchema.safeParse(candidate);
          if (v.success) return { raw, data: v.data };
          return {
            raw,
            error: v.error.issues
              .map((iss) => `${iss.path.join(".")} — ${iss.message}`)
              .join("; "),
          };
        });
        setRows(parsed);
      },
      error: (err) => setError(err.message),
    });
  }

  const validRows = rows?.filter((r) => r.data) ?? [];
  const invalidRows = rows?.filter((r) => !r.data) ?? [];

  function commit() {
    if (validRows.length === 0) return;
    setSubmitError(null);
    startTransition(async () => {
      const r = await bulkImportGuestsAction(eventId, validRows.map((v) => v.data));
      if (!r.ok) {
        setSubmitError(r.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 backdrop-blur-sm lg:items-center lg:p-6">
      <div
        role="dialog"
        aria-label="Import CSV"
        className="flex h-[100dvh] w-full max-w-none flex-col bg-surface shadow-tayo-lg lg:h-auto lg:max-h-[85vh] lg:max-w-[720px] lg:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4 lg:px-7 lg:py-5">
          <div>
            <h3 className="font-serif text-2xl font-medium tracking-tight lg:text-[28px]">
              Import guests from CSV
            </h3>
            <p className="mt-1 text-[13px] text-ink-soft">
              Required columns: <span className="font-mono">{REQUIRED_COLUMNS.join(", ")}</span>.
              Optional: <span className="font-mono">{OPTIONAL_COLUMNS.join(", ")}</span>. Max 200 rows.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-page-bg-soft hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-7">
          {!rows && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-rule-strong bg-page-bg-soft px-6 py-12 text-center transition hover:border-ink">
              <span className="text-3xl text-ink-soft" aria-hidden>⤓</span>
              <span className="text-sm font-medium text-ink">Choose a CSV file</span>
              <span className="text-[12px] text-ink-soft">
                or drag and drop. Header row required.
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          )}

          {error && (
            <div className="mt-4 rounded-md bg-rsvp-declined-soft px-4 py-3 text-[13px] text-rsvp-declined-ink">
              {error}
            </div>
          )}

          {rows && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Valid rows" value={validRows.length} accent="rsvp-attending" />
                <Stat label="Invalid rows" value={invalidRows.length} accent="rsvp-declined" />
                <Stat label="Total parsed" value={rows.length} />
              </div>

              <div className="overflow-hidden rounded-2xl border border-rule">
                <div
                  className="grid items-center gap-3 border-b border-rule bg-page-bg-soft px-4 py-2.5 font-mono text-[10px] uppercase tracking-label-wide text-ink-faint"
                  style={{ gridTemplateColumns: "1fr 1fr 0.7fr 0.8fr 0.6fr 1fr" }}
                >
                  <div>First name</div>
                  <div>Last name</div>
                  <div>Side</div>
                  <div>Group</div>
                  <div>Role</div>
                  <div>Status</div>
                </div>
                <ul className="max-h-[320px] overflow-y-auto">
                  {rows.slice(0, 100).map((r, i) => (
                    <li
                      key={i}
                      className={`grid items-center gap-3 border-b border-rule px-4 py-2.5 text-[13px] last:border-0 ${
                        r.error ? "bg-rsvp-declined-soft/40" : ""
                      }`}
                      style={{ gridTemplateColumns: "1fr 1fr 0.7fr 0.8fr 0.6fr 1fr" }}
                    >
                      <div className="truncate">{r.raw.first_name ?? "—"}</div>
                      <div className="truncate">{r.raw.last_name ?? "—"}</div>
                      <div className="text-ink-soft">{r.raw.side ?? "—"}</div>
                      <div className="text-ink-soft">{r.raw.group_category ?? "—"}</div>
                      <div className="text-ink-soft">{r.raw.role ?? "guest"}</div>
                      <div className="font-mono text-[11px]">
                        {r.error ? (
                          <span className="text-rsvp-declined-ink">{r.error}</span>
                        ) : (
                          <span className="text-rsvp-attending">OK</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {rows.length > 100 && (
                <p className="meta-label text-center">
                  Showing first 100 rows · all {rows.length} will be imported
                </p>
              )}
            </div>
          )}

          {submitError && (
            <div className="mt-4 rounded-md bg-rsvp-declined-soft px-4 py-3 text-[13px] text-rsvp-declined-ink">
              {submitError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-rule bg-surface-soft px-5 py-4 lg:px-7">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          {rows && validRows.length > 0 && (
            <button
              type="button"
              onClick={commit}
              disabled={pending}
              className="btn-accent"
            >
              {pending ? "Importing…" : `Import ${validRows.length} guest${validRows.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "rsvp-attending" | "rsvp-declined";
}) {
  const c =
    accent === "rsvp-attending"
      ? "text-rsvp-attending"
      : accent === "rsvp-declined"
        ? "text-rsvp-declined"
        : "text-ink";
  return (
    <div className="rounded-2xl border border-rule bg-surface px-3 py-3">
      <div className="meta-label">{label}</div>
      <div className={`mt-1 font-serif text-3xl font-medium leading-none ${c}`}>{value}</div>
    </div>
  );
}
