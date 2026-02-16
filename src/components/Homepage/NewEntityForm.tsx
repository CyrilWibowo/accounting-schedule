import React, { useState, useEffect } from 'react';
import { saveEntity, updateEntityLeasesCompanyCode } from '../../utils/dataStorage';
import { Entity } from '../../types/Entity';
import './NewEntityForm.css';

interface NewEntityFormProps {
  isOpen: boolean;
  onClose: () => void;
  onEntityCreated?: (entity: Entity) => void;
  editEntity?: Entity | null;
}

const NewEntityForm: React.FC<NewEntityFormProps> = ({ isOpen, onClose, onEntityCreated, editEntity }) => {
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [abnAcn, setAbnAcn] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const isEditMode = !!editEntity;

  useEffect(() => {
    if (editEntity) {
      setCompanyName(editEntity.name);
      setCompanyCode(editEntity.companyCode);
      setAbnAcn(editEntity.abnAcn);
      setAddress(editEntity.address);
    } else {
      setCompanyName('');
      setCompanyCode('');
      setAbnAcn('');
      setAddress('');
    }
    setErrors({});
  }, [editEntity, isOpen]);

  const handleFieldChange = (field: string) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { [key: string]: boolean } = {};

    if (!companyName.trim()) {
      newErrors.companyName = true;
    }
    if (!companyCode.trim()) {
      newErrors.companyCode = true;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const entityToSave: Entity = {
      id: editEntity?.id ?? crypto.randomUUID(),
      name: companyName.trim(),
      companyCode: companyCode.trim(),
      abnAcn: abnAcn.trim(),
      address: address.trim(),
    };

    const success = await saveEntity(entityToSave);
    if (success) {
      // If editing and company code changed, update all leases for this entity
      if (isEditMode && editEntity.companyCode !== companyCode.trim()) {
        await updateEntityLeasesCompanyCode(entityToSave.id, companyCode.trim());
      }

      setCompanyName('');
      setCompanyCode('');
      setAbnAcn('');
      setAddress('');
      setErrors({});
      onEntityCreated?.(entityToSave);
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
            {errors.companyName && <span className="new-entity-error-text">This field is required</span>}
            <input
              type="text"
              id="companyName"
              className={errors.companyName ? 'new-entity-input-error' : ''}
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                handleFieldChange('companyName');
              }}
            />
          </div>
          <div className="new-entity-field">
            <label htmlFor="companyCode">Company Code</label>
            {errors.companyCode && <span className="new-entity-error-text">This field is required</span>}
            <input
              type="text"
              id="companyCode"
              className={errors.companyCode ? 'new-entity-input-error' : ''}
              value={companyCode}
              onChange={(e) => {
                setCompanyCode(e.target.value);
                handleFieldChange('companyCode');
              }}
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
              {isEditMode ? 'Save Changes' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewEntityForm;
