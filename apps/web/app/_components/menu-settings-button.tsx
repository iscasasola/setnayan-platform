'use client';

/**
 * menu-settings-button.tsx — EVERY MENU'S ⚙: one component, one spot, one sheet frame.
 *
 * Owner, 2026-10-26: *"Settings button must all be located at ideally the same spot per menu for consistency"*;
 * approved 2026-10-27 (`prototypes/settings_per_menu_2026-10-26/` § 1, PLAN.md row A). The shape is the one
 * Memories already shipped — `ActionButton tone="neutral" iconOnly icon={Settings}`, 44 px — at the right end of
 * the menu's FIRST CONTROL ROW (the caller marks that row `data-first-row`). It opens a `Sheet` titled
 * "<Menu> settings" whose first line is the menu's one short line, the shared sentence inside its ⓘ
 * (`MENU_SETTINGS_TIP`, `lib/menu-settings.ts`).
 *
 *   · CONTROLLED — the caller owns `open` (Memories steps its thumb row aside while the sheet is up); the sheet's
 *     rows are the caller's `children`, the shipped controls, each saving in place.
 *   · `data-menu-settings="<menu>"` marks the door; `data-menu-settings-sheet="<menu>"` the sheet body — the hooks
 *     `every-menu-has-one-settings-button.test.ts` counts.
 *   · Drawn into <body> while open: the dashboard's page wrapper captures `position: fixed`.
 *
 * Home never mounts this — Home's ⚙ is the cover's, and it opens Event Settings.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Settings } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { MENU_SETTINGS_TIP, SETTINGS_ENTRY, type SettingsMenu } from '@/lib/menu-settings';

export function MenuSettingsButton({
  menu,
  open,
  onOpenChange,
  tour,
  children,
}: {
  menu: SettingsMenu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 🔦 The spotlight tour's anchor on the ⚙ (`data-tour`), when the menu's tour points at it. */
  tour?: string;
  /** The sheet's rows — the shipped controls. */
  children: ReactNode;
}) {
  const entry = SETTINGS_ENTRY[menu];
  const headingId = useId();
  return (
    <>
      <span data-menu-settings={menu} className="inline-flex shrink-0">
        <ActionButton
          tone="neutral"
          iconOnly
          icon={Settings}
          label={entry.sheet}
          onClick={() => onOpenChange(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          tour={tour}
        />
      </span>
      {open ? (
        <OnBody>
          <Sheet open onClose={() => onOpenChange(false)} labelledById={headingId} title={entry.sheet} wide>
            <div data-menu-settings-sheet={menu}>
              <p className="px-4 pt-3 text-[12.5px] text-ink/60" data-menu-settings-line="">
                <InfoTip label={entry.line} align="start">
                  {entry.tip ?? MENU_SETTINGS_TIP}
                </InfoTip>
              </p>
              {children}
            </div>
          </Sheet>
        </OnBody>
      ) : null}
    </>
  );
}

function OnBody({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
}
