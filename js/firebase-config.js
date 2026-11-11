// ============================================================
// PASTE YOUR OWN FIREBASE CONFIG HERE
// (See README.md "Step 2" for exactly where to get this from)
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyA54Slqxy5V_OEOOxt_x23lqzDk3o5x6ZQ",
  authDomain: "kienparapp.firebaseapp.com",
  projectId: "kienparapp",
  storageBucket: "kienparapp.firebasestorage.app",
  messagingSenderId: "850959270924",
  appId: "1:850959270924:web:a41a88cc70cf39a8f79a29"
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

