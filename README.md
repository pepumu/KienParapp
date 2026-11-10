# PartyMatch — setup & launch guide

No coding experience needed. This will take about 20–30 minutes the first
time. You're just creating two free accounts and copy-pasting some text —
you don't need to understand the code.

## What you're getting

A mobile web app (works in any phone browser, no app store needed):

- **Host** creates a party → gets a code + QR code to share, and can add
  optional details (start/end time, location, cover charge, whether
  guests can bring friends).
- **Activities are fully customizable** — the host starts with a default
  list (Chat, Hug, High Five, Handshake, Hold Hands, Dance, Kiss — Kiss
  is just a normal, removable item, nothing special) and can rename,
  remove, or add activities (with an optional description) at any time,
  even mid-party. Guests see changes instantly.
- **Guests** open the link, add a name + photo, and see everyone else.
  Tapping a person shows the activities they could pick for that person.
- **Nothing is ever revealed unless it's mutual** — if two people pick
  the same activity about each other, both quietly see "you're both open
  to: X" on that person's card. One-sided picks are never shown to
  anyone, including the host.
- **A bright consent banner** rotates through three messages ("no means
  no," "intoxicated or unconscious people can't consent," "yes can
  become no at any time") on every guest-facing screen.
- **Every pick and un-pick is logged with a timestamp**, permanently
  (nobody, including the host, can edit or delete an entry) — see "How
  to view the activity history" below.
- Free tier: up to 8 guests per party. You can add a paid upgrade (see
  the Monetization section) for unlimited guests — or flip on the
  free-for-everyone switch below to waive that during testing or a
  promo weekend.

---

## Step 1 — Create a free Firebase project (your database)

Firebase is Google's free backend service. It stores your party data and
photos and syncs everyone's phones in real time.

1. Go to https://console.firebase.google.com and sign in with any Google
   account.
2. Click **"Add project"**. Name it anything (e.g. "PartyMatch"). You can
   turn off Google Analytics when asked — you don't need it.
3. Once the project opens, click the **`</>`  (web) icon** on the project
   overview page to register a web app. Give it any nickname and click
   **Register app**. You do *not* need Firebase Hosting for this step —
   skip that checkbox.
4. Firebase will show you a code block that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "partymatch-xxxx.firebaseapp.com",
     projectId: "partymatch-xxxx",
     storageBucket: "partymatch-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

   Copy those six values.

5. Open **`js/firebase-config.js`** in this project (any text editor, or
   even Notepad/TextEdit works) and paste your values in, replacing the
   placeholder text. Save the file.

## Step 2 — Turn on the two Firebase features the app uses

Still inside the Firebase console, in the left sidebar:

1. **Build → Authentication** → click **Get started** → click
   **Anonymous** in the sign-in providers list → toggle **Enable** → **Save**.
   (This is what lets guests join without creating accounts or passwords.)

2. **Build → Firestore Database** → click **Create database** → choose
   **Start in production mode** → pick any nearby region → **Enable**.

3. Once it's created, click the **Rules** tab at the top. Delete
   everything in the box and paste in the entire contents of the
   **`firestore.rules`** file included in this project. Click **Publish**.
   (This controls who's allowed to read/write what — it's what keeps
   guests from editing each other's profiles.)

That's it for Firebase — no credit card needed anywhere in this step.

## Step 2.5 — Set up the free-for-everyone / test-mode switch (optional but recommended)

This is a single on/off switch, stored in your database, that you flip
yourself — no code, no redeploy. While it's on, every party gets
unlimited guests for free. Use it while you're testing before launch,
and again anytime you want to run a "free this weekend" promo.

1. In the Firebase console, go to **Build → Firestore Database → Data** tab.
2. Click **Start collection**, name it `config`, and give it a document
   with the ID `app`.
3. Add one field to that document: name `freeForEveryone`, type
   **boolean**, value `true` (while testing) or `false` (normal operation).
4. To flip it later, just open that same document and toggle the value —
   changes take effect immediately, no redeploy needed.

## Step 3 — Test it before publishing

Easiest way (from a computer with Python installed, which is most Macs
and many Windows PCs): open a terminal in this project folder and run:

```
python3 -m http.server 8080
```

Then visit `http://localhost:8080` in your browser. Try hosting a party
and joining it from a second browser tab to make sure matches work.

If that command doesn't work on your computer, skip straight to Step 4 —
Netlify will let you test the live version instead.

## Step 4 — Publish it for free (Netlify, no coding tools)

1. Go to https://app.netlify.com/drop
2. Drag this **entire project folder** onto the page.
3. Netlify gives you a live link like `https://random-name-123.netlify.app`
   within seconds. That's your real, working app — share that link (or a
   party's join-link/QR code) with anyone.
4. Optional: click **"Site settings" → "Change site name"** to get a
   nicer link like `https://yourpartyname.netlify.app`. You can also add
   your own custom domain (e.g. `partymatch.com`) for free later under
   **Domain settings** if you buy one from any domain registrar.

Whenever you want to update the app later, just edit the files and drag
the folder onto https://app.netlify.com/drop again (or connect it to a
GitHub repo for automatic updates — ask me if you'd like help with that
later).

---

## How the privacy design works (and its one honest limitation)

- Guests only ever see: everyone's name/photo, and **their own** picks
  for other people, and **mutual matches**.
- The host never sees who picked what for whom — only a total match
  count.
- Because this is a free, no-backend setup, that privacy rule is
  enforced by the app's design rather than by a server. A guest who
  deliberately opens their browser's developer tools could technically
  see raw data. The interface never shows this to normal users, so for
  a party game this is a reasonable tradeoff — but if you want
  bulletproof server-side privacy later (worth considering if this
  grows), that needs a small paid backend function. Just ask and I can
  build that upgrade.

## How to view the activity history

Every time a guest selects or un-selects an activity for someone, it's
logged permanently with a timestamp — who, for whom, which activity,
select or un-select, and when. This is intentionally **not** shown
anywhere in the app itself (guests should never be able to browse each
other's picks) — it's a backend record only you, as the party owner, can
read, meant to give a clear, tamper-proof account of what happened if a
question or dispute ever comes up.

To view it: Firebase console → **Build → Firestore Database → Data** →
open `parties` → click a party's code → open its `history` subcollection.
Each entry shows the timestamp and the action. If you want an easier
in-app viewer for this later (e.g. searchable by guest), that's a
reasonable small upgrade — just ask.

## Limitations to know about

- Photos are stored compressed inside the database (not a separate file
  storage system) to keep everything on Firebase's free tier — fine for
  party-sized photos, not meant for huge crowds or professional photos.
- If a guest clears their browser data or switches phones, they'll
  rejoin as a "new" person — fine for a single party night.
- The party code system means anyone with the code can join — that's by
  design (easy sharing) but means you shouldn't reuse the same code for
  multiple unrelated events.

## If something breaks

Send me the exact error message (browser dev tools → Console tab shows
these) and I can help debug it — most issues are a typo in the Firebase
config or a rule that wasn't published.
