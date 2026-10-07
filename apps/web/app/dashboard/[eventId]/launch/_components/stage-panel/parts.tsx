'use client';

import type { ComponentProps } from 'react';
import { StageArrange } from './stage-arrange';
import { StageStyle } from './stage-style';

/**
 * 🧭 ONE LAZY DOOR for the redrawn Stages panel's pieces the work area lays out
 * (`editor-shell.tsx` — a first-load module). Each `dynamic()` stand-in is bytes in
 * the Maker's first load (`scripts/check-maker-js-budget.mjs`), so the two pieces
 * share ONE (`details-lazy.tsx` `StagePanelPart`), in the `maker-details` chunk.
 */
export type StagePanelPartProps =
  | ({ part: 'style' } & ComponentProps<typeof StageStyle>)
  | ({ part: 'arrange' } & ComponentProps<typeof StageArrange>);

export function StagePanelPart(props: StagePanelPartProps) {
  if (props.part === 'style') {
    const { part: _p, ...rest } = props;
    return <StageStyle {...rest} />;
  }
  const { part: _p, ...rest } = props;
  return <StageArrange {...rest} />;
}
