import { firebaseConfig, upgradePaymentLinkUrl, unlockCode } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove, getCountFromServer, query
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- Firebase init ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const FREE_GUEST_LIMIT = 8;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

// Starter activities every new party gets — the host can rename, remove, or
// add to this list at any time (before or during the party) from their
// dashboard. Nothing here is fixed or special-cased.
const DEFAULT_ACTIVITIES = [
  { name: "Chat", description: "" },
  { name: "High Five", description: "" },
  { name: "Handshake", description: "" },
  { name: "Hug", description: "" },
  { name: "Hold Hands", description: "" },
  { name: "Dance", description: "" },
  { name: "Kiss", description: "" },
];

// Rotates through a party's guest-facing screens. Kept short and directly
// worded on purpose — this is meant to be read at a glance, not skimmed.
const CONSENT_MESSAGES = [
  "No means no — at any point, for any reason.",
  "Intoxicated or unconscious people can't consent.",
  "Yes can become no at any time — for anyone, no explanation needed.",
];

let currentUid = null;
let authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user) { currentUid = user.uid; resolve(user.uid); }
  });
});
signInAnonymously(auth).catch((err) => {
  console.error("Anonymous sign-in failed", err);
  toast("Couldn't connect — check your internet connection.");
});

// ---------- Small helpers ----------
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg, ms = 3200) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), ms);
}

function showView(id) {
  $all(".view").forEach((v) => v.classList.add("hidden"));
  const target = document.getElementById(id);
  if (target) target.classList.remove("hidden");
  window.scrollTo(0, 0);
}

function genCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}
function genActivityId() {
  return "act_" + Math.random().toString(36).slice(2, 10);
}

function partyDoc(code) { return doc(db, "parties", code); }
function guestsCol(code) { return collection(db, "parties", code, "guests"); }
function guestDoc(code, uid) { return doc(db, "parties", code, "guests", uid); }
function selectionsCol(code) { return collection(db, "parties", code, "selections"); }
function selectionDoc(code, uid) { return doc(db, "parties", code, "selections", uid); }
function historyCol(code) { return collection(db, "parties", code, "history"); }
function configDoc() { return doc(db, "config", "app"); }

function joinUrl(code) {
  return `${location.origin}${location.pathname}#join/${code}`;
}

async function isFreeForEveryone() {
  try {
    const snap = await getDoc(configDoc());
    return !!(snap.exists() && snap.data().freeForEveryone);
  } catch {
    return false; // config doc may not exist yet — default to normal free-tier behavior
  }
}

function logHistory(code, to, activityId, action) {
  // Fire-and-forget append-only audit entry. Never blocks the UI and never
  // shown to guests — see README for how the host can review it.
  addDoc(historyCol(code), {
    from: currentUid, to, activityId, action, at: serverTimestamp(),
  }).catch((err) => console.error("history log failed", err));
}

// Compress an image file to a small base64 JPEG (fits comfortably in a
// Firestore document, and keeps the app fast on slow party wifi).
function compressImage(file, maxDim = 320, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height *= maxDim / width; width = maxDim; }
      else if (height > maxDim) { width *= maxDim / height; height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDateRange(startAt, endAt) {
  const fmt = (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d)) return null;
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };
  const s = fmt(startAt), e = fmt(endAt);
  if (s && e) return `${s} – ${e}`;
  if (s) return `Starts ${s}`;
  if (e) return `Ends ${e}`;
  return null;
}

// ---------- Consent banner (rotates on every screen it appears on) ----------
let consentIdx = 0;
function tickConsentBanner() {
  $all("[data-consent-banner]").forEach((el) => { el.textContent = CONSENT_MESSAGES[consentIdx]; });
  consentIdx = (consentIdx + 1) % CONSENT_MESSAGES.length;
}
tickConsentBanner();
setInterval(tickConsentBanner, 4500);

// ---------- Router ----------
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

const activeUnsubs = [];
function clearListeners() { activeUnsubs.forEach((u) => u()); activeUnsubs.length = 0; }

