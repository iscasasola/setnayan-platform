'use client';

import {
  MOTION_GRID,
  MOTION_SIZES,
  MOTION_SIZE_LABEL,
  MOTION_SPEEDS,
  MOTION_SPEED_LABEL,
  motionArrow,
  motionDirLabel,
  motionDirName,
  withMotionFx,
  type MotionFx,
  type MotionSpeed,
} from '@/lib/motion-effects';
import { IRow } from './inspector-kit';
import { PickMenu } from './pick-menu';

/**
 * 🎛 ONE END OF A MOTION — Fade ▾ · Move ▾ · Size ▾ · Blur ▾ (owner 2026-10-04,
 * DECISION_LOG "MOTION = FOUR INDEPENDENT EFFECTS + SPEED", "MOVE IS PICKED ON A
 * SQUARE", "THE MOTION SHEET RUNS IN THE ORDER A GUEST SEES IT"). Shared by a
 * part's Motion (`PartAnimateTab`) and a scene's Animate (`SceneAnimateTab`), so
 * both layers speak one vocabulary.
 *
 * Each effect is ONE dropdown with its None; they combine. Move ▾ is a dropdown
 * too — closed it reads the pick ("↗ From lower-left"), open it is the 3×3 grid
 * of ARROWS showing the way the thing travels, the centre ● None (owner: *"move
 * can be just arrows"* · *"drop down shows the 3x3 grid?"* → yes). It is the
 * shared `PickMenu` with `grid`, so it opens, closes and gives way to another
 * open dropdown exactly as every other one does.
 *
 * A pick only CALLS `onChange` with the whole new set (`withMotionFx`); opening
 * a dropdown writes nothing.
 */
export function MotionFxRows({
  end,
  fx,
  onChange,
  settleShown = false,
}: {
  end: 'in' | 'out';
  fx: MotionFx | null | undefined;
  onChange: (next: MotionFx | null) => void;
  /** Size ▾ offers the shipped "Settle back" — only while it is the stored one. */
  settleShown?: boolean;
}) {
  const set = (part: keyof MotionFx, value: string | boolean | null) => onChange(withMotionFx(fx, part, value));
  const row = 'min-h-11 min-w-0 flex-1 lg:min-h-9';
  const sizes = [...MOTION_SIZES, ...(settleShown || fx?.size === 'settle' ? (['settle'] as const) : [])];
  const verb = end === 'in' ? 'comes in' : 'goes out';
  return (
    <>
      <IRow label="Fade" data={`${end}-fade`}>
        <PickMenu
          label={`Fade as it ${verb}`}
          dataAttr={`data-motion-${end}-fade`}
          value={fx?.fade ? 'fade' : 'none'}
          options={[
            { key: 'fade', label: 'Fade' },
            { key: 'none', label: 'None' },
          ]}
          onPick={(v) => set('fade', v === 'fade')}
          className={row}
        />
      </IRow>
      <IRow label="Move" data={`${end}-move`}>
        <PickMenu
          label={end === 'in' ? 'Comes in from' : 'Goes out to'}
          dataAttr={`data-motion-${end}-move`}
          grid
          value={fx?.move ?? 'none'}
          buttonText={fx?.move ? motionDirLabel(fx.move, end) : 'None'}
          options={MOTION_GRID.map((dir) =>
            dir
              ? { key: dir, label: motionDirName(dir, end), icon: motionArrow(dir, end) }
              : { key: 'none', label: 'None', icon: '●' },
          )}
          onPick={(v) => set('move', v === 'none' ? null : v)}
          className={row}
        />
      </IRow>
      <IRow label="Size" data={`${end}-size`}>
        <PickMenu
          label={`Size as it ${verb}`}
          dataAttr={`data-motion-${end}-size`}
          value={fx?.size ?? 'none'}
          options={[...sizes.map((v) => ({ key: v, label: MOTION_SIZE_LABEL[v] })), { key: 'none', label: 'None' }]}
          onPick={(v) => set('size', v === 'none' ? null : v)}
          className={row}
        />
      </IRow>
      <IRow label="Blur" data={`${end}-blur`}>
        <PickMenu
          label={`Blur as it ${verb}`}
          dataAttr={`data-motion-${end}-blur`}
          value={fx?.blur ? 'blur' : 'none'}
          options={[
            { key: 'blur', label: 'Blur' },
            { key: 'none', label: 'None' },
          ]}
          onPick={(v) => set('blur', v === 'blur')}
          className={row}
        />
      </IRow>
    </>
  );
}

/** Speed ▾ — Fast · Regular · Gentle. `null` = Regular. */
export function MotionSpeedRow({
  value,
  onPick,
  data,
  label = 'Speed',
}: {
  value: Exclude<MotionSpeed, 'regular'> | null | undefined;
  onPick: (v: Exclude<MotionSpeed, 'regular'> | null) => void;
  data: string;
  label?: string;
}) {
  return (
    <IRow label="Speed" data={data}>
      <PickMenu
        label={label}
        dataAttr={`data-motion-${data}`}
        value={value ?? 'regular'}
        options={MOTION_SPEEDS.map((v) => ({ key: v, label: MOTION_SPEED_LABEL[v] }))}
        onPick={(v) => onPick(v === 'regular' ? null : (v as Exclude<MotionSpeed, 'regular'>))}
        className="min-h-11 min-w-0 flex-1 lg:min-h-9"
      />
    </IRow>
  );
}
