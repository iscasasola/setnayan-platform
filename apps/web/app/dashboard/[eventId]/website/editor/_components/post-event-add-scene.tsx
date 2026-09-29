'use client';

import type { ComponentProps } from 'react';
import { POST_EVENT_PRESETS } from '@/lib/post-event-presets';
import { SceneTemplatePicker } from './scene-template-picker';

type PickerProps = ComponentProps<typeof SceneTemplatePicker>;

/**
 * 🎞 POST EVENT'S OWN "+" — the scene sheet with its twelve presets (owner
 * 2026-09-25), each ◆ Pro and placed in the draft at once (Apply asks for Pro).
 *
 * ⚡ Its own module so the presets' words travel with it, loaded when the Post
 * Event stage first draws its "+" (`scene-styles-lazy.tsx` → `PostEventAddScene`),
 * never in the Maker's first load (`scripts/check-maker-js-budget.mjs`).
 */
export function PostEventAddScene({
  presets,
  ...picker
}: Omit<PickerProps, 'presets'> & { presets: Omit<NonNullable<PickerProps['presets']>, 'items'> }) {
  return <SceneTemplatePicker {...picker} presets={{ items: POST_EVENT_PRESETS, ...presets }} />;
}
