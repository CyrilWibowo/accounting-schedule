import React, { useState } from 'react';
import { CIPInvoice } from '../../types/Asset';
import '../Leases/AddLeaseModal.css';
import '../Leases/LeaseForm.css';
import './AddAssetModal.css';

interface AddCIPInvoiceModalProps {
  onClose: () => void;
  onSave: (invoice: CIPInvoice) => void;
}

const generateInvoiceId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const AddCIPInvoiceModal: React.FC<AddCIPInvoiceModalProps> = ({ onClose, onSave }) => {
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!description.trim()) { newErrors.description = true; isValid = false; }
    if (!vendorName.trim()) { newErrors.vendorName = true; isValid = false; }
    if (!invoiceNo.trim()) { newErrors.invoiceNo = true; isValid = false; }
    if (!date) { newErrors.date = true; isValid = false; }
    if (!amount.trim()) { newErrors.amount = true; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSave({
        id: generateInvoiceId(),
        description,
        vendorName,
        invoiceNo,
        date,
        amount,
      });
    }
  };

  const clearError = (field: string) => {
    if (errors[field]) setErrors({ ...errors, [field]: false });
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="asset-form-modal lease-form-modal">
          <h2>Add Invoice</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Description *</label>
              {errors.description && <span className="error-text">Required</span>}
              <input
                type="text"
                className={errors.description ? 'error' : ''}
                value={description}
                onChange={(e) => { setDescription(e.target.value); clearError('description'); }}
              />
            </div>

            <div className="form-group">
              <label>Vendor Name *</label>
              {errors.vendorName && <span className="error-text">Required</span>}
              <input
                type="text"
                className={errors.vendorName ? 'error' : ''}
                value={vendorName}
                onChange={(e) => { setVendorName(e.target.value); clearError('vendorName'); }}
              />
            </div>

            <div className="form-group">
              <label>Invoice No. *</label>
              {errors.invoiceNo && <span className="error-text">Required</span>}
              <input
                type="text"
                className={errors.invoiceNo ? 'error' : ''}
                value={invoiceNo}
                onChange={(e) => { setInvoiceNo(e.target.value); clearError('invoiceNo'); }}
              />
            </div>

            <div className="form-group">
              <label>Invoice Date *</label>
              {errors.date && <span className="error-text">Required</span>}
              <input
                type="date"
                className={errors.date ? 'error' : ''}
                value={date}
                onChange={(e) => { setDate(e.target.value); clearError('date'); }}
              />
            </div>

            <div className="form-group">
              <label>Amount *</label>
              {errors.amount && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.amount ? 'error' : ''}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); clearError('amount'); }}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={onClose}>Cancel</button>
            <button className="save-button" onClick={handleSubmit}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCIPInvoiceModal;
