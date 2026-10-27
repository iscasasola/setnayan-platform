'use client';

/**
 * hub-tools-pane.tsx — Admin › Categories › Hub tools (admin supplier slice, owner 2026-10-28; prototype
 * `prototypes/admin_supplier_slice_2026-10-28/` cats.png). Per category: the tool switches from the ONE shared library
 * and the default scan mode.
 *
 * 🔑 A SAVE NEVER RESETS THE SCREEN. Every switch and the scan pick save in place through `setCategoryHubTools`
 * (a result, never a redirect) and the line under the list says "Saved ✓" — or what went wrong, with the switch put
 * back. The category itself is the shipped `NavPick` dropdown, drawn by the page.
 */
import { useState, useTransition } from 'react';
import { SwitchRow } from '@/app/_components/form-row';
import { InfoTip } from '@/app/_components/info-tip';
import { SCAN_MODES, type HubToolRecord, type ScanMode } from '@/lib/hub-tools';
import type { StudioActionResult } from '../actions';

export type HubToolsPaneProps = {
  categoryId: string;
  categoryLabel: string;
  /** The ACTIVE tool records (`hub_tools`) — each one of the eight templates. */
  library: readonly HubToolRecord[];
  tools: readonly string[];
  scan: ScanMode;
  source: 'saved' | 'seed' | 'fallback';
  /** The save. Absent in the lab, where a press answers "Saved ✓ (lab)" and nothing leaves the page. */
  save?: (formData: FormData) => Promise<StudioActionResult>;
};

const SOURCE_WORDS: Record<HubToolsPaneProps['source'], string> = {
  saved: 'Saved by Setnayan.',
  seed: 'The approved starting set (28 Oct) — nobody has changed it yet.',
  fallback: 'This category is not in the approved starting set, so it starts with the basics.',
};

export function HubToolsPane({ categoryId, categoryLabel, library, tools, scan, source, save }: HubToolsPaneProps) {
  const [on, setOn] = useState<ReadonlySet<string>>(() => new Set(tools));
  const [mode, setMode] = useState<ScanMode>(scan);
  const [line, setLine] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const commit = (nextOn: ReadonlySet<string>, nextMode: ScanMode, undo: () => void) => {
    setLine(null);
    const fd = new FormData();
    fd.set('category_id', categoryId);
    for (const t of library) if (nextOn.has(t.key)) fd.append('tool', t.key);
    fd.set('scan_default', nextMode);
    start(async () => {
      if (!save) {
        setLine({ ok: true, text: 'Saved ✓ (lab — nothing left this page)' });
        return;
      }
      try {
        const res = await save(fd);
        if (res.ok) setLine({ ok: true, text: res.message });
        else {
          undo();
          setLine({ ok: false, text: res.error });
        }
      } catch {
        undo();
        setLine({ ok: false, text: 'Couldn’t save — nothing changed. Try again.' });
      }
    });
  };

  const flip = (key: string, next: boolean) => {
    const before = on;
    const after = new Set(on);
    if (next) after.add(key);
    else after.delete(key);
    setOn(after);
    commit(after, mode, () => setOn(before));
  };

  return (
    <section aria-label={`Hub tools · ${categoryLabel}`} data-hub-tools={categoryId}>
      <p className="mt-2 max-w-[90ch] text-[14px] text-ink/70">
        <InfoTip label={`What a booked ${categoryLabel} supplier gets in their Hub.`} align="start">
          Switch tools on or off — no build needed. Every tool is one of eight shared templates (Checklist · Per-person sheet · Live timeline · Counter · Ordered list · Plan · Media · Log). {SOURCE_WORDS[source]} The supplier-side Hub that draws these tools is
          built next; it reads exactly these switches.
        </InfoTip>
      </p>

      <div className="mt-3 grid gap-x-8 sm:grid-cols-2" data-hub-tool-list="">
        {library.map((t) => (
          <SwitchRow
            key={t.key}
            name={t.label}
            on={on.has(t.key)}
            disabled={pending}
            onChange={(next) => flip(t.key, next)}
            attrs={{ 'data-hub-tool': t.key, 'data-hub-template': t.template }}
          />
        ))}
      </div>

      <div className="mt-4 flex min-h-[52px] max-w-xl items-center gap-3 border-t border-ink/10 pt-3">
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-ink">Scan default</span>
          <span className="block text-xs text-ink/70">The supplier can change it per event.</span>
        </span>
        <label className="sr-only" htmlFor={`scan-${categoryId}`}>
          Scan default
        </label>
        <select
          id={`scan-${categoryId}`}
          value={mode}
          disabled={pending}
          data-hub-scan=""
          onChange={(e) => {
            const before = mode;
            const next = e.target.value as ScanMode;
            setMode(next);
            commit(on, next, () => setMode(before));
          }}
          className="sn-press-ring h-10 min-h-10 w-[200px] rounded-full border border-ink/15 bg-white px-3.5 text-[14px] font-medium text-ink dark:bg-raised"
        >
          {SCAN_MODES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm ${line?.ok === false ? 'text-danger-700' : 'text-success-700'}`} data-hub-line="">
        {pending ? 'Saving…' : (line?.text ?? '')}
      </p>
    </section>
  );
}
