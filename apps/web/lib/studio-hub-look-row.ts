/**
 * lib/studio-hub-look-row.ts — the words of Studio › Prints' "Your Event Hub look" row (`StudioHubLookRow`,
 * studio-prints-settings.tsx). Their own file, so they ride the row's lazy chunk and never the Maker's first load
 * (`MAX_MAKER_FIRST_LOAD_GZIP` — 2026-10-21 the budget was met to the tenth of a kilobyte).
 *
 * 🖨 EVERY PRINT WEARS THE EVENT HUB LOOK — WITH EVENT HUB PRO (owner 2026-10-21: *"shouldn't this mimic the event hub design? and
 * so does the other prints?"* → *"yes wire all, and yes it's Pro"*; `printLookForEvent`, lib/print-hub-look.ts). The row on Studio ›
 * Prints: the diamond owned — a fact; ◆ PRO not owned — the door to the centred note. Its words, once.
 */
export const HUB_LOOK_ROW = {
  name: 'Your Event Hub look',
  owned: 'Every print wears your Event Hub’s colours, fonts and background.',
  free: 'Your prints are plain white. Wear your Event Hub’s colours, fonts and background on paper.',
  door: 'Wear it',
} as const;
export const HUB_LOOK_PRO_NOTE = {
  title: 'Printing in your Event Hub look is Event Hub Pro',
  body: 'With Event Hub Pro every print wears your Event Hub’s colours, fonts and background. Without it, every print stays free in plain white.',
} as const;
