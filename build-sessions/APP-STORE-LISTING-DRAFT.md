# App Store listing — draft to paste

Written against what the iPhone app actually shows. The app hides its paid extras
(Papic, Panood/Live Studio, Patiktok, Website Pro, Setnayan AI, the supplies
marketplace, custom guest QR, thank-you films) because Apple requires digital
purchases to go through in-app purchase, which is not built yet. **So none of
those are mentioned below.** Do not add them until in-app purchase ships, or the
reviewer will find a feature the app does not offer.

---

## Name (30 characters max)

```
Setnayan
```

## Subtitle (30 characters max)

```
All-in-one events planner
```

✅ Corrected 2026-09-20: production has **17 event types enabled** (wedding,
debut, gender reveal, birthday, celebration, travel, corporate, tournament,
christening, anniversary, graduation, reunion, gala night, simple event, date,
hangout, wake), and real non-wedding events already exist. A wedding-only
subtitle understated the product.

Alternatives, same limit:
- `Weddings, debuts, birthdays` (27) — names the events, better for search
- `Plan any celebration together` (29)
- `Plan your wedding together` (26) — only if you want couples-only positioning

## Promotional text (170 characters, editable any time without review)

```
Now with NFC: write your event link onto a tag, and guests tap to open their invitation. Check them in at the door with a tap instead of a queue.
```

## Description

```
Setnayan is where you plan a celebration and keep every part of it in one place — the guest list, the suppliers, the schedule, and the day itself.

Weddings, debuts, birthdays, christenings, anniversaries, graduations, reunions, corporate nights and more. Start with the kind of event you are planning, and the app sets up the right checklist for it.

PLAN THE DAY
Build your programme, set the times, and keep everyone reading the same schedule. Your event page collects the details guests keep asking about, so you stop answering the same question twenty times.

YOUR GUEST LIST, WITHOUT THE SPREADSHEET
Add guests, group them by side and role, and track who has replied. Every guest gets their own invitation link and QR code. Print them, send them, or write them onto an NFC tag and let guests tap.

SEATING THAT MAKES SENSE
Lay out tables, place your guests, and see who is still unseated. Changes are instant, so a last-minute reshuffle is not a crisis.

CHECK GUESTS IN AT THE DOOR
On the day, scan a guest's QR or tap their NFC tag and mark them arrived. Search by name when someone forgets their code. You can see your headcount as it fills.

WORK WITH YOUR SUPPLIERS
Shortlist suppliers, message them, agree on what is included, and keep quotes, payments, and schedules attached to the booking instead of scattered across chat threads.

FOR SUPPLIERS
Set up your shop, share your QR or NFC tag so clients can save you to their shortlist, send quotes, and keep your bookings and payment records in one place.

Setnayan is free to start. Create your event, add your guests, and see the whole celebration in one view.
```

## Keywords (100 characters, comma separated, no spaces after commas)

```
wedding,debut,birthday,planner,guest list,rsvp,seating,invitation,qr,nfc,supplier,event,kasal
```

## Support URL

```
https://www.setnayan.com/help
```

✅ Checked 2026-09-20: `/help` returns 200, and so do `/privacy` and `/terms`.
`/contact` does NOT exist (404) — do not use it anywhere in the listing.

## Marketing URL (optional)

```
https://www.setnayan.com
```

---

## App Review notes (the box reviewers actually read)

```
DEMO ACCOUNT
Email: <a real account you are happy for a reviewer to use>
Password: <that account's password>
This account has a sample event with guests, seating, and a supplier already set up.

WHAT THE APP IS
Setnayan is a wedding planning tool. The app loads our web application, which is the same product available at https://www.setnayan.com.

ABOUT PAYMENTS
The app does not sell anything. Paid extras and all purchase screens are hidden inside the app; they are available only on our website. Couples pay their wedding suppliers directly, outside the app — these are real-world services (photography, catering, venues), not digital content.

NFC
The app writes an NFC tag with the couple's own event link or the supplier's own shop link, and reads a guest's tag at the door to check them in. To try it you need one blank NDEF tag (NTAG213 or similar):
1. Sign in with the account above.
2. Open Guests, then Invitation.
3. On any guest's row press "Write to NFC" and hold the tag to the top of the iPhone.
4. Press again when asked, to confirm the tag was written.
The tag holds a normal https link to that guest's invitation page. No personal data is stored on the tag beyond that link.

DELETING AN ACCOUNT (guideline 5.1.1(v))
Signed in, tap the account menu, then Profile. At the bottom of that page, open
"Delete my account", type DELETE, and submit. This files the deletion request from
inside the app. Our team completes it within 24 hours, because an account may have
an active event, a supplier booking, or an unpaid balance that has to be settled
first. Nothing outside the app is needed to start or to complete it.

TRACKING (guideline 5.1.2(i))
The app does not track users and shows no tracking prompt. No analytics run inside
the app. Our App Privacy answer is "Data Not Used to Track You".

CAMERA, MICROPHONE, PHOTOS
Used only when a guest or couple chooses to capture or pick a photo for their own event gallery.

PREVIOUS REVIEW
Version 1.0 build 1 was rejected on 2026-06-30 under 3.1.1, 5.1.1(v) and 5.1.2(i).
All three are addressed in this build: every paid digital feature is now hidden
inside the app and its routes are blocked, account deletion is requested in the app
as described above, and the tracking prompt no longer appears.
```

---

## Lengths, checked against Apple's limits

| Field | Used | Limit |
|---|---|---|
| Name | 8 | 30 |
| Subtitle | 25 | 30 |
| Keywords | 93 | 100 |
| Promotional text | 145 | 170 |

## Age rating answers

All categories: **None**. The app has no violence, no mature themes, no gambling,
no contests. User-generated content exists (event photos and messages between a
couple and their suppliers), so answer **yes** to user-generated content and note
that sharing is limited to people invited to a specific event.

## Privacy answers (App Store Connect privacy questionnaire)

Match what the app's privacy manifest already declares:

| Data | Collected | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|---|
| Email address | Yes | Yes | No | Account, sign-in, event email |
| Name | Yes | Yes | No | Account and guest list |
| Photos | Yes | Yes | No | The event gallery the user creates |
| User content (messages) | Yes | Yes | No | Supplier conversations |
| Contact info of guests the user enters | Yes | Yes | No | The user's own guest list |

Answer **no** to tracking and to third-party advertising. Set the privacy policy
URL to your live policy page.

---

## Screenshots — still to produce

Apple requires 6.9-inch iPhone screenshots (1320 x 2868), and it is worth adding
6.5-inch. Suggested six, in this order:

1. The event overview, showing the wedding's name and date.
2. The guest list with groups and reply status.
3. A guest's invitation QR with the three buttons, including Write to NFC.
4. The seating layout with tables.
5. The check-in desk mid-arrival, with the headcount bar.
6. The supplier conversation with a quote attached.

Take them on your own iPhone from the TestFlight build, on the demo event, so no
real guest's name or phone number appears.
