import React, { useState, useEffect } from 'react';

const NEXT_SESSION_DATE = new Date("2025-11-02T18:00:00").getTime(); 

const Countdown = () => {
    // ... (Logica dello stato e useEffect invariati) ...
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const difference = NEXT_SESSION_DATE - now;

            if (difference > 0) {
                setTimeLeft(difference);
            } else {
                setTimeLeft(0);
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, []);

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    const formattedDate = new Date(NEXT_SESSION_DATE).toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    if (timeLeft <= 0) {
        return (
            <div className="countdown-container">
                <h3 className="countdown-title">Prossima Sessione</h3>
                <p className="countdown-date">
                    Sessione in Corso o Terminata!
                </p>
            </div>
        );
    }

    return (
        <div className="countdown-container">
            <h3 className="countdown-title">Prossima Sessione</h3>
            <div className="countdown-timer">
                {/* Visualizzazione orizzontale con numeri grandi e etichette sotto */}
                <div>
                    {String(days).padStart(2, '0')}
                    <span>Giorni</span>
                </div>
                <div>
                    {String(hours).padStart(2, '0')}
                    <span>Ore</span>
                </div>
                <div>
                    {String(minutes).padStart(2, '0')}
                    <span>Minuti</span>
                </div>
                <div>
                    {String(seconds).padStart(2, '0')}
                    <span>Secondi</span>
                </div>
            </div>
            <p className="countdown-date">
                {formattedDate}
                <br />
                Ore 18.00
            </p>
            <button>Unisciti alla Sessione</button>
        </div>
    );
};

export default Countdown;