/**
 * Is the dashboard's Tagalog ready to offer? NO — owner, 23 Oct 2026: hide the
 * Display language switch until the WHOLE app is translated. `dashboard.tl.json`
 * covers 59 labels on 3 screens, so a person who picked Tagalog read a mix.
 *
 * While this is `false`:
 *   · Account settings › Preferences draws no Display language row;
 *   · `getLocale()` answers 'en' for everyone without reading `users.locale`, so a
 *     saved 'tl' renders English everywhere. The column and the saved choices are
 *     KEPT (no data change), and so are the dictionaries — flip this to bring both
 *     back exactly as they were.
 *
 * PURE (no `server-only`) so the profile page and the guards can import it.
 */
export const DASHBOARD_TAGALOG_READY: boolean = false;
