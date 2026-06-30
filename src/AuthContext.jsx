// src/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ensureBaseCharacter } from './utils/ensureBaseCharacter';

// Struttura del contesto per il valore iniziale e per evitare errori di tipizzazione
const initialContextValue = {
    currentUser: null,
    login: () => null,
    logout: () => null,
};

// Crea il contesto
const AuthContext = createContext(initialContextValue);

// Hook personalizzato per accedere al contesto (useAuth)
// Questo è il codice corretto che stavi cercando di dichiarare:
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Funzione per il login con email e password
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Funzione per il logout
  const logout = () => {
    return signOut(auth);
  };

  // Ascolta i cambiamenti di stato (quando l'utente si logga o slogga)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
      // Player senza PG → assegna una volta sola il guerriero base (Lv4).
      if (user) ensureBaseCharacter(user);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} 
    </AuthContext.Provider>
  );
};