import { ceremonyMatches, type CeremonyOverlayInput } from '@/lib/chinese-wedding';
import type { DressCodeConfig } from '../dress-code-actions';

/**
 * 👗 THE INC STARTER TEXT — ONE RULE FOR EVERY PLACE A HOST EDITS THE DRESS CODE
 * (owner 2026-10-04, DECISION_LOG "YES TO ALL": *"restore the INC modest-dress
 * starter text inside the Mood Board's dress-code form (lost in #6318)"*).
 *
 * The old `/website/dress-code` page pre-filled this guidance when an INC
 * (Iglesia ni Cristo) host opened an EMPTY dress code; removing that page
 * (#6318) dropped it. Both surfaces that edit the dress code now ask this one
 * function — the Mood Board's Do's and don'ts form and the Maker's Dress code
 * panel — so they can never disagree about when the starter shows.
 *
 * 🔒 PRE-FILL ONLY. This returns FORM DEFAULTS. Nothing here writes: the text
 * reaches the database only when the host presses Save, and they can change or
 * clear every line first. Opening the form never writes.
 *
 * Both rite columns count (`ceremonyMatches`): a mixed wedding with an INC side
 * is asked to dress modestly too. A dress code with ANYTHING already in it —
 * a headline, a line, a colour, one role's outfit — is the host's, and is
 * returned untouched.
 *
 * Source: `02_Specifications/INC_Wedding_Practices_Reference_2026-06-28.md` § 5.4.
 */
export const INC_DRESS_CODE_SUGGESTION: Pick<DressCodeConfig, 'title' | 'description' | 'dos' | 'donts'> = {
  title: 'Modest & formal',
  description:
    'Our ceremony is held in the INC chapel, so we kindly ask everyone to dress modestly and formally. Thank you for honoring the occasion with us.',
  dos: [
    'Formal, modest attire',
    'Covered shoulders / sleeves',
    'Dresses and skirts at or below the knee',
    'Smart formal for the gentlemen',
  ],
  donts: [
    'Sleeveless tops or bared shoulders',
    'Short dresses or skirts above the knee',
    'Plunging, sheer, or backless cuts',
    'Overly casual wear (shorts, slippers)',
  ],
};

/** The one-line note shown above a pre-filled form. */
export const INC_DRESS_CODE_STARTER_NOTE =
  'We’ve started you off with the modest, formal guidance INC asks of guests (no sleeveless or short attire). Make it your own, then Save.';

/** True when the host has set nothing at all in the dress code. */
export function isDressCodeEmpty(config: DressCodeConfig): boolean {
  return (
    !config.title.trim() &&
    !config.description.trim() &&
    config.dos.length === 0 &&
    config.donts.length === 0 &&
    config.palette.length === 0 &&
    Object.keys(config.roles ?? {}).length === 0 &&
    Object.keys(config.groups ?? {}).length === 0
  );
}

/**
 * The dress code a form should START from. An INC event with an empty dress
 * code gets the starter guidance (`started: true`); anything else gets its
 * saved config back as it is. Never mutates `config`.
 */
export function incDressCodeStarter(
  event: CeremonyOverlayInput | null | undefined,
  config: DressCodeConfig,
): { config: DressCodeConfig; started: boolean } {
  if (!ceremonyMatches(event, 'inc') || !isDressCodeEmpty(config)) {
    return { config, started: false };
  }
  return {
    config: {
      ...config,
      title: INC_DRESS_CODE_SUGGESTION.title,
      description: INC_DRESS_CODE_SUGGESTION.description,
      dos: [...INC_DRESS_CODE_SUGGESTION.dos],
      donts: [...INC_DRESS_CODE_SUGGESTION.donts],
    },
    started: true,
  };
}
