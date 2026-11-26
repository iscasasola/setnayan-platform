/**
 * What erasing an account actually does — from lib/erasure/purge.ts ·
 * eraseUserAccount, which no longer hard-deletes anything (row 31: the old
 * text promised a cascade that has not happened since 2026-07). ONE copy, read
 * by every confirm that erases an account (A8·D-12).
 */
export const ERASURE_WORDS =
  'This signs them out everywhere, locks the account, wipes their name, email, phone and photos, and removes their own records. Orders and payments are kept for the books, without their name.';
