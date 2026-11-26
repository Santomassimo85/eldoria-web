import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { forgetPushToken } from './push/pushClient';
import {
  getCharsForAuth,
  getStoredCharId,
  isMultiCharAuth,
  setStoredCharId,
} from './utils/multiChar';

const initialContextValue = {
  currentUser: null,
  authUid: null,
  activeCharId: null,
  isMultiChar: false,
  charSelectionPending: false,
  charPickerOpen: false,
  openCharPicker: () => {},
  closeCharPicker: () => {},
  selectCharacter: () => {},
  login: () => null,
  logout: () => null,
};

const AuthContext = createContext(initialContextValue);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [activeCharId, setActiveCharId] = useState(null);
  const [charPickerOpen, setCharPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    const uid = auth.currentUser?.uid;
    const chars = getCharsForAuth(uid);
    if (chars) {
      for (const c of chars) {
        try { await forgetPushToken(c.id); } catch { /* ignore */ }
      }
      setStoredCharId(uid, null);
    } else {
      try { await forgetPushToken(uid); } catch { /* ignore */ }
    }
    setActiveCharId(null);
    setCharPickerOpen(false);
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (user && isMultiCharAuth(user.uid)) {
        const stored = getStoredCharId(user.uid);
        setActiveCharId(stored);
        if (!stored) setCharPickerOpen(true);
      } else {
        setActiveCharId(user?.uid || null);
        setCharPickerOpen(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const selectCharacter = useCallback((charId) => {
    if (!authUser || !isMultiCharAuth(authUser.uid)) return;
    const valid = getCharsForAuth(authUser.uid)?.some((c) => c.id === charId);
    if (!valid) return;
    setStoredCharId(authUser.uid, charId);
    setActiveCharId(charId);
    setCharPickerOpen(false);
  }, [authUser]);

  const openCharPicker = useCallback(() => {
    if (authUser && isMultiCharAuth(authUser.uid)) setCharPickerOpen(true);
  }, [authUser]);

  const closeCharPicker = useCallback(() => {
    // On first login before any character is picked, keep modal open until chosen.
    if (authUser && isMultiCharAuth(authUser.uid) && !activeCharId) return;
    setCharPickerOpen(false);
  }, [authUser, activeCharId]);

  const isMultiChar = Boolean(authUser && isMultiCharAuth(authUser.uid));
  const charSelectionPending = isMultiChar && !activeCharId;

  const currentUser = useMemo(() => {
    if (!authUser) return null;
    if (!isMultiChar) return authUser;
    const uid = activeCharId || authUser.uid;
    return new Proxy(authUser, {
      get(target, prop) {
        if (prop === 'uid') return uid;
        if (prop === 'authUid') return target.uid;
        const val = Reflect.get(target, prop, target);
        return typeof val === 'function' ? val.bind(target) : val;
      },
    });
  }, [authUser, isMultiChar, activeCharId]);

  const value = {
    currentUser,
    authUid: authUser?.uid || null,
    activeCharId,
    isMultiChar,
    charSelectionPending,
    charPickerOpen,
    openCharPicker,
    closeCharPicker,
    selectCharacter,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
