/**
 * The monogram page's banners, keyed by the `?studio=` / `?studio_error=` / `?upload_error=` the monogram actions land
 * with. One list: the page draws them (`page.tsx`), and a save made IN PLACE says its refusal on the row in the same
 * words (`app/_actions/stay-registry/monogram.ts`).
 */
export const STUDIO_NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  saved: { tone: 'ok', text: 'Your studio monogram is now your mark everywhere.' },
  cleared: { tone: 'ok', text: 'Removed your studio mark — back to your Setnayan mark.' },
  invalid: { tone: 'error', text: 'That design could not be read — please try again.' },
  render: { tone: 'error', text: 'That design could not be saved — please adjust and retry.' },
  save: { tone: 'error', text: 'Something went wrong saving — please try again.' },
  'not-found': { tone: 'error', text: 'This page is for the couple’s account.' },
  'upload-saved': { tone: 'ok', text: 'Your uploaded mark is now your monogram everywhere.' },
  'ink-saved': { tone: 'ok', text: 'Saved — your mark now wears those colours everywhere.' },
  'reveal-saved': { tone: 'ok', text: 'Saved — that is how your monogram arrives for your guests.' },
  'using-upload': { tone: 'ok', text: 'Your uploaded logo is your mark again — the designed one is kept.' },
  'using-studio': { tone: 'ok', text: 'Your designed mark is live again — your uploaded logo is kept, not deleted.' },
  'no-studio-mark': { tone: 'error', text: 'Design a mark first — switching now would leave you with none.' },
  'upload-cleared': { tone: 'ok', text: 'Removed the upload — back to your studio mark.' },
};
