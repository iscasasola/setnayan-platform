"use client";

import { useEffect, useState, useTransition } from "react";
import {
  GROUP_CATEGORIES,
  GROUP_LABELS,
  MEAL_PREFERENCES,
  ROLE_LABELS,
  RSVP_LABELS,
  RSVP_STATUSES,
  SCHEDULE_BLOCKS,
  SCHEDULE_BLOCK_LABELS,
  SIDE_LABELS,
  WEDDING_ROLES,
  WEDDING_SIDES,
  type Guest,
  type Household,
  type ScheduleBlock,
} from "@/lib/db/types";
import { addGuestSchema, type GuestInput } from "@/lib/schemas/guest";
import { addGuestAction, updateGuestAction } from "../actions";

type Mode = { kind: "add" } | { kind: "edit"; guest: Guest };

interface Props {
  mode: Mode;
  households: Household[];
  onClose: () => void;
}

const EMPTY_FORM: GuestInput = {
  first_name: "",
  last_name: "",
  display_name: undefined,
  side: "bride",
  group_category: "family",
  role: "guest",
  plus_one_allowed: false,
  plus_one_name: undefined,
  email: undefined,
  mobile: undefined,
  meal_preference: undefined,
  dietary_restrictions: undefined,
  photo_consent: true,
  invited_to_blocks: ["ceremony", "reception"],
  custom_tags: [],
  household_id: null,
  notes: undefined,
  rsvp_status: "pending",
};

type PlusOneOption = "none" | "tba" | "named";

function plusOneFromForm(form: GuestInput): PlusOneOption {
  if (!form.plus_one_allowed) return "none";
  return form.plus_one_name ? "named" : "tba";
}