async function route() {
  clearListeners();
  // Note: we deliberately do NOT await Firebase auth here. Switching
  // between static views (home/create/join) must never block on network
  // access, or a slow/offline connection would freeze the whole app on
  // a blank screen. Handlers that actually need a signed-in user (join,
  // profile, party) await `authReady` themselves before using it.
  const hash = location.hash.replace(/^#/, "");
  const [path, arg] = hash.split("/");

  if (!hash || path === "") return showView("view-home");
  if (path === "create") return showView("view-create");
  if (path === "join" && !arg) return showView("view-join");
  if (path === "join" && arg) return prefillJoin(arg);
  if (path === "host" && arg) return openHostDashboard(arg);
  if (path === "profile" && arg) return openProfile(arg);
  if (path === "party" && arg) return openParty(arg);
  showView("view-home");
}

$("#btn-go-create").onclick = () => (location.hash = "#create");
$("#btn-go-join").onclick = () => (location.hash = "#join");
$all(".back-btn").forEach((b) => (b.onclick = () => (location.hash = "#")));

// ---------- Create party ----------
$("#form-create").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!$("#create-consent-ack").checked) {
    toast("Please confirm the consent checkbox to create a party.");
    return;
  }
  const name = $("#create-name").value.trim();
  await authReady;
  let code, tries = 0;
  do {
    code = genCode();
    tries++;
  } while ((await getDoc(partyDoc(code))).exists() && tries < 8);

  const activities = DEFAULT_ACTIVITIES.map((a) => ({ id: genActivityId(), name: a.name, description: a.description }));

  await setDoc(partyDoc(code), {
    name,
    hostUid: currentUid,
    plan: "free",
    guestLimit: FREE_GUEST_LIMIT,
    createdAt: serverTimestamp(),
    activities,
    startAt: $("#create-start").value || null,
    endAt: $("#create-end").value || null,
    location: $("#create-location").value.trim(),
    cover: $("#create-cover").value.trim(),
    bringFriends: $("#create-bring-friends").checked,
  });
  localStorage.setItem(`host_${code}`, "1");
  location.hash = `#host/${code}`;
});

