// ============================================================
// PASTE YOUR OWN FIREBASE CONFIG HERE
// (See README.md "Step 2" for exactly where to get this from)
// ============================================================
export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId: "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_SENDER_ID_HERE",
  appId: "PASTE_YOUR_APP_ID_HERE"
};

// Optional: paste a Stripe Payment Link URL here if you want the
// "Upgrade" button on the host dashboard to send hosts to a real
// checkout page. Leave as null to hide the upgrade button.
// See README.md "Monetization" section for how to create one.
export const upgradePaymentLinkUrl = null; // e.g. "https://buy.stripe.com/xxxxx"

// A secret word/code YOU make up. After someone pays via your Stripe link,
// you tell them this code (or Stripe can show it automatically on the
// payment success page — see README). They type it into the host
// dashboard to unlock unlimited guests for their party.
export const unlockCode = "CHANGE_ME_SECRET_CODE";

