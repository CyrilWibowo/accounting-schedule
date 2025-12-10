import React from 'react';
import './TypeSelection.css';

interface TypeSelectionProps {
  onTypeSelect: (type: 'Property' | 'Motor Vehicle') => void;
  onClose: () => void;
}

const TypeSelection: React.FC<TypeSelectionProps> = ({ onTypeSelect, onClose }) => {
  return (
    <div className="type-selection">
      <h2>Select Lease Type</h2>
      <div className="type-buttons">
        <button className="type-button" onClick={() => onTypeSelect('Property')}>
          Property
        </button>
        <button className="type-button" onClick={() => onTypeSelect('Motor Vehicle')}>
          Motor Vehicle
        </button>
      </div>
      <button className="cancel-button" onClick={onClose}>Cancel</button>
    </div>
  );
};

export default TypeSelection;