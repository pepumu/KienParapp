// Stand-in for the Firebase SDK modules app.js imports from
// https://www.gstatic.com/firebasejs/... . Tests serve this in place of
// the real CDN modules (see tests/smoke.spec.js) so the suite never
// depends on live network access or a real Firebase project - it only
// needs the app's own static UI/routing logic to work, which is all
// these smoke tests check.

export function initializeApp() {
  return {};
}

export function getAuth() {
  return {};
}

export function onAuthStateChanged(auth, cb) {
  auth._fireAuthStateChanged = cb;
  return () => {};
}

export function signInAnonymously(auth) {
  const user = { uid: "mock-uid" };
  if (typeof auth._fireAuthStateChanged === "function") {
    auth._fireAuthStateChanged(user);
  }
  return Promise.resolve({ user });
}

export function getFirestore() {
  return {};
}

export function doc() {
  return {};
}

export function collection() {
  return {};
}

export function query() {
  return {};
}

export function getDoc() {
  return Promise.resolve({ exists: () => false, data: () => ({}) });
}

export function setDoc() {
  return Promise.resolve();
}

export function updateDoc() {
  return Promise.resolve();
}

export function deleteDoc() {
  return Promise.resolve();
}

export function addDoc() {
  return Promise.resolve({ id: "mock-id" });
}

export function onSnapshot() {
  return () => {};
}

export function serverTimestamp() {
  return null;
}

export function arrayUnion(...items) {
  return items;
}

export function arrayRemove(...items) {
  return items;
}

export function getCountFromServer() {
  return Promise.resolve({ data: () => ({ count: 0 }) });
}
