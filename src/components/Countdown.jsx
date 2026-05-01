import { useState, useEffect } from 'react';

/**
 * Componente Countdown dinamico per i party di Exanthia.
 * @param {string} targetDate - Stringa data formato ISO (es. 2026-02-20T21:00:00)
 * @param {string} partyName - Nome del gruppo (Amea, Lac, Enox)
 */
const Countdown = ({ targetDate, partyName }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    // LINK ROLL20 FISSO PER TUTTI I PARTY
    const FIXED_ROLL20_LINK = "https://santomassimo85.eu.forge-vtt.com";

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            
            // Se la data non è valida o non ancora impostata dall'admin
            if (isNaN(target)) {
                setTimeLeft(0);
                return;
            }

            const difference = target - now;
            setTimeLeft(difference > 0 ? difference : 0);
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    // Calcolo giorni, ore, minuti e secondi
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    // Formattazione della data leggibile (es: 20 Febbraio, ore 21:00)
    const formattedDate = targetDate 
        ? new Date(targetDate).toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })
        : "Data non impostata";

    return (
        <div className="countdown-container">
            {/* Mostra Amea, Lac o Enox passato come partyName */}
            <h2 className="countdown-party-name" style={{ color: "var(--gold)", fontFamily: "Cinzel Decorative" }}>
                {partyName}
            </h2>
            
            <h3 className="countdown-title">Prossima Sessione</h3>
            
            {timeLeft > 0 ? (
                <>
                    <div className="countdown-timer">
                        <div>{String(days).padStart(2, '0')}<span>Giorni</span></div>
                        <div>{String(hours).padStart(2, '0')}<span>Ore</span></div>
                        <div>{String(minutes).padStart(2, '0')}<span>Minuti</span></div>
                        <div>{String(seconds).padStart(2, '0')}<span>Secondi</span></div>
                    </div>
                    <p className="countdown-date">Fissata per: {formattedDate}</p>
                </>
            ) : (
                <div className="session-active-msg">
                    <p>⚔️ La sessione è in corso o è terminata!</p>
                    <p style={{ fontSize: '0.8em', opacity: 0.7 }}>In attesa del Master per la prossima data.</p>
                </div>
            )}

            {/* Il bottone usa sempre il link fisso Exanthia 3.0 */}
            <button className="roll20-btn" style={{ marginTop: "20px" }}>
                <a 
                    href={FIXED_ROLL20_LINK} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="button-link"
                >
                    Entra su Foundry VTT
                </a>
            </button>
        </div>
    );
};

export default Countdown;