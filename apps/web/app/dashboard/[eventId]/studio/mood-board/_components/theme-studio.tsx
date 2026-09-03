'use client';

/**
 * The one piece of state the Overall Theme card and the theme gallery have to
 * share: the feeling + setting read out of the couple's own description
 * (2026-09-03).
 *
 * 🔑 WHY A WRAPPER AND NOT A PROP DRILL FROM page.tsx: `page.tsx` is a SERVER
 * component, so it cannot hold `useState`. Reading the description happens in
 * the card and has to land in the gallery, which sits below it — the smallest
 * honest home for that handoff is this client boundary, which renders both
 * children exactly as page.tsx did and adds nothing else. Both were already
 * client components, and every prop below is either serialisable data or a
 * server-action reference, so nothing about the payload changes.
 *
 * ⚠ The jump is the WHOLE payoff of reading the description. Filling empty
 * palette/reception slots is real but quiet; landing the couple on the themes
 * their sentence actually describes is the thing the owner asked for when
 * they said the field should "help me generate a theme".
 */

import { useState } from 'react';
import type { RolePalette } from '@/lib/mood-board';
import type { ReceptionDesign } from '@/lib/reception-scene';
import type { ApplyMode, ThemeTemplatePage } from '@/lib/moodboard-templates';
import type { ThemeTextReading } from '@/lib/theme-text-intent';
import { ThemeCard, type ThemeIntentJump } from './theme-card';
import { TemplateGallery } from './template-gallery';

type ApplyResult = {
  mode: ApplyMode;
  filledPaletteRoles: string[];
  filledReceptionZones: string[];
  filledInspirationSlots: string[];
  filledThemeName: boolean;
  filledThemeDescription: boolean;
  nothingToFill: boolean;
};

type Props = {
  eventId: string;
  initialName: string | null;
  initialDescription: string | null;
  /** hasChosenMajors(palette) — see template-gallery.tsx's `alreadyChosen`. */
  alreadyChosenMajors: boolean;
  palette: RolePalette;
  receptionDesign: ReceptionDesign;
  saveThemeAction: (eventId: string, theme: { name: string; description: string }) => Promise<void>;
  readAction: (text: string) => Promise<ThemeTextReading>;
  applyIntentAction: (
    eventId: string,
    selection: unknown,
  ) => Promise<{
    filledPaletteRoles: string[];
    filledReceptionZones: string[];
    styleFamily: string | null;
    nothingToFill: boolean;
  }>;
  fetchTemplatesAction: (input: {
    styleFamily: string;
    moodTag: string;
    limit?: number;
    offset?: number;
  }) => Promise<ThemeTemplatePage>;
  applyTemplateAction: (
    eventId: string,
    templateId: string,
    mode?: ApplyMode,
  ) => Promise<ApplyResult>;
};

export function ThemeStudio({
  eventId,
  initialName,
  initialDescription,
  alreadyChosenMajors,
  palette,
  receptionDesign,
  saveThemeAction,
  readAction,
  applyIntentAction,
  fetchTemplatesAction,
  applyTemplateAction,
}: Props) {
  const [jumpTo, setJumpTo] = useState<ThemeIntentJump | null>(null);

  return (
    <>
      <ThemeCard
        eventId={eventId}
        initialName={initialName}
        initialDescription={initialDescription}
        palette={palette}
        receptionDesign={receptionDesign}
        saveAction={saveThemeAction}
        readAction={readAction}
        applyIntentAction={applyIntentAction}
        onJump={setJumpTo}
      />
      <TemplateGallery
        eventId={eventId}
        fetchAction={fetchTemplatesAction}
        applyAction={applyTemplateAction}
        jumpTo={jumpTo}
        alreadyChosen={alreadyChosenMajors}
      />
    </>
  );
}
