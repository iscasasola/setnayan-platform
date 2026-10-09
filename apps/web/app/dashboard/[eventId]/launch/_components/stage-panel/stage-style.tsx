'use client';

import type { ReactNode } from 'react';
import { SP_PANE, SP_ROWS, SP_STYLE_PANE } from '@/lib/maker-stage-room';
import { useStageTool } from './store';

/**
 * 🖌 THE SCENE'S FORMAT, UNDER THE TOOLBAR'S SELECTOR (owner 2026-10-09: *"so it is just Edit | Style | Background |
 * Animate"* — `TOOLBAR-SPEC-2026-10-09.md`). It was Style's own second selector, Look | Background | Arrange: the
 * toolbar's four tools say which part of it is on show now, so there is one selector, not two.
 *
 *   Style       the looks as a carousel of REAL miniatures (`StyleCards`) in rows 1–3 — rows 1–2 over the Dress
 *               code's palette row — and, drawn by the toolbar itself in row 4, Colour · Size (`StageLookRow`)
 *   Background  the source ▾ · its choices · the choice's one control · its shape — four rows (`StageBackground`)
 *   Edit        is the toolbar's own (`stage-edit.tsx` — the part's one door, and its place on the page): this body
 *               is under it, kept mounted (a word typed on the RSVP page saves through it) and out of sight.
 *
 * Arrange — On this stage ▾ · Alignment ▾ · Spacing ▾ — is not drawn any more (owner: *"i don't think we need the
 * arrange anymore"*). The stored values are still honoured wherever they are read; `arrange` is still handed over,
 * unread, so the work area's one Format is built the way it was.
 *
 * The bodies are the work area's — built where the scene's canvas and its one draft door live (`editor-shell.tsx`);
 * this only shows the one the toolbar is on. A part with no background of its own never gets here on Background
 * (the tool is grey — `makerPartToolWorks`); if it does, its look is shown rather than a blank.
 */
export function StageStyle({ look, background, rows = false }: { look: ReactNode; background: ReactNode; arrange?: ReactNode; rows?: boolean }) {
  const tool = useStageTool();
  const on = tool === 'bg' && background ? 'bg' : 'look';
  /* 🧱 `rows` (the work area's parts — `parts.tsx`): under Style the body is laid in the toolbar's rows, no scroll up
     and down — the look cards take the rows left to them, a row under them is one row tall (the rule set is the
     toolbar's own, `stage-tools.tsx`, on `data-stage-style-rows`). The bodies that are not the work area's (the
     Reveal, the Camera, the reply pages) keep their own pane. */
  if (rows && on === 'look') {
    return (
      <div className={SP_STYLE_PANE} data-stage-style={on} data-stage-style-rows="">
        {look}
      </div>
    );
  }
  /* 🖼 …and under Background the scene's background is the toolbar's FOUR ROWS (`StageBackground` places each of its
     rows itself): the grid, nothing scrolled. */
  if (rows && on === 'bg') {
    return (
      <div className={`${SP_ROWS} h-full px-[10px]`} data-stage-style={on} data-stage-bg-rows="">
        {background}
      </div>
    );
  }
  return (
    <div className={SP_PANE} data-stage-style={on}>
      {on === 'bg' ? background : look}
    </div>
  );
}
