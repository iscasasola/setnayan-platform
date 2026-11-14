/**
 * 🧑‍💼 THE AVATAR'S ADMIN-OF-ADMIN SCREENS — the frame and the row they share.
 *
 * Owner, 14 Nov 2026: *"Yes, queue the builds"* — the approved drawing is `Setnayan-specs`
 * `prototypes/admin_five_tabs_2026-11-13/admin.html` (`page('switches' …)` · `page('business' …)` ·
 * `page('email-delivery' …)` · `page('secrets' …)`). Each of those screens rises from the avatar sheet with the
 * word-only `Admin · <page> ▾` picker (the shell's `AdminPinnedRow`, avatar branch) and no ⚙.
 *
 *  · `AvatarScreen` — the 760 column every screen sits in. Each page names itself at zero pixels with its own
 *    `PageMasthead` (the console starts at its content, `admin-page-starts-at-its-content.test.ts`).
 *  · `SettingRow` — the drawing's `fr()`: a name with its ⓘ (T17 — everything explanatory lives in the ⓘ), at most ONE
 *    short line under it, and the control or the value at the right. It sits inside `TemplateRows` (one hairline
 *    between rows). Unlike `TemplateRow` its name never truncates, because the ⓘ's popover hangs from it.
 *  · `ConfirmLines` — the drawing's confirm step, as the body of the house `ConfirmDialog`: ✓ what happens, ✗ what does
 *    not, and who is told. Never "Are you sure?" without the consequence.
 *
 * Server-safe: no hooks. The ⓘ is the one shared client piece.
 */
import type { ReactNode } from 'react';

import { InfoTip } from '@/app/_components/info-tip';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';

/** The page names itself with its own `<PageMasthead title="…" />` (a literal, so the masthead guard can read it). */
export function AvatarScreen({ children, data }: { children: ReactNode; data: string }) {
  return (
    <div data-avatar-screen={data} className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-1 sm:px-6">
      {children}
    </div>
  );
}

export function SettingRow({
  name,
  tip,
  line,
  right,
  id,
  data,
  below,
}: {
  name: string;
  /** What the ⓘ beside the name says. */
  tip?: ReactNode;
  /** ONE short line under the name — where it stands. */
  line?: ReactNode;
  /** The control, the value, or a chip. */
  right?: ReactNode;
  id?: string;
  data?: string;
  /** A control that needs the whole width (a picker), drawn under the name. */
  below?: ReactNode;
}) {
  return (
    <li id={id} data-setting-row={data ?? name} className="scroll-mt-28 py-2.5">
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="min-w-0 flex-1 basis-48">
          {tip ? (
            <InfoTip label={name} align="start" labelClassName="text-[15px] font-semibold leading-tight text-ink">
              {tip}
            </InfoTip>
          ) : (
            <b className="block text-[15px] font-semibold leading-tight text-ink">{name}</b>
          )}
          {line ? <span className={`mt-0.5 block ${TEMPLATE_SUBLINE}`}>{line}</span> : null}
        </span>
        {right ? <span className="flex flex-none flex-wrap items-center justify-end gap-2">{right}</span> : null}
      </div>
      {below ? <div className="mt-2">{below}</div> : null}
    </li>
  );
}

/** A value shown at a row's right, read-only. `null` = it could not be read — never a blank, never a 0. */
export function SettingValue({ children, muted = false }: { children: ReactNode | null; muted?: boolean }) {
  if (children === null) {
    return (
      <span className="text-[14px] font-semibold" style={{ color: 'rgb(var(--color-warn))' }} title="Couldn’t read this — not the same as none">
        —
      </span>
    );
  }
  return <span className={`text-[14px] ${muted ? TEMPLATE_SUBLINE : 'font-semibold text-ink'}`}>{children}</span>;
}

export function ConfirmLines({ what = [], not = [], who }: { what?: readonly string[]; not?: readonly string[]; who?: string }) {
  return (
    <span className="block space-y-1.5 text-left">
      {what.map((w) => (
        <span key={w} className="flex gap-2">
          <span aria-hidden className="text-[rgb(var(--color-ok))]">✓</span>
          <span>{w}</span>
        </span>
      ))}
      {not.map((n) => (
        <span key={n} className="flex gap-2">
          <span aria-hidden className="text-[rgb(var(--color-danger))]">✗</span>
          <span>{n}</span>
        </span>
      ))}
      {who ? <span className={`block pt-1 ${TEMPLATE_SUBLINE}`}>Who it reaches: {who}</span> : null}
    </span>
  );
}
