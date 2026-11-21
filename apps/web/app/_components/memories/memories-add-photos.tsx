'use client';

/**
 * ＋ ADD PHOTOS ON THE PAPIC BLOCK — ONE PRESS, THE PICKER AT ONCE (owner 2026-11-20, "memories approved":
 * `prototypes/memories_redesign_2026-11-20/` — *"'Add photos' is the main button; it opens your phone's picker at
 * once"*).
 *
 * NOT A SECOND UPLOADER. The gallery owns the one Add photos sheet and its one handler (`openAdding`); this file is the
 * thin bridge between the Papic block (drawn by the server, inside the card) and that handler:
 *
 *   · `MemoriesAddPhotosButton` — the block's main button. Where adding by hand is open it clicks the gallery's hidden
 *     file input IN THE SAME TAP (the gesture a phone needs to open its picker); where it is off it opens the one sheet,
 *     which is the shipped `UploadsOpenChoice`, exactly as the thumb row's ＋ does.
 *   · `useHandedFiles` — the shipped uploader (`AddToLibrary`) takes the files that tap picked, ONCE, and runs them
 *     through its own `onPick` (the claim, the cost check, the rows) — the same path as its own "Choose photos".
 *
 * Outside the gallery (a lab, the studio) the context is absent: the button draws nothing and nothing is handed.
 */
import { createContext, useContext } from 'react';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

export type MemoriesAddPhotos = {
  /** The block's press: the picker at once (open) or the one sheet (off). */
  pickNow: () => void;
  /** Files the block's press picked, waiting for the uploader — taken once. */
  handed: { files: readonly File[] | null; take: () => readonly File[] | null };
};

export const MemoriesAddPhotosContext = createContext<MemoriesAddPhotos | null>(null);

/** The uploader's side — the picked files, or null when none are waiting (or there is no gallery). */
export function useHandedFiles(): MemoriesAddPhotos['handed'] | null {
  return useContext(MemoriesAddPhotosContext)?.handed ?? null;
}

/** The Papic block's main button — "Add photos". */
export function MemoriesAddPhotosButton() {
  const add = useContext(MemoriesAddPhotosContext);
  if (!add) return null;
  return (
    <ActionButton
      tone="brand"
      main
      icon={<Plus aria-hidden="true" strokeWidth={1.9} />}
      label="Add photos"
      onClick={add.pickNow}
      data-testid="papic-add-photos"
    />
  );
}
