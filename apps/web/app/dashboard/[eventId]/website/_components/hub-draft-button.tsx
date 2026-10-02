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
  wordFrom,
  phone,
  disabled,
  disabledReason,
  onClick,
}: {
  /**
   * 📱 The Maker's one-row phone bar (owner 2026-10-02): this button's phone
   * width (`MAKER_BAR_PHONE`, lib/maker-phone-room.ts). On a phone a worded
   * button drops its icon and keeps its word; the "why it is off" ⓘ steps
   * aside (the button's own label and title still say it) — no third control.
   */
  phone?: { width: string; word?: boolean };
  label: string;
  icon: ReactNode;
  primary?: boolean;
  /** 📱 Show the word only from this width (the Maker's phone bar draws Undo as its icon). */
  wordFrom?: 'md';
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
        title={disabled ? `${label} — ${disabledReason}` : label}
        data-bar-item={phone ? label : undefined}
        className={`${
          primary
            ? 'button-primary sn-press inline-flex h-10 min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px]'
            : 'sn-press inline-flex h-10 min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:text-ink/35 disabled:hover:bg-transparent'
        } ${phone ? `${phone.width} max-md:justify-center ${phone.word ? 'max-md:px-3' : 'max-md:px-0'}` : ''}`}
      >
        {phone?.word ? <span className="hidden md:inline-flex">{icon}</span> : icon}
        <span className={wordFrom === 'md' ? 'hidden md:inline' : phone?.word ? 'truncate' : undefined}>{label}</span>
      </button>
      {disabled ? (
        <span className={phone ? 'hidden md:inline-flex' : 'inline-flex'}>
          <InfoTip label="" ariaLabel={`Why ${label} is off`} align="end">
            {disabledReason}
          </InfoTip>
        </span>
      ) : null}
    </span>
  );
}
