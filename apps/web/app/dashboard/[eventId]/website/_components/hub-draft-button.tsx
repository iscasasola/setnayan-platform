'use client';

import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * `DraftButton` — ONE of the toolbar's always-visible Restore / Undo / Apply
 * controls (`hub-draft-bar.tsx`, `HubDraftToolbar`). Split into its OWN
 * module for the same reason `hub-draft-field.tsx` is: `hub-draft-bar.tsx`
 * imports the server action `hubDraftAction`, which imports `lib/hub-look-gate.ts`,
 * which is `'server-only'` — a directive Next's bundler strips at build time
 * but that a bare `tsx --test` run cannot resolve at all (`server-only` is not
 * an npm dependency; Next supplies it as a build-time shim). A test that wants
 * to actually MOUNT this button (not just read its source, the way
 * `hub-draft-wiring.test.ts` reads a server action's) has to import it from a
 * module with no path back to `server-only`.
 *
 * Never hidden — a disabled button keeps its place and gains an adjacent
 * `InfoTip` that says why, exactly the pairing `maker-play-menu.tsx` uses for
 * "Play this scene" with nothing selected.
 */
export function DraftButton({
  label,
  icon,
  primary = false,
  disabled,
  disabledReason,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  primary?: boolean;
  disabled: boolean;
  disabledReason: string;
  onClick: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        title={label}
        className={
          primary
            ? 'button-primary sn-press inline-flex h-10 min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px]'
            : 'sn-press inline-flex h-10 min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:text-ink/35 disabled:hover:bg-transparent'
        }
      >
        {icon}
        <span>{label}</span>
      </button>
      {disabled ? (
        <InfoTip label="" ariaLabel={`Why ${label} is off`} align="end">
          {disabledReason}
        </InfoTip>
      ) : null}
    </span>
  );
}
