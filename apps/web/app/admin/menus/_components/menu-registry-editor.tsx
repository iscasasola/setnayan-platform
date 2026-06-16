'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Pencil, RotateCcw, Eye, EyeOff, Upload, X, ImageIcon } from 'lucide-react';
import { DynamicIcon } from '@/app/_components/nav/dynamic-icon';
import type { NavAccountScope, ResolvedNavSlot } from '@/lib/nav-registry-types';
import {
  resetSlot,
  setSlotHidden,
  setSlotLabel,
  setSlotLucideIcon,
  setSlotNoIcon,
  uploadSlotIcon,
} from '../actions';

/**
 * /admin/menus editor — the admin-facing source of truth for the name + icon of
 * every menu/route. Grouped by scope → area; per row: rename, pick a Lucide
 * glyph, upload a custom image, hide, or reset to default. All edits go through
 * the server actions (single-admin + audit).
 */

const SCOPE_ORDER: NavAccountScope[] = ['customer', 'vendor', 'admin', 'public', 'shared'];
const SCOPE_LABEL: Record<NavAccountScope, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  admin: 'Admin',
  public: 'Public',
  shared: 'Shared',
};

export function MenuRegistryEditor({
  slots,
  iconNames,
}: {
  slots: ResolvedNavSlot[];
  iconNames: string[];
}) {
  const scopes = useMemo(
    () => SCOPE_ORDER.filter((s) => slots.some((slot) => slot.scope === s)),
    [slots],
  );
  const [activeScope, setActiveScope] = useState<NavAccountScope>(scopes[0] ?? 'customer');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slots.filter((s) => {
      if (s.scope !== activeScope) return false;
      if (!q) return true;
      return (
        s.label.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q) ||
        (s.route ?? '').toLowerCase().includes(q)
      );
    });
  }, [slots, activeScope, query]);

  const byArea = useMemo(() => {
    const m = new Map<string, ResolvedNavSlot[]>();
    for (const s of visible) {
      if (!m.has(s.area)) m.set(s.area, []);
      m.get(s.area)!.push(s);
    }
    return Array.from(m.entries());
  }, [visible]);

  const overriddenCount = slots.filter((s) => s.isOverridden).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {scopes.map((s) => {
          const count = slots.filter((slot) => slot.scope === s).length;
          const active = s === activeScope;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveScope(s)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                  : 'border-ink/10 bg-cream text-ink/70 hover:bg-ink/5'
              }`}
            >
              {SCOPE_LABEL[s]} <span className="text-ink/40">· {count}</span>
            </button>
          );
        })}
        <div className="ml-auto text-xs text-ink/50">
          {overriddenCount} of {slots.length} customized
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, route, or key…"
        className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm"
      />

      <div className="space-y-6">
        {byArea.map(([area, rows]) => (
          <section key={area} className="space-y-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
              {area} <span className="text-ink/30">· {rows.length}</span>
            </h2>
            <div className="divide-y divide-ink/5 overflow-hidden rounded-xl border border-ink/10 bg-cream">
              {rows.map((slot) => (
                <SlotRow key={slot.key} slot={slot} iconNames={iconNames} />
              ))}
            </div>
          </section>
        ))}
        {byArea.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/50">
            No slots match “{query}”.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SlotRow({ slot, iconNames }: { slot: ResolvedNavSlot; iconNames: string[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(slot.label);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState('');

  const filteredIcons = useMemo(() => {
    const q = iconQuery.trim().toLowerCase();
    const list = q ? iconNames.filter((n) => n.toLowerCase().includes(q)) : iconNames;
    return list.slice(0, 160);
  }, [iconNames, iconQuery]);

  function saveLabel() {
    const v = labelDraft;
    startTransition(async () => {
      await setSlotLabel(slot.key, v);
      setEditing(false);
    });
  }

  function pickIcon(name: string) {
    startTransition(async () => {
      await setSlotLucideIcon(slot.key, name);
      setPickerOpen(false);
      setIconQuery('');
    });
  }

  return (
    <div className={`p-3 sm:px-4 ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          title="Change icon"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink hover:border-terracotta/40 hover:text-terracotta"
        >
          {slot.icon.kind === 'none' ? (
            <span className="text-[9px] uppercase tracking-wide text-ink/35">none</span>
          ) : (
            <DynamicIcon icon={slot.icon} className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveLabel();
                  if (e.key === 'Escape') {
                    setEditing(false);
                    setLabelDraft(slot.label);
                  }
                }}
                placeholder={slot.default.label}
                className="w-full max-w-xs rounded-md border border-ink/20 bg-white px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={saveLabel}
                className="inline-flex items-center gap-1 rounded-md bg-mulberry px-2 py-1 text-xs font-medium text-cream hover:bg-mulberry-600"
              >
                <Check className="h-3.5 w-3.5" /> Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setLabelDraft(slot.label);
                }}
                className="rounded-md px-2 py-1 text-xs text-ink/50 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLabelDraft(slot.label);
                setEditing(true);
              }}
              className="group flex items-center gap-1.5 text-left"
            >
              <span
                className={`text-sm font-medium ${slot.isHidden ? 'text-ink/40 line-through' : 'text-ink'}`}
              >
                {slot.label}
              </span>
              <Pencil className="h-3 w-3 text-ink/0 transition group-hover:text-ink/40" />
            </button>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink/45">
            <span className="font-mono">{slot.route ?? '—'}</span>
            <span className="text-ink/25">·</span>
            <span className="font-mono text-ink/35">{slot.key}</span>
            {slot.isOverridden ? (
              <span className="rounded-full bg-terracotta/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-terracotta-700">
                custom
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={slot.isHidden ? 'Show in menu' : 'Hide from menu'}
            onClick={() => startTransition(async () => void (await setSlotHidden(slot.key, !slot.isHidden)))}
            className="rounded-md p-1.5 text-ink/45 hover:bg-ink/5 hover:text-ink"
          >
            {slot.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          {slot.isOverridden ? (
            <button
              type="button"
              title="Reset to default"
              onClick={() => startTransition(async () => void (await resetSlot(slot.key)))}
              className="rounded-md p-1.5 text-ink/45 hover:bg-ink/5 hover:text-ink"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {pickerOpen ? (
        <div className="mt-3 rounded-lg border border-ink/10 bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              autoFocus
              value={iconQuery}
              onChange={(e) => setIconQuery(e.target.value)}
              placeholder="Filter icons…"
              className="w-full rounded-md border border-ink/15 bg-cream px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => startTransition(async () => void (await setSlotNoIcon(slot.key)))}
              className="shrink-0 rounded-md border border-ink/15 px-2 py-1 text-xs text-ink/60 hover:bg-ink/5"
            >
              No icon
            </button>
            <button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                setIconQuery('');
              }}
              className="shrink-0 rounded-md p-1 text-ink/40 hover:text-ink"
              aria-label="Close icon picker"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-12">
            {filteredIcons.map((name) => {
              const isCurrent = slot.icon.kind === 'lucide' && slot.icon.lucideName === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => pickIcon(name)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border text-ink hover:border-terracotta/40 hover:text-terracotta ${
                    isCurrent ? 'border-terracotta bg-terracotta/10 text-terracotta' : 'border-transparent'
                  }`}
                >
                  <DynamicIcon
                    icon={{ kind: 'lucide', lucideName: name, customRef: null, customUrl: null }}
                    className="h-4 w-4"
                    strokeWidth={1.75}
                  />
                </button>
              );
            })}
          </div>

          <form
            action={uploadSlotIcon}
            className="mt-3 flex items-center gap-2 border-t border-ink/10 pt-3"
          >
            <input type="hidden" name="slot_key" value={slot.key} />
            <ImageIcon className="h-4 w-4 text-ink/40" aria-hidden />
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              required
              className="block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-terracotta/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-terracotta-700 hover:file:bg-terracotta/15"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink/15 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
          </form>
          <p className="mt-1.5 text-[10px] text-ink/40">
            SVG recommended (recolors with the menu). PNG/JPEG/WebP also work, max 512&nbsp;KB. Uploaded
            images don’t tint with active/inactive state.
          </p>
        </div>
      ) : null}
    </div>
  );
}