// ---------- Host dashboard ----------
async function openHostDashboard(code) {
  showView("view-host");
  $("#host-code").textContent = code;
  $("#host-qr").innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl(code))}" alt="QR code to join" width="180" height="180" />`;

  $("#btn-copy-link").onclick = async () => {
    try { await navigator.clipboard.writeText(joinUrl(code)); toast("Link copied!"); }
    catch { prompt("Copy this link:", joinUrl(code)); }
  };

  const freeForAll = await isFreeForEveryone();
  $("#promo-banner").classList.toggle("hidden", !freeForAll);
  if (freeForAll) $("#promo-banner").textContent = "🎉 Free-for-everyone promo is ON — every party gets unlimited guests right now.";

  let currentParty = null;

  $("#btn-save-details").onclick = async () => {
    await updateDoc(partyDoc(code), {
      name: $("#edit-name").value.trim(),
      startAt: $("#edit-start").value || null,
      endAt: $("#edit-end").value || null,
      location: $("#edit-location").value.trim(),
      cover: $("#edit-cover").value.trim(),
      bringFriends: $("#edit-bring-friends").checked,
    });
    toast("Party details saved.");
  };

  $("#btn-add-activity").onclick = async () => {
    const name = $("#new-activity-name").value.trim();
    const description = $("#new-activity-desc").value.trim();
    if (!name) { toast("Give the activity a name first."); return; }
    if (!currentParty) return;
    const activities = [...(currentParty.activities || []), { id: genActivityId(), name, description }];
    await updateDoc(partyDoc(code), { activities });
    $("#new-activity-name").value = "";
    $("#new-activity-desc").value = "";
  };

  const unsubParty = onSnapshot(partyDoc(code), (snap) => {
    if (!snap.exists()) { toast("Party not found."); location.hash = "#"; return; }
    const party = snap.data();
    currentParty = party;

    $("#host-party-name").textContent = party.name;
    $("#edit-name").value = party.name || "";
    $("#edit-start").value = party.startAt || "";
    $("#edit-end").value = party.endAt || "";
    $("#edit-location").value = party.location || "";
    $("#edit-cover").value = party.cover || "";
    $("#edit-bring-friends").checked = !!party.bringFriends;

    // Activities list
    const list = $("#activity-list");
    list.innerHTML = "";
    (party.activities || []).forEach((act) => {
      const li = document.createElement("li");
      li.className = "activity-row";
      li.innerHTML = `
        <div class="activity-info">
          <div class="activity-name">${escapeHtml(act.name)}</div>
          ${act.description ? `<div class="activity-desc">${escapeHtml(act.description)}</div>` : ""}
        </div>
        <button class="remove-btn" title="Remove activity">✕</button>
      `;
      li.querySelector(".remove-btn").onclick = async () => {
        const next = (party.activities || []).filter((a) => a.id !== act.id);
        await updateDoc(partyDoc(code), { activities: next });
      };
      list.appendChild(li);
    });

    // Upgrade card
    const upgradeCard = $("#upgrade-card");
    if (freeForAll) {
      upgradeCard.innerHTML = `<p>✨ Unlimited guests are free for everyone right now (promo active).</p>`;
    } else if (party.plan === "pro") {
      upgradeCard.innerHTML = `<p>✨ <strong>Pro plan active</strong> — unlimited guests. Thank you!</p>`;
    } else {
      upgradeCard.innerHTML = `
        <p><strong>Free plan:</strong> up to 8 guests.</p>
        <p id="guest-limit-warning" class="hidden warning">You're at your guest limit — new guests can't join until you upgrade.</p>
        <button class="btn btn-primary" id="btn-upgrade">Upgrade for unlimited guests</button>
      `;
      $("#btn-upgrade").onclick = () => {
        if (upgradePaymentLinkUrl) window.open(upgradePaymentLinkUrl, "_blank");
        const code2 = prompt("After paying, enter the unlock code you received:");
        if (code2 && unlockCode && code2.trim() === unlockCode) {
          updateDoc(partyDoc(code), { plan: "pro", guestLimit: 999 }).then(() => {
            toast("Upgraded! Unlimited guests unlocked.");
          });
        } else if (code2) {
          toast("That code didn't match.");
        }
      };
    }
  });
  activeUnsubs.push(unsubParty);

  const unsubGuests = onSnapshot(guestsCol(code), (qs) => {
    $("#stat-guests").textContent = qs.size;
    const warningEl = $("#guest-limit-warning");
    if (warningEl) warningEl.classList.toggle("hidden", !(!freeForAll && currentParty?.plan === "free" && qs.size >= FREE_GUEST_LIMIT));
    const list = $("#host-guest-list");
    list.innerHTML = "";
    qs.forEach((d) => {
      const g = d.data();
      const li = document.createElement("li");
      li.innerHTML = `<img src="${g.photo || ""}" alt=""/><span>${escapeHtml(g.name || "Guest")}</span>`;
      list.appendChild(li);
    });
  });
  activeUnsubs.push(unsubGuests);

  const unsubSel = onSnapshot(selectionsCol(code), (qs) => {
    const map = {};
    qs.forEach((d) => (map[d.id] = d.data()));
    let matchPairs = 0;
    const uids = Object.keys(map);
    for (let i = 0; i < uids.length; i++) {
      for (let j = i + 1; j < uids.length; j++) {
        const a = uids[i], b = uids[j];
        const aPicksB = (map[a].targets && map[a].targets[b]) || [];
        const bPicksA = (map[b].targets && map[b].targets[a]) || [];
        if (aPicksB.some((t) => bPicksA.includes(t))) matchPairs++;
      }
    }
    $("#stat-matches").textContent = matchPairs;
  });
  activeUnsubs.push(unsubSel);
}

// ---------- Join ----------
$("#form-join").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("#join-code").value.trim().toUpperCase();
  await checkAndGoToProfile(code, "#join-error");
});

async function prefillJoin(code) {
  showView("view-join");
  $("#join-code").value = code.toUpperCase();
  await checkAndGoToProfile(code.toUpperCase(), "#join-error");
}

async function checkAndGoToProfile(code, errSelector) {
  const errEl = $(errSelector);
  errEl.classList.add("hidden");
  const snap = await getDoc(partyDoc(code));
  if (!snap.exists()) {
    errEl.textContent = "No party found with that code. Double-check with your host.";
    errEl.classList.remove("hidden");
    return;
  }
  location.hash = `#profile/${code}`;
}

