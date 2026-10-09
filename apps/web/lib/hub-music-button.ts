/**
 * lib/hub-music-button.ts — THE GUEST'S MUSIC BUTTON HAS THREE DESIGNS.
 *
 * Owner, 2026-10-08, round 5 (DECISION_LOG "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E "The music button"), verbatim: *"music icon can be that
 * animated moving bars. can we make them choose 2 more designs?"* · *"the bars can change colors on their palette
 * as well … it should adapt to their palette as well"*.
 *
 *   bars    — the shipped one, and the default: three bars rising and falling while the song plays
 *   record  — a small disc with grooves that turns while playing
 *   note    — a note with soft sound rings that pulse out while playing
 *
 * It MOVES ONLY WHILE THE SONG PLAYS and rests in a clear still before the first tap (a phone never starts sound
 * on its own — the still is the honest invitation). Its colour is the couple's Accent, as the eyebrows wear it.
 *
 * STORED on the hero row beside the main background — `config_json.music.button` — no migration. ABSENT = bars:
 * `bars` itself is never stored, so an event that never chose reads byte for byte as before.
 *
 * Pure and tiny. Held by `lib/the-music-button-has-three-designs.test.ts`.
 */
export const HUB_MUSIC_KEY = 'music';
export const HUB_MUSIC_BUTTONS = ['bars', 'record', 'note'] as const;
export type HubMusicButton = (typeof HUB_MUSIC_BUTTONS)[number];
export const HUB_MUSIC_BUTTON_DEFAULT: HubMusicButton = 'bars';
export const HUB_MUSIC_BUTTON_LABEL: Readonly<Record<HubMusicButton, string>> = { bars: 'Moving bars', record: 'Record', note: 'Note' };

/** What `config_json.music` may hold. */
export type HubMusic = { button: Exclude<HubMusicButton, 'bars'> };

/** Anything → the stored value, or null (nothing chosen, the default, or junk). Drops rather than repairs. */
export function sanitizeHubMusic(raw: unknown): HubMusic | null {
  const button = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { button?: unknown }).button : null;
  return button === 'record' || button === 'note' ? { button } : null;
}

/** What a pick writes into the draft: the stored value, or `null` — the default takes the key off. */
export function hubMusicButtonWrite(design: HubMusicButton): HubMusic | null {
  return design === 'bars' ? null : { button: design };
}

/** The design a row's `config_json` asks for (the hero row's) — the default when it asks for none. */
export function hubMusicButton(config: unknown): HubMusicButton {
  const music = config && typeof config === 'object' && !Array.isArray(config) ? (config as Record<string, unknown>)[HUB_MUSIC_KEY] : null;
  return sanitizeHubMusic(music)?.button ?? HUB_MUSIC_BUTTON_DEFAULT;
}
