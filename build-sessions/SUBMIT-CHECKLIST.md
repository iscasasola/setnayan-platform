# Submitting build 3 — your checklist

Everything here happens in App Store Connect, signed in as you. I cannot do any
of it: it needs your Apple account, and I do not sign in as you.

Listing copy to paste is in `APP-STORE-LISTING-DRAFT.md`.

---

## 0 · Before anything: is build 3 processed?

**App Store Connect → your app → TestFlight.** Build 3 should be listed and not
say "Processing". If it says "Missing Compliance", press it and answer that the
app uses no non-exempt encryption.

If build 3 is missing entirely, check your email — Apple sends a rejection notice
for a build it could not process, and I will fix whatever it names.

## 1 · Prepare the reviewer's account

Apple rejects a sign-in-required app without working credentials.

Use `testnayan1@test.com` with its password, signing in by **email and password**
(never the Google button — that account cannot be used by a reviewer, and an
internal account skips the paid gates a reviewer should see).

Before handing it over, open it once and check that its event has:
- a handful of guests with names that are clearly fake,
- a seating layout with at least one table,
- one supplier conversation.

If it does not, add them. A reviewer who lands on an empty app often decides
there is nothing to review.

## 2 · Screenshots — six, from your iPhone

Take them on the TestFlight build, on the demo event, so no real guest appears.
Press the side button and volume up together, then AirDrop them to the Mac.

1. Event overview, showing the wedding name and date
2. Guest list, with groups and reply status
3. A guest's invitation QR with the three buttons, including Write to NFC
4. Seating layout with tables
5. Check-in desk with the headcount bar
6. Supplier conversation with a quote

Your iPhone 15 Pro Max produces 6.5-inch screenshots, which App Store Connect
accepts. Upload the same six to the 6.9-inch slot if it asks and it will scale.

## 3 · Fill the listing

**App Store Connect → your app → the 1.0 version page.** Paste from
`APP-STORE-LISTING-DRAFT.md`: name, subtitle, promotional text, description,
keywords, support URL `https://www.setnayan.com/help`, marketing URL
`https://www.setnayan.com`.

Set the privacy policy URL to `https://www.setnayan.com/privacy` (checked today,
it loads).

## 4 · Answer the questionnaires

- **Age rating:** all categories None; answer yes to user-generated content.
- **App privacy:** the table in the draft, matching what the app already declares.
  Answer **no** to tracking.

## 5 · Attach the build and paste the review notes

On the version page, under Build, press **+** and choose **build 3**.

Paste the App Review notes from the draft into "Notes", and put the demo account
email and password in the **Sign-in required** fields. Mention in the notes that
NFC needs one blank NTAG213 tag if they want to try it.

## 6 · Submit

Press **Add for Review**, then **Submit**. First reviews usually take one to
three days.

---

## If Apple rejects it

Send me the exact message. The two most likely:

- **Guideline 3.1.1, in-app purchase.** If a reviewer finds a way to buy a
  digital extra inside the app, that is a real bug: the shell is supposed to hide
  every one of them. Send me the screen they name and I will find the hole.
- **Guideline 4.2, minimum functionality**, the usual note for an app that wraps
  a website. The answer is that this app is not a website viewer: it uses the
  camera for event capture, push notifications, and now NFC tag writing and
  reading, none of which a browser can do on iPhone. Say so and point at the NFC
  steps in the notes.

## What is already done

- Build 3 signed, exported and uploaded (2026-09-20).
- NFC permission granted on the App ID, entitlement in the build.
- Every permission has a usage string; encryption declared; privacy manifest present.
- Paid digital extras hidden in the app, enforced by code and 15 passing tests.
- NFC proven on your own iPhone: tag written, read back, and opening in the app.
