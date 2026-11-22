# The app's supplier door — proof shots (22 Nov 2026)

Headless Chromium at 375 × 812 (2×), touch, as the App Store shell: user-agent carries `SetnayanApp`, cookie
`setnayan-client-type=capacitor`. Wizard shots are the lab `/dev/open-shop-lab?app=1&step=…` (the `storeShell` prop
the real `/open-shop` sets from `isStoreShellRequest()`). Dark is forced with the `.dark` class.

- `app-door-rail-signed-out-375-light.jpg` · `-dark.jpg`
  - What it shows: the signed-out rail in the app reads Discover · **Open your shop** · Features · Sign in.
  - For suppliers / For coordinators / Pricing are hidden.
  - Measured on the web: the rail is unchanged (Discover · For suppliers · For coordinators · Features), with no Open your shop.
- `app-door-step1-375-light.jpg` · `-dark.jpg`
  - What it shows: step 1 with "Add more later." under Main service, with no ⓘ and no plan names.
- `app-door-step1-picked-375-light.jpg` · `-dark.jpg`
  - What it shows: one service picked.
  - There is no "Also do …", no "Another category", no plan meter and no plan note.
  - The form text holds no ₱ and no Plus · Pro · Ultra.
- `app-door-step5-375-light.jpg` · `-dark.jpg`
  - What it shows: You're all set, with "Free to open, free to run. You pay only when a couple books you through Setnayan."
  - The line has no ⓘ, no number and no rate.
  - Then the plain "I understand how this works." tick. The plan sheet never opens.

Not shot: the signed-in rail with no shop, which needs a real account with no shop. It is held in code by the guard,
which checks for exactly one signed-in door, gated on `canOpenShop`.