// ---------- Profile / join party ----------
let pendingPhotoDataUrl = null;

async function openProfile(code) {
  const snap = await getDoc(partyDoc(code));
  if (!snap.exists()) { toast("Party not found."); location.hash = "#"; return; }
  const party = snap.data();
  showView("view-profile");
  $("#profile-party-name").textContent = `Join "${party.name}"`;
  $("#profile-error").classList.add("hidden");
  pendingPhotoDataUrl = null;
  $("#profile-photo-preview").src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%232a1c42'/%3E%3Ctext x='50' y='62' font-size='40' text-anchor='middle'%3E%F0%9F%93%B7%3C/text%3E%3C/svg%3E";
  $("#profile-name").value = localStorage.getItem("my_name") || "";

  await authReady;

  // Existing guest record on this device? Reuse it.
  const existing = await getDoc(guestDoc(code, currentUid));
  if (existing.exists()) {
    location.hash = `#party/${code}`;
    return;
  }

  $("#profile-photo-input").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingPhotoDataUrl = await compressImage(file);
      $("#profile-photo-preview").src = pendingPhotoDataUrl;
    } catch {
      toast("Couldn't load that photo, try another.");
    }
  };

  $("#btn-join-party").onclick = async () => {
    const name = $("#profile-name").value.trim();
    if (!name) { profileError("Please enter your name."); return; }
    if (!pendingPhotoDataUrl) { profileError("Please add a photo so others recognize you."); return; }

    // Guest limit check for free parties (bypassed during a free-for-everyone promo)
    if (party.plan !== "pro" && !(await isFreeForEveryone())) {
      const countSnap = await getCountFromServer(query(guestsCol(code)));
      if (countSnap.data().count >= (party.guestLimit || FREE_GUEST_LIMIT)) {
        profileError("This party is full. Ask the host to upgrade for more room.");
        return;
      }
    }

    await setDoc(guestDoc(code, currentUid), {
      name, photo: pendingPhotoDataUrl, joinedAt: serverTimestamp(),
    });
    await setDoc(selectionDoc(code, currentUid), { from: currentUid, targets: {} }, { merge: true });
    localStorage.setItem("my_name", name);
    location.hash = `#party/${code}`;
  };
}

