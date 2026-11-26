// Multi-character support restricted to Soran's account only.
import { auth } from "../firebase";

export const SORAN_AUTH_UID = "ipAONmlrnmgb2p9ncTbOLlY75cT2";
export const ZARETH_CHAR_ID = "ipAONmlrnmgb2p9ncTbOLlY75cT2__zareth";

export const MULTI_CHAR_ACCOUNTS = {
  [SORAN_AUTH_UID]: [
    { id: SORAN_AUTH_UID, label: "Soran" },
    { id: ZARETH_CHAR_ID, label: "Zareth" },
  ],
};

const storageKey = (authUid) => `eldoria_active_char_${authUid}`;

export function getCharsForAuth(authUid) {
  return authUid ? MULTI_CHAR_ACCOUNTS[authUid] || null : null;
}

export function isMultiCharAuth(authUid) {
  return Boolean(getCharsForAuth(authUid));
}

export function getStoredCharId(authUid) {
  const list = getCharsForAuth(authUid);
  if (!list) return null;
  try {
    const val = localStorage.getItem(storageKey(authUid));
    if (val && list.some((c) => c.id === val)) return val;
  } catch { /* storage blocked */ }
  return null;
}

export function setStoredCharId(authUid, charId) {
  if (!authUid) return;
  try {
    if (!charId) localStorage.removeItem(storageKey(authUid));
    else localStorage.setItem(storageKey(authUid), charId);
  } catch { /* storage blocked */ }
}

export function getActiveCharId() {
  const authUid = auth.currentUser?.uid;
  if (!authUid) return null;
  if (!isMultiCharAuth(authUid)) return authUid;
  return getStoredCharId(authUid) || authUid;
}
