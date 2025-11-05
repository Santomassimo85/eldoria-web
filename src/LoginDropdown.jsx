// src/LoginDropdown.jsx (COMPLETO E AGGIORNATO CON MENU ESPANDIBILE)

import React, { useState, useEffect } from 'react'; // Importiamo useEffect e useState
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase'; 
import { doc, onSnapshot } from 'firebase/firestore'; // Per recuperare i dati in tempo reale

const ROLL20_SHEET_MAP = {};

const LoginDropdown = ({ closeMenu = () => {} }) => {
    const { currentUser, logout, login } = useAuth();
    const navigate = useNavigate();
    
    // Stato per il form di Login
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    // Stato per il saldo Platinum (MP)
    const [platinum, setPlatinum] = useState(null); 
    
    // Stato per l'apertura del menu a discesa (pulsante "Accedi" o nome utente)
    const [isOpen, setIsOpen] = useState(false); 

    // --- LOGICA DI RECUPERO MONETE PLATINO (MP) ---
    useEffect(() => {
        if (!currentUser) {
            setPlatinum(null);
            return;
        }

        // Il documento del personaggio (PG) è mappato sull'UID dell'utente
        const charRef = doc(db, 'characters', currentUser.uid); 
        
        // Ascolta in tempo reale le modifiche al saldo
        const unsubscribe = onSnapshot(charRef, (docSnap) => {
            if (docSnap.exists()) {
                // Se il campo esiste, prendi il saldo, altrimenti 0
                setPlatinum(docSnap.data().platinum || 0); 
            } else {
                setPlatinum(0); // Nessun documento personaggio trovato, saldo 0
            }
        }, (error) => {
            console.error("Errore nel caricamento del saldo:", error);
            setPlatinum('Errore'); // Segnala un errore di caricamento
        });

        // Pulizia al dismount/logout
        return () => unsubscribe(); 
    }, [currentUser]); 

    // --- GESTIONE LOGIN ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
            setIsOpen(false); // Chiude il menu al successo
            closeMenu();
        } catch (err) {
            setError("Credenziali non valide.");
            console.error("Errore di login:", err); 
        }
    };
    
    // --- GESTIONE LOGOUT ---
    const handleLogout = () => {
        logout();
        setIsOpen(false); // Chiude il menu
        closeMenu();
        navigate('/'); // Opzionale: reindirizza alla homepage
    };

    // 🎯 FUNZIONE CORRETTA: NAVIGA INTERNAMENTE
    const handleOpenSheet = () => {
        // Non aprire un link esterno, ma naviga alla nuova pagina editor
        navigate('/my-pg'); 
        
        setIsOpen(false); 
        closeMenu();
    };


   // --- RENDERING (CASO UTENTE LOGGATO) ---
    if (currentUser) {
        return (
            <div className="login-dropdown-container">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="logged-user-button nav-button" 
                    title={currentUser.email}
                >
                    {currentUser.email.split('@')[0]}
                    <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
                </button>

                {/* MENU A DISCESA */}
                {isOpen && (
                    <div className="dropdown-menu">
                        
                        <div className="menu-item-info">
                            💰 **Monete Platino:** {platinum !== null ? `${platinum} MP` : 'Caricamento...'}
                        </div>
                        <hr className="menu-divider" />

                        {/* 🎯 VOCE AGGIORNATA: Chiama la navigazione interna */}
                        <a 
                            onClick={handleOpenSheet} 
                            className="menu-item"
                            style={{ fontWeight: 'bold' }} 
                        >
                            Scheda Personaggio
                        </a>
                        
                        <a 
                            onClick={handleLogout} 
                            className="menu-item logout-link"
                        >
                            Logout
                        </a>
                    </div>
                )}
            </div>
        );
    }
    
    // --- RENDERING (CASO UTENTE SLOGGATO) ---
    return (
        <div className="login-dropdown-container">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="login-button nav-button" 
            >
                Accedi
            </button>
            
            {isOpen && (
                <div className="login-dropdown-content">
                    {error && <p className="login-error">{error}</p>}
                    <form onSubmit={handleLogin}>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button type="submit">Entra</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default LoginDropdown;