export function GuestFormDialog({ mode, households, onClose }: Props) {
  const initial = mode.kind === "edit" ? guestToInput(mode.guest) : EMPTY_FORM;
  const [form, setForm] = useState<GuestInput>(initial);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function update<K extends keyof GuestInput>(key: K, value: GuestInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleBlock(b: ScheduleBlock) {
    const set = new Set(form.invited_to_blocks);
    if (set.has(b)) set.delete(b);
    else set.add(b);
    if (set.size === 0) set.add("ceremony");
    update("invited_to_blocks", Array.from(set));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (form.custom_tags.includes(t)) {
      setTagInput("");
      return;
    }
    update("custom_tags", [...form.custom_tags, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    update(
      "custom_tags",
      form.custom_tags.filter((x) => x !== t),
    );
  }

  function submit(again: boolean) {
    setError(null);
    const validation = addGuestSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    startTransition(async () => {
      const result =
        mode.kind === "add"
          ? await addGuestAction(validation.data)
          : await updateGuestAction({ guest_id: mode.guest.guest_id, ...validation.data });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode.kind === "add" && again) {
        setForm(EMPTY_FORM);
        setTagInput("");
      } else {
        onClose();
      }
    });
  }

  const title = mode.kind === "add" ? "Add a guest" : "Edit guest";
  const subtitle =
    mode.kind === "add"
      ? "Add an individual or a paired entry (couples, parents, sponsors)"
      : "Update this guest's details";

  const plusOne = plusOneFromForm(form);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 backdrop-blur-sm lg:items-center lg:p-6">
      <div
        role="dialog"
        aria-label={title}
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-surface shadow-tayo-lg lg:h-auto lg:max-h-[90vh] lg:max-w-[720px] lg:rounded-[18px]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4 lg:px-8 lg:py-6">
          <div>
            <h3 className="font-serif text-2xl font-medium tracking-tight lg:text-[30px]">{title}</h3>
            <p className="mt-1 font-mono text-[12px] uppercase tracking-label-mid text-ink-soft">
              {subtitle}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          className="flex flex-1 flex-col overflow-y-auto px-5 py-5 lg:px-8 lg:pt-6"
        >
          {/* 2-column grid; full-width rows opt in via lg:col-span-2 */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-[18px] lg:grid-cols-2">
            {/* Row 1 — First name | Last name */}
            <Field label="First name" required>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                required
                placeholder="e.g., Carla"
                className="form-input"
                autoFocus
              />
            </Field>
            <Field label="Last name" required>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
                required
                placeholder="e.g., Mendoza"
                className="form-input"
              />
            </Field>

            {/* Row 2 — Display name | Household */}
            <Field label="Display name (optional)">
              <input
                type="text"
                value={form.display_name ?? ""}
                onChange={(e) => update("display_name", e.target.value || undefined)}
                placeholder='e.g., "Tito Boy & Tita Cora"'
                className="form-input"
              />
            </Field>
            <Field label="Household">
              <select
                value={form.household_id ?? ""}
                onChange={(e) => update("household_id", e.target.value || null)}
                className="form-input"
              >
                <option value="">Solo</option>
                {households.map((h) => (
                  <option key={h.household_id} value={h.household_id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* Row 3 — Side | Group */}
            <Field label="Side" required>
              <select
                value={form.side}
                onChange={(e) => update("side", e.target.value as GuestInput["side"])}
                className="form-input"
              >
                {WEDDING_SIDES.map((s) => (
                  <option key={s} value={s}>
                    {SIDE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Group" required>
              <select
                value={form.group_category}
                onChange={(e) => update("group_category", e.target.value as GuestInput["group_category"])}
                className="form-input"
              >
                {GROUP_CATEGORIES.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
            </Field>

            {/* Row 4 — Role in wedding | Plus-one  (Role stays half-width even with 18 values) */}
            <Field label="Role in wedding" required>
              <select
                value={form.role}
                onChange={(e) => update("role", e.target.value as GuestInput["role"])}
                className="form-input"
              >
                {WEDDING_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Plus-one">
              <select
                value={plusOne}
                onChange={(e) => {
                  const v = e.target.value as PlusOneOption;
                  if (v === "none") {
                    update("plus_one_allowed", false);
                    update("plus_one_name", undefined);
                  } else if (v === "tba") {
                    update("plus_one_allowed", true);
                    update("plus_one_name", undefined);
                  } else {
                    update("plus_one_allowed", true);
                    if (!form.plus_one_name) update("plus_one_name", "");
                  }
                }}
                className="form-input"
              >
                <option value="none">No plus-one</option>
                <option value="tba">Allowed · TBA</option>
                <option value="named">Allowed · named below</option>
              </select>
            </Field>

            {/* Row 5 — Email | Mobile */}
            <Field label="Email">
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value || undefined)}
                placeholder="optional"
                className="form-input"
              />
            </Field>
            <Field label="Mobile">
              <input
                type="tel"
                value={form.mobile ?? ""}
                onChange={(e) => update("mobile", e.target.value || undefined)}
                placeholder="+63 9•• ••• ••••"
                className="form-input"
              />
            </Field>

            {/* Row 6 — Meal | RSVP status */}
            <Field label="Meal">
              <select
                value={form.meal_preference ?? ""}
                onChange={(e) =>
                  update(
                    "meal_preference",
                    (e.target.value || undefined) as GuestInput["meal_preference"],
                  )
                }
                className="form-input"
              >
                <option value="">No selection</option>
                {MEAL_PREFERENCES.map((m) => (
                  <option key={m} value={m}>
                    {m === "no_preference" ? "No preference" : m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="RSVP status">
              <select
                value={form.rsvp_status}
                onChange={(e) => update("rsvp_status", e.target.value as GuestInput["rsvp_status"])}
                className="form-input"
              >
                {RSVP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {RSVP_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>

            {/* Row 7 — Dietary restrictions (full-width) */}
            <Field label="Dietary restrictions" className="lg:col-span-2">
              <input
                type="text"
                value={form.dietary_restrictions ?? ""}
                onChange={(e) => update("dietary_restrictions", e.target.value || undefined)}
                placeholder="None / Vegetarian / Allergies / Long allergy notes"
                className="form-input"
              />
            </Field>

            {/* Row 8 — Photo consent (full-width row, custom 22px checkbox) */}
            <Field label="Photo consent" className="lg:col-span-2">
              <label className="field-checkbox flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.photo_consent}
                  onChange={(e) => update("photo_consent", e.target.checked)}
                />
                <span className="text-[14px] text-ink">
                  Allow this guest to be tagged in the gallery
                </span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-label-wide text-ink-faint">
                  PH DPA
                </span>
              </label>
            </Field>

            {/* Row 9 — Invited to (full-width chip selector) */}
            <Field label="Invited to" className="lg:col-span-2">
              <div className="form-input-row flex flex-wrap items-center gap-1.5">
                {SCHEDULE_BLOCKS.map((b) => {
                  const active = form.invited_to_blocks.includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBlock(b)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                        active
                          ? "bg-ink text-white"
                          : "border border-rule-strong text-ink-soft hover:border-ink hover:text-ink"
                      }`}
                    >
                      {SCHEDULE_BLOCK_LABELS[b]}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Row 10 — Custom tags (full-width) */}
            <Field label="Custom tags" className="lg:col-span-2">
              <div className="form-input-row flex flex-wrap items-center gap-1.5">
                {form.custom_tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-page-bg-soft px-2 py-0.5 text-[11px] font-medium text-ink"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      aria-label={`Remove tag ${t}`}
                      className="text-ink-faint hover:text-ink"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Type and press Enter"
                  className="flex-1 border-none bg-transparent text-[14px] outline-none placeholder:text-ink-faint"
                />
              </div>
            </Field>

            {/* Row 11 — Notes (full-width textarea — 96px) */}
            <Field label="Notes (private to you)" className="lg:col-span-2">
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => update("notes", e.target.value || undefined)}
                rows={3}
                className="form-textarea"
                placeholder="Anything we should remember about this guest"
              />
            </Field>

            {/* Plus-one name — only when "named below" selected; full-width helper row.
                Sits at the bottom of the grid so the field structure above stays clean. */}
            {plusOne === "named" && (
              <Field label="Plus-one name" className="lg:col-span-2">
                <input
                  type="text"
                  value={form.plus_one_name ?? ""}
                  onChange={(e) => update("plus_one_name", e.target.value || undefined)}
                  placeholder="Their name"
                  className="form-input"
                />
              </Field>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-rsvp-declined-soft px-3 py-2 text-[13px] text-rsvp-declined-ink">
              {error}
            </p>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 border-t border-rule bg-surface-soft px-5 py-4 lg:px-7">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          {mode.kind === "add" && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={pending}
              className="btn-default"
            >
              Save &amp; add another
            </button>
          )}
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={pending}
            className="btn-accent"
          >
            {pending ? "Saving…" : mode.kind === "add" ? "Save guest" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Uniform field sizing per work-order spec:
            - height: 46px
            - border-radius: 10px
            - padding: 12px 14px
            - font-size: 14px
            - focus: var(--accent)
            Textarea: same widths/styles, height 96px (only exception).
            Checkbox: custom 22×22 with terracotta fill when checked. */}
      <style jsx>{`
        :global(.form-input),
        :global(.form-input-row) {
          width: 100%;
          height: 46px;
          padding: 12px 14px;
          border: 1px solid var(--rule-strong);
          border-radius: 10px;
          background: var(--surface);
          font-size: 14px;
          color: var(--ink);
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
          line-height: 1.2;
          box-sizing: border-box;
        }
        :global(.form-input:focus),
        :global(.form-input-row:focus-within) {
          border-color: var(--accent);
        }
        :global(.form-textarea) {
          width: 100%;
          height: 96px;
          min-height: 96px;
          padding: 12px 14px;
          border: 1px solid var(--rule-strong);
          border-radius: 10px;
          background: var(--surface);
          font-size: 14px;
          color: var(--ink);
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
          resize: vertical;
          line-height: 1.4;
          box-sizing: border-box;
        }
        :global(.form-textarea:focus) {
          border-color: var(--accent);
        }
        :global(select.form-input) {
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236b6b6b' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 36px;
        }
        :global(.field-checkbox) {
          width: 100%;
          min-height: 46px;
          padding: 12px 14px;
          border: 1px solid var(--rule);
          border-radius: 10px;
          background: var(--surface-soft);
          font-size: 14px;
          color: var(--ink);
          box-sizing: border-box;
          cursor: pointer;
        }
        :global(.field-checkbox input[type="checkbox"]) {
          appearance: none;
          -webkit-appearance: none;
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          border: 1.5px solid var(--rule-strong);
          border-radius: 6px;
          background: var(--surface);
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: all 0.15s;
        }
        :global(.field-checkbox input[type="checkbox"]:checked) {
          background: var(--accent);
          border-color: var(--accent);
        }
        :global(.field-checkbox input[type="checkbox"]:checked::after) {
          content: "✓";
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className ?? ""}`}>
      <label className="meta-label flex items-center gap-1">
        {label}
        {required && <span className="text-accent font-semibold">*</span>}
      </label>
      {children}
    </div>
  );
}

function guestToInput(g: Guest): GuestInput {
  return {
    first_name: g.first_name,
    last_name: g.last_name,
    display_name: g.display_name ?? undefined,
    side: g.side,
    group_category: g.group_category,
    role: g.role,
    plus_one_allowed: g.plus_one_allowed,
    plus_one_name: g.plus_one_name ?? undefined,
    email: g.email ?? undefined,
    mobile: g.mobile ?? undefined,
    meal_preference: g.meal_preference ?? undefined,
    dietary_restrictions: g.dietary_restrictions ?? undefined,
    photo_consent: g.photo_consent,
    invited_to_blocks: g.invited_to_blocks as GuestInput["invited_to_blocks"],
    custom_tags: g.custom_tags,
    household_id: g.household_id,
    notes: g.notes ?? undefined,
    rsvp_status: g.rsvp_status,
  };
}
