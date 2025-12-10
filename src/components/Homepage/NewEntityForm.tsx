import React, { useState } from 'react';
import { saveEntity } from '../../utils/dataStorage';
import { Entity } from '../../types/Entity';
import './NewEntityForm.css';

interface NewEntityFormProps {
  isOpen: boolean;
  onClose: () => void;
  onEntityCreated?: (entity: Entity) => void;
}

const NewEntityForm: React.FC<NewEntityFormProps> = ({ isOpen, onClose, onEntityCreated }) => {
  const [companyName, setCompanyName] = useState('');
  const [abnAcn, setAbnAcn] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      return;
    }

    const newEntity: Entity = {
      id: crypto.randomUUID(),
      name: companyName.trim(),
      abnAcn: abnAcn.trim(),
      address: address.trim(),
    };

    const success = await saveEntity(newEntity);
    if (success) {
      setCompanyName('');
      setAbnAcn('');
      setAddress('');
      onEntityCreated?.(newEntity);
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="new-entity-overlay" onMouseDown={handleOverlayClick}>
      <div className="new-entity-modal">
        <div className="new-entity-header">
          <h2>New Entity</h2>
          <button className="new-entity-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="new-entity-field">
            <label htmlFor="companyName">Company Name</label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <div className="new-entity-field">
            <label htmlFor="abnAcn">ABN / ACN</label>
            <input
              type="text"
              id="abnAcn"
              value={abnAcn}
              onChange={(e) => setAbnAcn(e.target.value)}
            />
          </div>
          <div className="new-entity-field">
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
            />
          </div>
          <div className="new-entity-actions">
            <button type="button" className="new-entity-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="new-entity-submit">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewEntityForm;
