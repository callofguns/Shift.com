# Putting George's AG Shifts online

This guide takes you from "code on a computer" to "app on everyone's phone".
It takes about 30–45 minutes the first time. You only do it once.

You'll need:

- A computer (Mac or Windows) with **[Node.js 22](https://nodejs.org)** installed.
  Pick the "LTS" download and click through the installer.
- Your Google account.
- A credit card for Firebase's Blaze plan. For 5–6 people it should cost **$0 a month**,
  and step 3 sets up an email alert in case it ever doesn't.

---

## 1. Download the code and install its parts

Open **Terminal** (Mac) or **PowerShell** (Windows), then run these one at a time:

```bash
git clone https://github.com/callofguns/Shift.com.git
cd Shift.com
git checkout build-shift-app   # skip this line once the app is merged into main
npm install
cd functions
npm install
cd ..
```

`npm install` downloads the libraries the app uses. It can take a minute or two.

## 2. Create the Firebase project

1. Go to **https://console.firebase.google.com** and click **Create a project**.
2. Name it something like `georges-ag-shifts`.
   The project ID becomes your web address, like **georges-ag-shifts.web.app**.
3. You can turn Google Analytics **off**. The app doesn't use it.

## 3. Switch to the Blaze plan and add a budget alert

PIN sign-in and phone notifications need the Blaze plan.

1. In the Firebase console, click **Upgrade** (bottom-left) → **Blaze** and add your card.
2. Set up a budget alert so you get an email if it ever costs money:
   - Go to **https://console.cloud.google.com/billing**, choose your billing account, then **Budgets & alerts** → **Create budget**.
   - Set the amount to **$1** and keep the alerts at 50%, 90% and 100%. Save.

## 4. Turn on sign-in methods

In the Firebase console: **Build → Authentication → Get started**, then on the **Sign-in method** tab:

1. Click **Email/Password**, turn on the first switch, and **Save**.
2. Click **Google**, turn it on, pick your email as the support email, and **Save**.

(PIN sign-in doesn't need turning on here. The app's server code handles it.)

## 5. Create the database

**Build → Firestore Database → Create database**

- Location: **nam5 (United States)**
- Start in **production mode** (the app comes with its own security rules)

## 6. Connect the app to your project

1. Click the ⚙️ gear → **Project settings** → scroll to **Your apps** → click the **`</>`** (Web) icon.
2. Nickname: `George's AG`. Tick **Also set up Firebase Hosting**. Click **Register app**.
3. You'll see a block of code with `apiKey`, `authDomain`, and so on. Keep that page open.
4. In the project folder, make a copy of `.env.example` and name it `.env`. Fill it in from that block:

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=georges-ag-shifts.web.app   ← use .web.app here, not .firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=georges-ag-shifts
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

   Using your `.web.app` address for `AUTH_DOMAIN` makes Google sign-in work on iPhones.

5. Still in **Project settings**, open the **Cloud Messaging** tab → **Web Push certificates** →
   **Generate key pair**. Copy the long key into `.env`:

   ```
   VITE_FIREBASE_VAPID_KEY=B...
   ```

`.env` stays on your computer and is never uploaded to GitHub.

## 7. Put it online

In Terminal, inside the project folder:

```bash
npx firebase login        # opens a browser so you can sign in with Google
npx firebase use --add    # pick your project, and type "default" when it asks for an alias
npm run deploy            # builds the app and uploads everything
```

The first deploy takes a few minutes. When it finishes, it prints your address,
like **https://georges-ag-shifts.web.app**.

## 8. Allow PIN sign-in (one-time permission)

PIN sign-in needs one extra permission in Google Cloud:

1. Go to **https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com**
   (check your project is selected at the top) and click **Enable**.
2. Go to **https://console.cloud.google.com/iam-admin/iam**.
3. Find the row named **Default compute service account**
   (its email looks like `123456789-compute@developer.gserviceaccount.com`). Click the ✏️ pencil.
4. **Add another role** → search **Service Account Token Creator** → **Save**.

It can take a few minutes to start working.

## 9. Set up the store (first manager)

1. Open your web address and choose **Email or Google**.
2. Sign in with Google, or create a password with your email (you'll get a link to confirm it).
3. Because you're the first person, the app asks you to **Set up the schedule**.
   Type your name and your register PIN. **You're now a manager.**

## 10. Add everyone else

Go to **More → Team → Add person** for each person:

- **Name**: what they type with their PIN. If two people share a first name, add a last initial.
- **Email** (optional): lets them sign in with email or Google.
- **Register PIN**: their 4-digit register code. It's stored scrambled, so nobody can read it back, not even managers.
- **Role**: make the 2–3 managers **Manager**.

## 11. Put it on everyone's phone

**iPhone** (needs iOS 16.4 or newer for notifications):

1. Open the web address in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open **George's AG** from the Home Screen and sign in.
4. Go to **More → Turn on alerts** and tap **Allow**.

**Android**:

1. Open the web address in **Chrome**.
2. Tap **Install** when it pops up (or **⋮ → Install app**).
3. Open it, sign in, then **More → Turn on alerts** → **Allow**.

---

## Making changes later

After you change any code, run `npm run deploy` again. Phones get the new version
the next time the app opens.

## Trying it on your computer first (optional)

You can run a fake copy of Firebase on your computer, so you can test without touching real data.
You'll need [Java](https://adoptium.net) installed for this.

```bash
npm run emulators         # terminal window 1: fake Firebase
npm run dev:emulators     # terminal window 2: the app, at http://localhost:5173
```

Sign in with "Email or Google". The fake email link shows up in window 1.

## If something goes wrong

| Problem | Fix |
|---|---|
| PIN sign-in says "internal" or doesn't work | Redo step 8 and wait 5 minutes. |
| "You're not on the team yet" | A manager needs to add that exact email in **More → Team**. |
| No notifications on iPhone | The app must be opened from the Home Screen icon, not Safari. Check **Settings → Notifications → George's AG**. |
| Someone typed their PIN wrong 5 times | **More → Team** → tap them → **Unlock now**. |
| Someone left | **More → Team** → tap them → turn off **Can sign in**. Their past shifts stay in the history. |
