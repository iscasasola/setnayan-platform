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

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 backdrop-blur-sm lg:items-center lg:p-6">
      <div
        role="dialog"
        aria-label={title}
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-surface shadow-tayo-lg lg:h-auto lg:max-h-[90vh] lg:max-w-[640px] lg:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4 lg:px-7 lg:py-5">
          <div>
            <h3 className="font-serif text-2xl font-medium tracking-tight lg:text-[28px]">{title}</h3>
            <p className="mt-1 text-[13px] text-ink-soft">{subtitle}</p>
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
          className="flex flex-1 flex-col overflow-y-auto px-5 py-4 lg:px-7 lg:py-5"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
            <Field label="Display name (optional)">
              <input
                type="text"
                value={form.display_name ?? ""}
                onChange={(e) => update("display_name", e.target.value || undefined)}
                placeholder='e.g., "Tito Boy & Tita Cora" or "Lola Adela"'
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

            <Field label="Role in wedding" required className="lg:col-span-2">
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
                value={form.plus_one_allowed ? (form.plus_one_name ? "named" : "tba") : "none"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "none") {
                    update("plus_one_allowed", false);
                    update("plus_one_name", undefined);
                  } else if (v === "tba") {
                    update("plus_one_allowed", true);
                    update("plus_one_name", undefined);
                  } else {
                    update("plus_one_allowed", true);
                  }
                }}
                className="form-input"
              >
                <option value="none">No plus-one</option>
                <option value="tba">Allowed · TBA</option>
                <option value="named">Allowed · named below</option>
              </select>
            </Field>
            {form.plus_one_allowed && (
              <Field label="Plus-one name">
                <input
                  type="text"
                  value={form.plus_one_name ?? ""}
                  onChange={(e) => update("plus_one_name", e.target.value || undefined)}
                  placeholder="optional"
                  className="form-input"
                />
              </Field>
            )}

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
                    {m.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dietary restrictions">
              <input
                type="text"
                value={form.dietary_restrictions ?? ""}
                onChange={(e) => update("dietary_restrictions", e.target.value || undefined)}
                placeholder="None / Vegetarian / Allergies"
                className="form-input"
              />
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
            <Field label="Photo consent">
              <label className="flex items-center gap-2 px-1 py-2.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={form.photo_consent}
                  onChange={(e) => update("photo_consent", e.target.checked)}
                  className="h-4 w-4"
                />
                Allow this guest to be tagged in the gallery
              </label>
            </Field>

            <Field label="Invited to" className="lg:col-span-2">
              <div className="flex flex-wrap gap-1.5 pt-1">
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

            <Field label="Custom tags" className="lg:col-span-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-rule-strong bg-surface px-2.5 py-2">
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
                  className="flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
                />
              </div>
            </Field>

            <Field label="Notes (private to you)" className="lg:col-span-2">
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => update("notes", e.target.value || undefined)}
                rows={3}
                className="form-input min-h-[80px]"
                placeholder="Anything we should remember about this guest"
              />
            </Field>
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

      {/* form-input utility class */}
      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--rule-strong);
          border-radius: 8px;
          background: var(--surface);
          font-size: 13px;
          color: var(--ink);
          outline: none;
          transition: border 0.15s;
        }
        :global(.form-input:focus) {
          border-color: var(--ink);
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
    <div className={className ?? ""}>
      <label className="meta-label mb-1.5 block">
        {label}
        {required && <span className="ml-0.5 text-rsvp-declined-ink">*</span>}
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
