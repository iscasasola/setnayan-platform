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
 *
 * 🖨 THE DOOR ALONE (owner 2026-10-31, on the Prints page's ⚙: *"the ⚙ on Prints opens Prints' own settings"*): with no
 * `children`, the button is the door only — the caller's own sheet answers `open` (Prints' `StudioPrintSettings`, whose
 * fields must stay mounted while it is shut, so it can never be this frame's children, which mount only while open).
 *
 * ⤴ RISE FULL SCREEN (Build 5 · Lane A, owner 2026-11-10 *"fullscreen everything"* — every page ⚙ rises full screen
 * instead of opening a popup; prototype `settings_full_screen_2026-11-10`): with `rise`, the same rows open in the ONE
 * `RiseScreen` — it grows out of the ⚙ you tapped, the bars slide away, ✕ is the exact reverse — headed by the same
 * name, the same one line and the same ⓘ words. One door, one frame per mode; never a second ⚙.
 *
 * 🧭 SETTINGS V2 — ONE SETTINGS SHELL (owner 2026-11-13, *"one setting shell approved"*; prototype
 * `prototypes/approved_2026-11-13/settings-shell-fable.html` v3, § 2 and build notes § 13). Rise is now the ONLY frame:
 * every ⚙ grows full screen out of itself, the boxed sheet over a dimmed page is gone, and the `rise` switch with it.
 * The head carries the ONE save seat (`state`, drawn in the head's action slot — `SettingsSaveState`) and the foot the
 * ONE waiting bar (`thumb` — `SettingsDraftBar`), both passed straight through to `RiseScreen`.
 *   · `inLayer` — the ONE exception, and it is named debt: the supplier's picked client is ALREADY a risen layer, and the
 *     prototype has its ⚙ swap the body in place there (RiseScreen is one level, never a second screen on top). Since main
 *     bf8998a1 (17 Nov) the picked client's ⚙ rises like the rest, so `inLayer` has NO caller today; it is kept for that
 *     in-place swap. `lib/settings-v2-one-shell.test.ts` (1) holds it at zero callers.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Settings } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { MENU_SETTINGS_TIP, SETTINGS_ENTRY, type SettingsMenu } from '@/lib/menu-settings';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { gearText } from '@/app/_components/gear-text';

export function MenuSettingsButton({
  menu,
  open,
  onOpenChange,
  tour,
  cover = false,
  line,
  state,
  thumb,
  inLayer = false,
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
  /** 💾 The ONE save seat — "Saving…" / "Saved ✓" / "Not saved" (`SettingsSaveState`), in the head. */
  state?: ReactNode;
  /** ↺ ✓ The ONE waiting bar in the thumb zone — Undo · Apply (`SettingsDraftBar`); absent when nothing waits. */
  thumb?: ReactNode;
  /** Opened from INSIDE a layer that already rose (the picked client): the sheet, until its in-place swap lands. */
  inLayer?: boolean;
  /** The sheet's rows — the shipped controls. Absent: the door only; the caller draws the sheet `open` names. */
  children?: ReactNode;
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
      {open && children !== undefined && !inLayer ? (
        <RiseScreen
          title={entry.sheet}
          line={line?.line ?? entry.line}
          info={gearText(line?.tip ?? entry.tip ?? MENU_SETTINGS_TIP)}
          actions={state}
          thumb={thumb}
          onClose={() => onOpenChange(false)}
          data={`settings-${menu}`}
        >
          <div data-menu-settings-sheet={menu}>{children}</div>
        </RiseScreen>
      ) : open && children !== undefined ? (
        <OnBody>
          <Sheet open onClose={() => onOpenChange(false)} labelledById={headingId} title={entry.sheet} wide>
            <div data-menu-settings-sheet={menu}>
              <p className="px-4 pt-3 text-[12.5px] text-ink/60" data-menu-settings-line="">
                <InfoTip label={line?.line ?? entry.line} align="start">
                  {gearText(line?.tip ?? entry.tip ?? MENU_SETTINGS_TIP)}
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
