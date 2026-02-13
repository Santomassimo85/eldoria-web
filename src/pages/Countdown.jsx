import { useState, useEffect } from 'react';

// Unix timestamp for the next session date
const NEXT_SESSION_DATE = new Date("2026-02-15T18:30:00").getTime(); 

/**
 * Countdown component that displays a timer until the next session.
 * Shows days, hours, minutes, and seconds remaining.
 * Updates every second using setInterval.
 */
const Countdown = () => {
    // State to store the remaining time in milliseconds
    const [timeLeft, setTimeLeft] = useState(0);

    /**
     * Effect hook to initialize and manage the countdown timer.
     * Calculates time difference and updates state every second.
     */
    useEffect(() => {
        // Calculate the time remaining until the next session
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const difference = NEXT_SESSION_DATE - now;

            if (difference > 0) {
                setTimeLeft(difference);
            } else {
                setTimeLeft(0);
            }
        };

        // Initial calculation
        calculateTimeLeft();
        
        // Update countdown every second
        const timer = setInterval(calculateTimeLeft, 1000);

        // Cleanup interval on component unmount
        return () => clearInterval(timer);
    }, []);

    // Convert milliseconds to days, hours, minutes, and seconds
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    // Format the session date in Italian locale
    const formattedDate = new Date(NEXT_SESSION_DATE).toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    // Display message when the session has started or ended
    if (timeLeft <= 0) {
        return (
            <div className="countdown-container">
                <h3 className="countdown-title">Next Session</h3>
                <p className="countdown-date">
                    Session in Progress or Finished!
                </p>
            </div>
        );
    }

    // Display active countdown timer
    return (
        <div className="countdown-container">
            <h3 className="countdown-title">Next Session</h3>
            <div className="countdown-timer">
                {/* Horizontal layout with large numbers and labels below */}
                <div>
                    {String(days).padStart(2, '0')}
                    <span>Days</span>
                </div>
                <div>
                    {String(hours).padStart(2, '0')}
                    <span>Hours</span>
                </div>
                <div>
                    {String(minutes).padStart(2, '0')}
                    <span>Minutes</span>
                </div>
                <div>
                    {String(seconds).padStart(2, '0')}
                    <span>Seconds</span>
                </div>
            </div>
            <p className="countdown-date">
                {formattedDate}
                <br />
                6:00 PM
            </p>
            <button>
                <a 
                    href="https://app.roll20.net/campaigns/details/19830283/eldoria-3-dot-0" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="button-link"
                >
                    Join the Session
                </a>
            </button>
        </div>
    );
};

export default Countdown;