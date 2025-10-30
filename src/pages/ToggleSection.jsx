import React, { useState } from 'react';
import './ToggleSection.css';

const ToggleSection = ({ title, children, defaultOpen = false, titleClass = '', contentClass = '' }) => { // Aggiunto contentClass
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleContent = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="toggle-section">
      <h3 className={`toggle-title ${titleClass}`} onClick={toggleContent}> 
        {title}
        {/* Icona per indicare lo stato (aperto/chiuso) */}
        <span className={`toggle-icon ${isOpen ? 'open' : ''}`}>&#9660;</span> 
      </h3>
      {/* Applico la nuova classe qui, insieme alla classe 'open' */}
      <div className={`toggle-content ${isOpen ? 'open' : ''} ${contentClass}`}>
        {children}
      </div>
    </div>
  );
};

export default ToggleSection;