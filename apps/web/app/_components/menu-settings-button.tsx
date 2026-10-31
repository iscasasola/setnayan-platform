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
 * 🏠 HOME mounts it too (owner 2026-10-29, *"keep it there"*): `menu="home"`, Event Settings, at the right end of the
 * cover band (`home-settings-gear.tsx`). `cover` draws it in the cover's own ink (`.home-cover-ab`, the glass pill the
 * cover's buttons wear) — same component, same 44 px, only the colour follows the band it sits on.
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
  cover = false,
  line,
  children,
}: {
  menu: SettingsMenu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 🔦 The spotlight tour's anchor on the ⚙ (`data-tour`), when the menu's tour points at it. */
  tour?: string;
  /** Drawn on a coloured cover band (Home): the cover's ink, never the page's (`.home-cover-ab`). */
  cover?: boolean;
  /** The sheet's one line and its ⓘ, when this viewer's sheet holds other rows than the menu's (Home's ⚙ for a helper). */
  line?: { line: string; tip: string };
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
          className={cover ? 'home-cover-ab' : undefined}
        />
      </span>
      {open ? (
        <OnBody>
          <Sheet open onClose={() => onOpenChange(false)} labelledById={headingId} title={entry.sheet} wide>
            <div data-menu-settings-sheet={menu}>
              <p className="px-4 pt-3 text-[12.5px] text-ink/60" data-menu-settings-line="">
                <InfoTip label={line?.line ?? entry.line} align="start">
                  {line?.tip ?? entry.tip ?? MENU_SETTINGS_TIP}
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
