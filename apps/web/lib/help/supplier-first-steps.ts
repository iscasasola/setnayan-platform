/**
 * HELP SLOT · SUPPLIER FIRST STEPS (owner-approved supplier cuts 1 and 4, 2026-11-14 — DECISION_LOG "THE SEVEN
 * SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` §§ 1, 4).
 *
 * Its own file so it never edits another session's slot. The rules every slot obeys apply here too: what ships on main
 * today in the app's own words, no typed price, "supplier" never "vendor", globally unique slugs.
 * lib/help.ts appends this file's topics after the H-slots.
 */
import type { HelpTopic } from '@/lib/help';
import { HELP_NOT_IN_THE_APP } from './not-in-the-app';

export const SUPPLIER_FIRST_STEPS_TOPICS: ReadonlyArray<HelpTopic> = [
  {
    // 🧰 The supplier's first steps (owner-approved 2026-11-14 — DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED").
    key: 'supplier-first-steps',
    label: 'Your shop',
    roles: ['vendor'],
    articles: [
      {
        slug: 'add-inspiration-photos',
        title: 'Add photos of your work to the inspiration library',
        appBody: HELP_NOT_IN_THE_APP,
        body: 'Open Portfolio, then My moodboard designs. Pick a photo, choose the service card it shows, and tick that you hold the rights to it. The Part starts on your own kind of work, and the label is optional: left empty, the photo takes your service card’s name. Setnayan reviews each photo before couples see it. You can add photos before your setup is finished; the year you started is still asked on setup, for your years badge.',
      },
    ],
  },
];
