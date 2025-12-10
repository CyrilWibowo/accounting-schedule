// components/EditLeaseModal.tsx
import React, { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Lease, PropertyLease, MotorVehicleLease, OpeningBalance, Branch } from '../types/Lease';
import { generateLeaseId } from '../utils/helper';
import OpeningBalanceModal from './OpeningBalanceModal';
import './EditLeaseModal.css';

const BRANCH_OPTIONS: Branch[] = ['PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'CORP', 'PERT-RTS', 'MACK-RTS', 'ADEL-RTS', 'PARK'];

interface EditLeaseModalProps {
  lease: Lease;
  onClose: () => void;
  onSave: (lease: Lease) => void;
  onDelete: (leaseId: string) => void;
  onCopy: (lease: Lease) => void;
}

const EditLeaseModal: React.FC<EditLeaseModalProps> = ({ lease, onClose, onSave, onDelete, onCopy }) => {
  const [editedLease, setEditedLease] = useState<Lease>(lease);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [committedYears, setCommittedYears] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);

  // Local state for monthly rent to allow typing without immediate formatting
  const [monthlyRentInput, setMonthlyRentInput] = useState(() => {
    return lease.annualRent ? (parseFloat(lease.annualRent) / 12).toFixed(2) : '';
  });

  useEffect(() => {
    calculateCommittedYears();
  }, [editedLease]);

  // Sync monthly rent input when editedLease.annualRent changes externally
  useEffect(() => {
    const calculatedMonthly = editedLease.annualRent ? (parseFloat(editedLease.annualRent) / 12).toFixed(2) : '';
    // Only update if values are meaningfully different (to avoid cursor jump during typing)
    if (Math.abs(parseFloat(calculatedMonthly || '0') - parseFloat(monthlyRentInput || '0')) > 0.001 ||
        (!editedLease.annualRent && monthlyRentInput)) {
      setMonthlyRentInput(calculatedMonthly);
    }
  }, [editedLease.annualRent]);

  const calculateCommittedYears = () => {
    if (editedLease.type === 'Property') {
      const propertyLease = editedLease as PropertyLease;
      if (propertyLease.commencementDate && propertyLease.expiryDate) {
        const start = new Date(propertyLease.commencementDate);
        const end = new Date(propertyLease.expiryDate);

        // Calculate total months from commencement to expiry
        const months = (end.getFullYear() - start.getFullYear()) * 12 +
                      (end.getMonth() - start.getMonth());

        // Only add 1 if the end date day is AFTER the start date day
        const adjustedMonths = end.getDate() > start.getDate() ? months + 1 : months;

        const optionsYears = parseInt(propertyLease.options) || 0;
        const totalMonths = adjustedMonths + (optionsYears * 12);
        const total = Math.ceil(totalMonths / 12);

        setCommittedYears(total > 0 ? total : 0);
      } else {
        setCommittedYears(0);
      }
    } else {
      const mvLease = editedLease as MotorVehicleLease;
      if (mvLease.deliveryDate && mvLease.expiryDate) {
        const start = new Date(mvLease.deliveryDate);
        const end = new Date(mvLease.expiryDate);

        // Calculate total months
        const months = (end.getFullYear() - start.getFullYear()) * 12 +
                      (end.getMonth() - start.getMonth());

        // Only add 1 if the end date day is AFTER the start date day
        const adjustedMonths = end.getDate() > start.getDate() ? months + 1 : months;
        const total = Math.ceil(adjustedMonths / 12);

        setCommittedYears(total > 0 ? total : 0);
      } else {
        setCommittedYears(0);
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditedLease({ ...editedLease, [field]: value } as Lease);
    if (errors[field]) {
      setErrors({ ...errors, [field]: false });
    }
  };

  const handleIncrementMethodChange = (year: number, value: string) => {
    const updatedMethods = { ...editedLease.incrementMethods, [year]: value };
    const updatedLease = { ...editedLease, incrementMethods: updatedMethods };

    if (value !== 'Market') {
      const updatedOverrides = { ...editedLease.overrideAmounts };
      delete updatedOverrides[year];
      updatedLease.overrideAmounts = updatedOverrides;
    }

    setEditedLease(updatedLease as Lease);
  };

  const handleOverrideAmountChange = (year: number, value: string) => {
    const updatedOverrides = { ...editedLease.overrideAmounts, [year]: value };
    setEditedLease({ ...editedLease, overrideAmounts: updatedOverrides } as Lease);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    // Common validations
    if (!editedLease.entity?.trim()) {
      newErrors.entity = true;
      isValid = false;
    }
    if (!editedLease.lessor?.trim()) {
      newErrors.lessor = true;
      isValid = false;
    }
    if (!editedLease.branch?.trim()) {
      newErrors.branch = true;
      isValid = false;
    }
    if (!editedLease.annualRent.trim()) {
      newErrors.annualRent = true;
      isValid = false;
    }
    if (!editedLease.borrowingRate.trim()) {
      newErrors.borrowingRate = true;
      isValid = false;
    }

    if (editedLease.type === 'Property') {
      const propertyLease = editedLease as PropertyLease;
      if (!propertyLease.propertyAddress?.trim()) {
        newErrors.propertyAddress = true;
        isValid = false;
      }
      if (!propertyLease.commencementDate) {
        newErrors.commencementDate = true;
        isValid = false;
      }
      if (!propertyLease.expiryDate) {
        newErrors.expiryDate = true;
        isValid = false;
      }
      if (!propertyLease.options.trim()) {
        newErrors.options = true;
        isValid = false;
      }
      if (!propertyLease.fixedIncrementRate.trim()) {
        newErrors.fixedIncrementRate = true;
        isValid = false;
      }
      if (!propertyLease.rbaCpiRate.trim()) {
        newErrors.rbaCpiRate = true;
        isValid = false;
      }

      // Validate increment methods starting from year 1
      if (committedYears >= 1) {
        for (let year = 1; year <= committedYears; year++) {
          if (!propertyLease.incrementMethods[year]) {
            newErrors[`incrementMethod_${year}`] = true;
            isValid = false;
          }
          if (propertyLease.incrementMethods[year] === 'Market' && !propertyLease.overrideAmounts[year]?.trim()) {
            newErrors[`overrideAmount_${year}`] = true;
            isValid = false;
          }
        }
      }
    } else {
      const mvLease = editedLease as MotorVehicleLease;
      if (!mvLease.description?.trim()) {
        newErrors.description = true;
        isValid = false;
      }
      if (!mvLease.vinSerialNo?.trim()) {
        newErrors.vinSerialNo = true;
        isValid = false;
      }
      if (!mvLease.regoNo?.trim()) {
        newErrors.regoNo = true;
        isValid = false;
      }
      if (!mvLease.deliveryDate) {
        newErrors.deliveryDate = true;
        isValid = false;
      }
      if (!mvLease.expiryDate) {
        newErrors.expiryDate = true;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSave(editedLease);
      onClose();
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete(lease.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleCopy = () => {
    setShowCopyConfirm(true);
  };

  const confirmCopy = () => {
    const copiedLease: Lease = {
      ...editedLease,
      id: crypto.randomUUID(),
      leaseId: generateLeaseId(editedLease.type),
    };
    onCopy(copiedLease);
    setShowCopyConfirm(false);
    onClose();
  };

  const handleAddOpeningBalance = (openingBalance: OpeningBalance) => {
    const updatedBalances = [...(editedLease.openingBalances || []), openingBalance];
    setEditedLease({ ...editedLease, openingBalances: updatedBalances } as Lease);
  };

  const handleDeleteOpeningBalance = (id: string) => {
    const updatedBalances = (editedLease.openingBalances || []).filter((ob) => ob.id !== id);
    setEditedLease({ ...editedLease, openingBalances: updatedBalances } as Lease);
  };

  const isPropertyLease = editedLease.type === 'Property';

  return (
    <>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Edit {editedLease.type} Lease</h2>
            <button className="close-button" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>

          <div className="form-grid">
            {/* Entity - Common field */}
            <div className="form-group">
              <label className="form-label">Entity *</label>
              {errors.entity && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.entity ? 'form-input-error' : 'form-input'}
                value={editedLease.entity}
                onChange={(e) => handleInputChange('entity', e.target.value)}
                placeholder="Enter entity"
              />
            </div>

            {/* Lessor - Common field */}
            <div className="form-group">
              <label className="form-label">Lessor *</label>
              {errors.lessor && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.lessor ? 'form-input-error' : 'form-input'}
                value={editedLease.lessor}
                onChange={(e) => handleInputChange('lessor', e.target.value)}
                placeholder="Enter lessor"
              />
            </div>

            {/* Property Lease Fields */}
            {isPropertyLease && (
              <>
                <div className="form-group">
                  <label className="form-label">Property Address *</label>
                  {errors.propertyAddress && <span className="error-text">This field is required</span>}
                  <input
                    type="text"
                    className={errors.propertyAddress ? 'form-input-error' : 'form-input'}
                    value={(editedLease as PropertyLease).propertyAddress}
                    onChange={(e) => handleInputChange('propertyAddress', e.target.value)}
                    placeholder="Enter property address"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Branch *</label>
                  {errors.branch && <span className="error-text">This field is required</span>}
                  <select
                    className={errors.branch ? 'form-input-error' : 'form-input'}
                    value={editedLease.branch}
                    onChange={(e) => handleInputChange('branch', e.target.value)}
                  >
                    <option value="">Select branch...</option>
                    {BRANCH_OPTIONS.map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Commencement Date *</label>
                  {errors.commencementDate && <span className="error-text">This field is required</span>}
                  <input
                    type="date"
                    className={errors.commencementDate ? 'form-input-error' : 'form-input'}
                    value={(editedLease as PropertyLease).commencementDate}
                    onChange={(e) => handleInputChange('commencementDate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date *</label>
                  {errors.expiryDate && <span className="error-text">This field is required</span>}
                  <input
                    type="date"
                    className={errors.expiryDate ? 'form-input-error' : 'form-input'}
                    value={(editedLease as PropertyLease).expiryDate}
                    onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Options (Years) *</label>
                  {errors.options && <span className="error-text">This field is required</span>}
                  <input
                    type="number"
                    className={errors.options ? 'form-input-error' : 'form-input'}
                    value={(editedLease as PropertyLease).options}
                    onChange={(e) => handleInputChange('options', e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </>
            )}

            {/* Motor Vehicle Lease Fields */}
            {!isPropertyLease && (
              <>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  {errors.description && <span className="error-text">This field is required</span>}
                  <input
                    type="text"
                    className={errors.description ? 'form-input-error' : 'form-input'}
                    value={(editedLease as MotorVehicleLease).description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter description"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Branch *</label>
                  {errors.branch && <span className="error-text">This field is required</span>}
                  <select
                    className={errors.branch ? 'form-input-error' : 'form-input'}
                    value={editedLease.branch}
                    onChange={(e) => handleInputChange('branch', e.target.value)}
                  >
                    <option value="">Select branch...</option>
                    {BRANCH_OPTIONS.map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Vehicle Type *</label>
                  {errors.vehicleType && <span className="error-text">This field is required</span>}
                  <select
                    className={errors.vehicleType ? 'form-input-error' : 'form-input'}
                    value={(editedLease as MotorVehicleLease).vehicleType}
                    onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                  >
                    <option value="">Select vehicle type...</option>
                    <option value="Ute">Ute</option>
                    <option value="Wagon">Wagon</option>
                    <option value="Forklift">Forklift</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Engine Number *</label>
                  {errors.engineNumber && <span className="error-text">This field is required</span>}
                  <input
                    type="text"
                    className={errors.engineNumber ? 'form-input-error' : 'form-input'}
                    value={(editedLease as MotorVehicleLease).engineNumber}
                    onChange={(e) => handleInputChange('engineNumber', e.target.value)}
                    placeholder="Enter Engine Number"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">VIN/Serial No. *</label>
                  {errors.vinSerialNo && <span className="error-text">This field is required</span>}
                  <input
                    type="text"
                    className={errors.vinSerialNo ? 'form-input-error' : 'form-input'}
                    value={(editedLease as MotorVehicleLease).vinSerialNo}
                    onChange={(e) => handleInputChange('vinSerialNo', e.target.value)}
                    placeholder="Enter VIN/Serial No."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rego No. *</label>
                  {errors.regoNo && <span className="error-text">This field is required</span>}
                  <input
                    type="text"
                    className={errors.regoNo ? 'form-input-error' : 'form-input'}
                    value={(editedLease as MotorVehicleLease).regoNo}
                    onChange={(e) => handleInputChange('regoNo', e.target.value)}
                    placeholder="Enter Rego No."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Delivery Date *</label>
                  {errors.deliveryDate && <span className="error-text">This field is required</span>}
                  <input
                    type="date"
                    className={errors.deliveryDate ? 'form-input-error' : 'form-input'}
                    value={(editedLease as MotorVehicleLease).deliveryDate}
                    onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date *</label>
                  {errors.expiryDate && <span className="error-text">This field is required</span>}
                  <input
                    type="date"
                    className={errors.expiryDate ? 'form-input-error' : 'form-input'}
                    value={(editedLease as MotorVehicleLease).expiryDate}
                    onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Monthly Rent - displayed as monthly, stored as annual */}
            <div className="form-group">
              <label className="form-label">Monthly Rent (exc. GST) *</label>
              {errors.annualRent && <span className="error-text">This field is required</span>}
              <input
                type="number"
                className={errors.annualRent ? 'form-input-error' : 'form-input'}
                value={monthlyRentInput}
                onChange={(e) => {
                  const monthlyValue = e.target.value;
                  setMonthlyRentInput(monthlyValue);
                  const annualValue = monthlyValue ? (parseFloat(monthlyValue) * 12).toString() : '';
                  handleInputChange('annualRent', annualValue);
                }}
                onBlur={() => {
                  // Format to 2 decimal places on blur
                  if (monthlyRentInput) {
                    setMonthlyRentInput(parseFloat(monthlyRentInput).toFixed(2));
                  }
                }}
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* RBA CPI Rate - Property only */}
            {isPropertyLease && (
              <div className="form-group">
                <label className="form-label">RBA CPI Rate (%) *</label>
                {errors.rbaCpiRate && <span className="error-text">This field is required</span>}
                <input
                  type="number"
                  className={errors.rbaCpiRate ? 'form-input-error' : 'form-input'}
                  value={(editedLease as PropertyLease).rbaCpiRate}
                  onChange={(e) => handleInputChange('rbaCpiRate', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            )}

            {/* Borrowing Rate - Common field */}
            <div className="form-group">
              <label className="form-label">Borrowing Rate (%) *</label>
              {errors.borrowingRate && <span className="error-text">This field is required</span>}
              <input
                type="number"
                className={errors.borrowingRate ? 'form-input-error' : 'form-input'}
                value={editedLease.borrowingRate}
                onChange={(e) => handleInputChange('borrowingRate', e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Fixed Increment Rate - Property only */}
            {isPropertyLease && (
              <div className="form-group">
                <label className="form-label">Fixed Increment Rate (%) *</label>
                {errors.fixedIncrementRate && <span className="error-text">This field is required</span>}
                <input
                  type="number"
                  className={errors.fixedIncrementRate ? 'form-input-error' : 'form-input'}
                  value={(editedLease as PropertyLease).fixedIncrementRate}
                  onChange={(e) => handleInputChange('fixedIncrementRate', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            )}
          </div>

          {/* Only show increment methods for Property leases, starting from year 1 */}
          {isPropertyLease && committedYears >= 1 && (
            <div className="increment-section">
              <h4 className="increment-title">Increment Methods (Committed Years: {committedYears})</h4>
              <div className="increment-grid">
                {Array.from({ length: committedYears }, (_, i) => i + 1).map((year) => (
                  <div key={year} className="increment-group">
                    <div className="form-group">
                      <label className="form-label">Year {year}</label>
                      <select
                        value={editedLease.incrementMethods[year] || ''}
                        onChange={(e) => handleIncrementMethodChange(year, e.target.value)}
                        className={errors[`incrementMethod_${year}`] ? 'form-input-error' : 'form-input'}
                      >
                        <option value="">Select method...</option>
                        <option value="Fixed">Fix Rate</option>
                        <option value="Market">Market</option>
                        <option value="CPI">CPI</option>
                        <option value="None">None</option>
                      </select>
                      {errors[`incrementMethod_${year}`] && (
                        <span className="error-text">This field is required</span>
                      )}
                    </div>

                    {editedLease.incrementMethods[year] === 'Market' && (
                      <div className="form-group">
                        <label className="form-label">Override Amount *</label>
                        {errors[`overrideAmount_${year}`] && (
                          <span className="error-text">Override amount is required</span>
                        )}
                        <input
                          type="number"
                          className={errors[`overrideAmount_${year}`] ? 'form-input-error' : 'form-input'}
                          value={editedLease.overrideAmounts[year] || ''}
                          onChange={(e) => handleOverrideAmountChange(year, e.target.value)}
                          placeholder="Enter override amount"
                          step="0.01"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <div className="left-button-group">
              <button className="delete-button" onClick={handleDelete}>
                <DeleteIcon /> Delete
              </button>
              <button className="copy-button" onClick={handleCopy}>
                <ContentCopyIcon /> Copy
              </button>
              <button className="opening-balance-button" onClick={() => setShowOpeningBalance(true)}>
                Manage Opening Balance
              </button>
            </div>
            <div className="button-group">
              <button className="cancel-button" onClick={onClose}>Cancel</button>
              <button className="save-button" onClick={handleSubmit}>Save Changes</button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="confirm-overlay" onMouseDown={() => setShowDeleteConfirm(false)}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Delete Lease?</h3>
            <p className="confirm-text">
              Are you sure you want to delete this lease? This action cannot be undone.
            </p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="confirm-delete-button" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showCopyConfirm && (
        <div className="confirm-overlay" onMouseDown={() => setShowCopyConfirm(false)}>
          <div className="confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">Copy Lease?</h3>
            <p className="confirm-text">
              This will create a duplicate of this lease with all the same details. Continue?
            </p>
            <div className="confirm-actions">
              <button className="confirm-cancel-button" onClick={() => setShowCopyConfirm(false)}>
                Cancel
              </button>
              <button className="confirm-copy-button" onClick={confirmCopy}>
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {showOpeningBalance && (
        <OpeningBalanceModal
          openingBalances={editedLease.openingBalances || []}
          onAdd={handleAddOpeningBalance}
          onDelete={handleDeleteOpeningBalance}
          onClose={() => setShowOpeningBalance(false)}
        />
      )}
    </>
  );
};

export default EditLeaseModal;