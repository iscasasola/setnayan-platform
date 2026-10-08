'use client';

import { isValidElement, type ComponentProps, type ReactNode } from 'react';
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
    const { part: _p, arrange, ...rest } = props;
    return <StageStyle {...rest} arrange={asStageArrange(arrange)} rows />;
  }
  const { part: _p, ...rest } = props;
  return <StageArrange {...rest} />;
}

/**
 * The work area hands Style its shipped Arrange (`SceneArrangeTab`, with the same writes); the redraw draws
 * those SAME props as the prototype's rows (`StageArrange`) — so the first-load work area builds one Arrange,
 * not two. Anything else passes through.
 */
function asStageArrange(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  const p = node.props as Partial<ComponentProps<typeof StageArrange>> & { at?: number; of?: number };
  if (typeof p.onMode !== 'function' || typeof p.onUp !== 'function') return node;
  return (
    <StageArrange
      openBrowse={p.openBrowse ?? true}
      mode={p.mode ?? 'auto'}
      isVisible={p.isVisible ?? true}
      hasContent={p.hasContent ?? true}
      pending={p.pending ?? false}
      onMode={p.onMode}
      onEye={p.onEye ?? (() => {})}
      at={p.at ?? 1}
      of={p.of ?? 1}
      canUp={p.canUp ?? false}
      canDown={p.canDown ?? false}
      onUp={p.onUp}
      onDown={p.onDown ?? (() => {})}
      alignRow={p.alignRow ?? null}
      removeForm={p.removeForm ?? null}
    />
  );
}
