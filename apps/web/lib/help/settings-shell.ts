/**
 * HELP SLOT · SETTINGS V2 — ONE SETTINGS SHELL (owner 2026-11-13, *"one setting shell approved"*; prototype
 * `prototypes/approved_2026-11-13/settings-shell-fable.html` v3). How every ⚙ opens and saves, for couples and suppliers.
 *
 * Its own file so it never edits another session's slot. The rules every slot obeys apply here too: what ships on main
 * today in the app's own words, no typed price, "supplier" never "vendor", globally unique slugs.
 * lib/help.ts appends this file's topics after the H-slots.
 */
import type { HelpTopic } from '@/lib/help';

export const SETTINGS_SHELL_TOPICS: ReadonlyArray<HelpTopic> = [
  {
    key: 'settings-everywhere',
    label: 'Settings',
    roles: ['couple', 'vendor'],
    articles: [
      {
        slug: 'how-settings-open-and-save',
        title: 'How do settings open and save?',
        body: 'Tap ⚙ on any page and that page’s settings open as one full screen. The top shows what you are in, and ⓘ says what the screen is for. A switch saves the moment you tap it. To go back, tap ✕ or use your phone’s Back. A short supplier settings screen ends with links to your other settings.',
      },
    ],
  },
];
