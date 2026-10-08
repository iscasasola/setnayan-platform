'use client';

import type { ReactNode } from 'react';
import { SP_PANE } from '@/lib/maker-stage-room';
import { useStageTool } from './store';

/**
 * 🖌 THE SCENE'S FORMAT, UNDER THE TOOLBAR'S SELECTOR (owner 2026-10-09: *"so it is just Edit | Style | Background |
 * Animate"* — `TOOLBAR-SPEC-2026-10-09.md`). It was Style's own second selector, Look | Background | Arrange: the
 * toolbar's four tools say which part of it is on show now, so there is one selector, not two.
 *
 *   Style       the looks as a carousel of REAL miniatures (`StyleCarousel`), and whatever else the part's look is
 *               (the palette look, a scene of their own's layout, the ticket's style)
 *   Background  Background ▾ · the five colours · Gallery ▸ · Upload ◆ (`StageBackground`)
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
export function StageStyle({ look, background }: { look: ReactNode; background: ReactNode; arrange?: ReactNode }) {
  const tool = useStageTool();
  const on = tool === 'bg' && background ? 'bg' : 'look';
  return (
    <div className={SP_PANE} data-stage-style={on}>
      {on === 'bg' ? background : look}
    </div>
  );
}
