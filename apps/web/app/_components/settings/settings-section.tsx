'use client';

/**
 * settings-section.tsx — 🧭 SETTINGS V2'S TWO SHARED PARTS (owner 2026-11-13, *"one setting shell approved"*; prototype
 * `prototypes/approved_2026-11-13/settings-shell-fable.html` v3, § 2 and build notes § 13).
 *
 *   · `SettingsSection` — the ONE section heading every settings screen uses (the shipped `home-k2`: small grey caps,
 *     space above, no box round the section). It replaces the seven local heading styles (`GROUP`, `ClusterHead`,
 *     `sn-eye`, centred caps between rules …). The rows under it stay the shipped `FormRows` / `FormRow` / `OpensRow` /
 *     `ChosenRow` / `TypedRow` / `PickMenu`.
 *   · `SettingsSaveState` — the ONE save seat, in the risen screen's head (`MenuSettingsButton state=`): nothing at rest,
 *     "Saving…" the moment a save starts, "Saved ✓" for two seconds, "Not saved" in red (the reason stays on the row
 *     itself). The screen never resets and never closes on a save.
 */
import { useEffect, useState, type ReactNode } from 'react';

export function SettingsSection({ title, data, children }: { title: string; data?: string; children: ReactNode }) {
  return (
    <section aria-label={title} data-settings-section={data ?? ''}>
      <p className="home-k2 !mt-[18px]">{title}</p>
      {children}
    </section>
  );
}

/** What a settings screen's last save did. `idle` draws nothing. */
export type SettingsSave = 'idle' | 'saving' | 'saved' | 'failed';

/** How long "Saved ✓" stays in the head before the seat goes quiet. */
export const SETTINGS_SAVED_MS = 2000;

export function SettingsSaveState({ state }: { state: SettingsSave }) {
  const [shown, setShown] = useState<SettingsSave>(state);
  useEffect(() => {
    setShown(state);
    if (state !== 'saved') return;
    const t = window.setTimeout(() => setShown('idle'), SETTINGS_SAVED_MS);
    return () => window.clearTimeout(t);
  }, [state]);
  const words = shown === 'saving' ? 'Saving…' : shown === 'saved' ? 'Saved ✓' : shown === 'failed' ? 'Not saved' : '';
  return (
    <span
      role="status"
      aria-live="polite"
      data-settings-save={shown}
      className={`text-[12.5px] ${shown === 'failed' ? 'font-semibold text-danger-700' : 'text-ink/60'}`}
    >
      {words}
    </span>
  );
}
