'use client';

import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { MAKER_BAR_APPLY, MAKER_BAR_ICON } from '@/lib/maker-phone-room';

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
 *
 * 🔘 `bar` — THE MAKER BAR'S ICONS (owner 2026-10-04, *"apply icon · undo icon ·
 * exit icon"*): a 44 × 44 icon on every width, named by `aria-label`; 'apply' is
 * the filled wine circle (`MAKER_BAR_APPLY`). Without it, the word-and-icon
 * button the rest of the app uses.
 */
export function DraftButton({
  label,
  icon,
  primary = false,
  wordFrom,
  phone,
  bar,
  disabled,
  disabledReason,
  onClick,
  name,
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
  /** 📱 Show the word only from this width. */
  wordFrom?: 'md';
  /** 🔘 The Maker bar's 44 px icon ('icon'), or its filled Apply ('apply'). */
  bar?: 'icon' | 'apply';
  /** The accessible name, when it says more than `label` ("Apply 3 changes"). */
  name?: string;
  disabled: boolean;
  disabledReason: string;
  onClick: () => void;
}) {
  const said = name ?? label;
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={said}
        title={disabled ? `${said} — ${disabledReason}` : said}
        data-bar-item={phone ? label : undefined}
        className={
          bar
            ? `${bar === 'apply' ? MAKER_BAR_APPLY : MAKER_BAR_ICON} ${phone ? phone.width : ''}`
            : `${
                primary
                  ? 'button-primary sn-press inline-flex h-10 min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px]'
                  : 'sn-press inline-flex h-10 min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:text-ink/35 disabled:hover:bg-transparent'
              } ${phone ? `${phone.width} max-md:justify-center ${phone.word ? 'max-md:px-3' : 'max-md:px-0'}` : ''}`
        }
      >
        {bar ? (
          icon
        ) : (
          <>
            {phone?.word ? <span className="hidden md:inline-flex">{icon}</span> : icon}
            <span className={wordFrom === 'md' ? 'hidden md:inline' : phone?.word ? 'truncate' : undefined}>{label}</span>
          </>
        )}
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
