import React, { useState } from 'react';
import './ToggleSection.css';
// Importa gli stili per il componente, dovrai creare questo file
// Se vuoi usare il tuo style.css globale, puoi integrare il CSS lì.
// Per ora assumiamo che tu lo voglia in un file dedicato.
// import './ToggleSection.css'; 

const ToggleSection = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleContent = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="toggle-section">
      <h3 className="toggle-title" onClick={toggleContent}>
        {title}
        {/* Icona per indicare lo stato (aperto/chiuso) */}
        <span className={`toggle-icon ${isOpen ? 'open' : ''}`}>&#9660;</span> 
      </h3>
      {/* Contenuto che viene mostrato/nascosto con l'animazione */}
      <div className={`toggle-content ${isOpen ? 'open' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default ToggleSection;