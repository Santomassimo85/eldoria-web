// src/LoginDropdown.jsx

import React, { useState } from 'react';
import { useAuth } from './AuthContext';

// Questo componente gestisce sia il form che il bottone Logout
const LoginDropdown = ({ standalone = false, closeMenu = () => {} }) => {
    const { currentUser, logout, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(standalone); // Mostra il form se è standalone

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
            setShowForm(false);
            closeMenu();
        } catch (err) { // Usa 'err'
    setError("Credenziali non valide.");
    console.error("Errore di login:", err); // 👈 Usa la variabile 'err' qui
        }
    };
    
    // CASO 1: Utente Loggato
    if (currentUser) {
        return (
            <div className="logged-status-box">
                <span className="logged-user" title={currentUser.email}>({currentUser.email.split('@')[0]})</span>
                <button 
                  onClick={() => { logout(); closeMenu(); }}
                  className="logout-button nav-button" 
                >
                    Logout
                </button>
            </div>
        );
    }
    
    // CASO 2: Utente Sloggato
    return (
        <div className="login-dropdown-container">
            {/* Pulsante che apre il form (non visibile se standalone=true) */}
            {!standalone && (
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className="login-button nav-button" 
                >
                    Accedi
                </button>
            )}
            
            {/* Form che appare sotto il pulsante (o sempre se standalone) */}
            {(showForm || standalone) && (
                <div className={`login-dropdown-content ${standalone ? 'standalone-form' : ''}`}>
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