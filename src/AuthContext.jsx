// src/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase'; 
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// Struttura del contesto per la tipizzazione
const initialContextValue = {
    currentUser: null,
    login: (email, password) => Promise.resolve(),
    logout: () => Promise.resolve(),
};

const AuthContext = createContext(initialContextValue);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Funzione per il login con email e password
  const login = (email, password) => {
    // Richiesta a Firebase
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