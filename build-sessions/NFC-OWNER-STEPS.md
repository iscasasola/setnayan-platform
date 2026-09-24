# NFC — your steps, iPhone only

You have an iPhone and no Android phone, so every test runs **inside the Setnayan iPhone app**.
iPhone can only write NFC tags from an app, never from Safari. That means the order is:
Apple setting → new app build → TestFlight on your iPhone → test → App Review → switch on for everyone.

**Wait for these PRs to merge first** (CI merges them on its own):
- #5721 — the three buttons under every QR ✅ merged
- #5726 — writing inside the app (the NFC plugin)
- the NFC check-in PR — reading guest tags at the desk, plus the **test switch** used in Step 4

You also need blank NFC stickers. Buy **NTAG213** or **NTAG215** (Lazada or Shopee, a few pesos each).

---

## Step 1 — Turn on "NFC Tag Reading" for the app

1. Go to **developer.apple.com → Account → Certificates, Identifiers & Profiles → Identifiers**.
2. Click **com.setnayan.app**.
3. In the Capabilities list, tick **NFC Tag Reading**. Press **Save**, then confirm.

That is all. Xcode signs automatically on this project, so it picks this up by itself in Step 2.

## Step 2 — Build the app and upload it

In Terminal, one line at a time:

```bash
cd ~/Documents/Claude/Projects/setnayan-platform && git checkout main && git pull
```

```bash
cd apps/mobile && npm install && npx cap sync ios && npx cap open ios
```

Xcode opens. Then:

1. In the left sidebar click **App** (the blue icon at the top), then the **App** target, then **General**.
2. Under **Identity**, set **Build** to one more than your last upload. The real last number is in
   **appstoreconnect.apple.com → your app → TestFlight**. The repo says `2`, but trust TestFlight.
3. Open the **Signing & Capabilities** tab. **Near Field Communication Tag Reading** should be listed.
   If there is a red signing error, press **Try Again**.
4. At the top of the window, pick **Any iOS Device (arm64)** as the destination.
5. Menu **Product → Archive**. Wait for the Organizer window.
6. Press **Distribute App → App Store Connect → Upload** and accept the defaults.

## Step 3 — Install it on your iPhone with TestFlight

1. Wait 10–30 minutes for **App Store Connect → your app → TestFlight** to show the build as ready.
   It may ask an export-compliance question: answer that the app uses no non-exempt encryption.
2. Add yourself under **Internal Testing** if you are not already there. Internal testing needs no
   Apple review.
3. On your iPhone, open the **TestFlight** app and install the new build.

## Step 4 — Turn NFC on for your iPhone only

The NFC button is still switched off for everyone. This turns it on for your phone alone.

1. Open the Setnayan app once and sign in.
2. Open **Safari** on the same iPhone and type this into the address bar, then Go:

   ```
   setnayan://vendor-dashboard/customers?nfc-test=1
   ```

   Safari asks "Open in Setnayan?" Tap **Open**. The app opens on your supplier Customers page.
   If you are testing as a couple instead, use `setnayan://dashboard?nfc-test=1`.

Your iPhone stays switched on until you undo it with `?nfc-test=0` the same way.

## Step 5 — Write a tag

1. On **Customers → Your QR codes**, press **Write to NFC**.
2. iPhone shows its own **Ready to Scan** panel. Hold a blank sticker flat against the **top back**
   of the iPhone, near the camera.
3. The panel closes, and the app says **Tap the tag once more to confirm**. Move the sticker away,
   then touch it to the top of the phone again.
4. You should see **Tag written**. If you see **Write failed**, send me the sentence under it.

## Step 6 — Check that the tag opens

1. Close the app. Keep the iPhone unlocked with the screen on.
2. Touch the sticker to the top of the iPhone. A banner appears. Tap it: your shop's link opens.

## Step 7 — Test guest check-in

1. In the app, open one of your events → **Guests → Invitation**. Press **Write to NFC** on one
   guest's row and write their tag the same way as Step 5.
2. Go to that event's **Guests → Check-in** desk.
3. Press **Read a guest's tag**. iPhone shows **Ready to Scan**. Touch the guest's sticker.
4. The guest's card appears. Press **Check in**. Then press **Undo** so your test does not count.

## Step 8 — Send the app to Apple

Only after Steps 5–7 work:

1. **App Store Connect → your app → App Store** tab → the version page → **Build** → choose the
   build you tested → **Add for Review → Submit**.
2. In the review notes you can write: "Adds NFC tag writing and reading so couples and suppliers
   can put their event and shop links on NFC stickers, and check guests in by tapping their tag."

## Step 9 — Switch it on for everyone

After Apple approves the app:

1. **vercel.com → setnayan-platform-web → Settings → Environment Variables → Add**:
   key `NEXT_PUBLIC_NFC_WRITE_ENABLED`, value `true`, tick **Production** (and Preview if you like).
2. **Deployments** → the latest Production deployment → **Redeploy**. The value is baked in when
   the site builds, so nothing changes until this finishes.

⚠ **One thing this cannot prove.** Writing in **Chrome on Android** is a different code path, and
nobody will have tapped it. If you want it checked before Step 9, ask anyone with an Android phone
to do Step 5 in Chrome on the live site after opening a page with `?nfc-test=1`. Otherwise it goes
live untested on Android, and every failure there still shows a named reason, never a false
"Tag written".

## Android app on Google Play

Skip this unless the Android app is actually published. If it is, rebuild it in Android Studio
(`npx cap sync android && npx cap open android`), raise `versionCode` in `app/build.gradle`, and
upload a signed bundle in Play Console.

---

**What I cannot do for you:** anything signed in as you at Apple or Vercel, and touching the sticker.