function profileError(msg) {
  const el = $("#profile-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

// ---------- Party / guest grid ----------
let partyState = { code: null, party: null, guests: {}, selections: {} };

async function openParty(code) {
  await authReady;
  const myGuestSnap = await getDoc(guestDoc(code, currentUid));
  if (!myGuestSnap.exists()) { location.hash = `#profile/${code}`; return; }

  partyState = { code, party: null, guests: {}, selections: {} };

  showView("view-party");
  $("#party-me-label").textContent = `You're in as ${myGuestSnap.data().name}`;
  $("#btn-leave-party").onclick = () => leaveParty(code);

  const unsubParty = onSnapshot(partyDoc(code), (snap) => {
    if (!snap.exists()) { toast("This party no longer exists."); location.hash = "#"; return; }
    partyState.party = snap.data();
    $("#party-name-title").textContent = partyState.party.name;
    const bits = [];
    const dateRange = formatDateRange(partyState.party.startAt, partyState.party.endAt);
    if (dateRange) bits.push(dateRange);
    if (partyState.party.location) bits.push(partyState.party.location);
    if (partyState.party.cover) bits.push(partyState.party.cover);
    if (partyState.party.bringFriends) bits.push("Friends welcome");
    $("#party-details-line").textContent = bits.join(" · ");
    renderGuestGrid();
  });

  const unsubGuests = onSnapshot(guestsCol(code), (qs) => {
    partyState.guests = {};
    qs.forEach((d) => (partyState.guests[d.id] = d.data()));
    renderGuestGrid();
  });
  const unsubSel = onSnapshot(selectionsCol(code), (qs) => {
    partyState.selections = {};
    qs.forEach((d) => (partyState.selections[d.id] = d.data()));
    renderGuestGrid();
  });
  activeUnsubs.push(unsubParty, unsubGuests, unsubSel);
}

function mutualActivityIdsWith(otherUid) {
  const mine = (partyState.selections[currentUid]?.targets || {})[otherUid] || [];
  const theirs = (partyState.selections[otherUid]?.targets || {})[currentUid] || [];
  return mine.filter((id) => theirs.includes(id));
}

function activityById(id) {
  return (partyState.party?.activities || []).find((a) => a.id === id);
}

function renderGuestGrid() {
  if (!partyState.party) return; // wait for party doc to load first
  const grid = $("#guest-grid");
  grid.innerHTML = "";
  Object.entries(partyState.guests)
    .filter(([uid]) => uid !== currentUid)
    .sort((a, b) => (a[1].name || "").localeCompare(b[1].name || ""))
    .forEach(([uid, g]) => {
      const myPicks = (partyState.selections[currentUid]?.targets || {})[uid] || [];
      const mutual = mutualActivityIdsWith(uid);
      const card = document.createElement("div");
      card.className = "guest-card";
      const pills = myPicks
        .map((id) => activityById(id)?.name)
        .filter(Boolean)
        .map((name) => `<span class="pill">${escapeHtml(name)}</span>`)
        .join("");
      card.innerHTML = `
        ${mutual.length ? `<span class="mutual-badge">Mutual</span>` : ""}
        <img src="${g.photo || ""}" alt="${escapeHtml(g.name || "")}" />
        <div class="name">${escapeHtml(g.name || "Guest")}</div>
        <div class="picked-chips">${pills}</div>
      `;
      card.onclick = () => openModal(uid, g);
      grid.appendChild(card);
    });
  if (!grid.children.length) {
    grid.innerHTML = `<p class="hint">No one else has joined yet — share the party code!</p>`;
  }
}

// ---------- Selection modal ----------
function openModal(targetUid, guest) {
  $("#modal-photo").src = guest.photo || "";
  $("#modal-name").textContent = guest.name || "Guest";

  renderModalMutualLine(targetUid);

  const activities = partyState.party?.activities || [];
  const myPicks = new Set((partyState.selections[currentUid]?.targets || {})[targetUid] || []);

  const optionsEl = $("#modal-options");
  optionsEl.innerHTML = "";
  if (!activities.length) {
    optionsEl.innerHTML = `<p class="hint">The host hasn't added any activities yet.</p>`;
  }
  activities.forEach((act) => {
    const chip = document.createElement("div");
    chip.className = "option-chip" + (myPicks.has(act.id) ? " selected" : "");
    chip.innerHTML = `<span class="activity-name">${escapeHtml(act.name)}</span>${act.description ? `<span class="activity-desc">${escapeHtml(act.description)}</span>` : ""}`;
    chip.onclick = async () => {
      const nowSelected = chip.classList.toggle("selected");
      const field = `targets.${targetUid}`;
      try {
        await updateDoc(selectionDoc(partyState.code, currentUid), {
          [field]: nowSelected ? arrayUnion(act.id) : arrayRemove(act.id),
        });
        logHistory(partyState.code, targetUid, act.id, nowSelected ? "select" : "deselect");
        renderModalMutualLine(targetUid);
      } catch (err) {
        console.error(err);
        chip.classList.toggle("selected"); // revert on failure
        toast("Couldn't save — check your connection.");
      }
    };
    optionsEl.appendChild(chip);
  });

  $("#modal-overlay").classList.remove("hidden");
}

function renderModalMutualLine(targetUid) {
  const mutual = mutualActivityIdsWith(targetUid).map((id) => activityById(id)?.name).filter(Boolean);
  const el = $("#modal-mutual");
  if (mutual.length) {
    el.textContent = `You're both open to: ${mutual.join(", ")}`;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

$("#modal-close").onclick = () => $("#modal-overlay").classList.add("hidden");
$("#modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") $("#modal-overlay").classList.add("hidden");
});

async function leaveParty(code) {
  if (!confirm("Leave this party? Your photo and picks will be removed.")) return;
  try {
    await deleteDoc(selectionDoc(code, currentUid));
    await deleteDoc(guestDoc(code, currentUid));
  } catch (err) { console.error(err); }
  location.hash = "#";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
