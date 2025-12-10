import React, { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { OpeningBalance } from '../types/Lease';
import './AddOpeningBalanceForm.css';

interface AddOpeningBalanceFormProps {
  existingDates: string[];
  onAdd: (openingBalance: OpeningBalance) => void;
  onClose: () => void;
}

interface FormData {
  openingDate: string;
  isNewLeaseExtension: boolean;
  rightToUseAssets: number | '';
  accDeprRightToUseAssets: number | '';
  leaseLiabilityCurrent: number | '';
  leaseLiabilityNonCurrent: number | '';
  depreciationExpense: number | '';
  interestExpenseRent: number | '';
  rentExpense: number | '';
}

const AddOpeningBalanceForm: React.FC<AddOpeningBalanceFormProps> = ({
  existingDates,
  onAdd,
  onClose,
}) => {
  const [formData, setFormData] = useState<FormData>({
    openingDate: '',
    isNewLeaseExtension: false,
    rightToUseAssets: '',
    accDeprRightToUseAssets: '',
    leaseLiabilityCurrent: '',
    leaseLiabilityNonCurrent: '',
    depreciationExpense: '',
    interestExpenseRent: '',
    rentExpense: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleDateChange = (value: string) => {
    setFormData({ ...formData, openingDate: value });
    if (errors.openingDate) {
      setErrors({ ...errors, openingDate: '' });
    }
  };

  const handleExtensionToggle = (checked: boolean) => {
    setFormData({
      ...formData,
      isNewLeaseExtension: checked,
    });
  };

  const handleBalanceChange = (field: keyof FormData, value: string) => {
    const numValue = value === '' ? '' : parseFloat(value);
    setFormData({
      ...formData,
      [field]: numValue,
    });
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    let isValid = true;

    if (!formData.openingDate) {
      newErrors.openingDate = 'Opening date is required';
      isValid = false;
    } else if (existingDates.includes(formData.openingDate)) {
      newErrors.openingDate = 'An opening balance already exists for this date';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const openingBalance: OpeningBalance = {
        id: crypto.randomUUID(),
        openingDate: formData.openingDate,
        isNewLeaseExtension: formData.isNewLeaseExtension,
        rightToUseAssets: formData.isNewLeaseExtension ? 0 : (formData.rightToUseAssets === '' ? 0 : formData.rightToUseAssets),
        accDeprRightToUseAssets: formData.isNewLeaseExtension ? 0 : (formData.accDeprRightToUseAssets === '' ? 0 : formData.accDeprRightToUseAssets),
        leaseLiabilityCurrent: formData.isNewLeaseExtension ? 0 : (formData.leaseLiabilityCurrent === '' ? 0 : formData.leaseLiabilityCurrent),
        leaseLiabilityNonCurrent: formData.isNewLeaseExtension ? 0 : (formData.leaseLiabilityNonCurrent === '' ? 0 : formData.leaseLiabilityNonCurrent),
        depreciationExpense: formData.isNewLeaseExtension ? 0 : (formData.depreciationExpense === '' ? 0 : formData.depreciationExpense),
        interestExpenseRent: formData.isNewLeaseExtension ? 0 : (formData.interestExpenseRent === '' ? 0 : formData.interestExpenseRent),
        rentExpense: formData.isNewLeaseExtension ? 0 : (formData.rentExpense === '' ? 0 : formData.rentExpense),
      };
      onAdd(openingBalance);
      onClose();
    }
  };

  return (
    <div className="add-ob-overlay" onMouseDown={onClose}>
      <div className="add-ob-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="add-ob-header">
          <h2 className="add-ob-title">Add Opening Balance</h2>
          <button className="add-ob-close-button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="add-ob-form">
          <div className="add-ob-form-group">
            <label className="add-ob-form-label">Opening Date *</label>
            {errors.openingDate && <span className="add-ob-error-text">{errors.openingDate}</span>}
            <input
              type="date"
              className={errors.openingDate ? 'add-ob-form-input-error' : 'add-ob-form-input'}
              value={formData.openingDate}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>

          <div className="add-ob-section-header">
            <h3 className="add-ob-section-title">Opening Balance Values</h3>
            <label className="add-ob-checkbox-label">
              <input
                type="checkbox"
                checked={formData.isNewLeaseExtension}
                onChange={(e) => handleExtensionToggle(e.target.checked)}
                className="add-ob-checkbox"
              />
              New Lease / Extension
            </label>
          </div>

          {!formData.isNewLeaseExtension && (
            <div className="add-ob-balance-grid">
              <div className="add-ob-form-group">
                <label className="add-ob-form-label">Right to Use Assets</label>
                <input
                  type="number"
                  className="add-ob-form-input"
                  value={formData.rightToUseAssets}
                  onChange={(e) => handleBalanceChange('rightToUseAssets', e.target.value)}
                  placeholder="0"
                  step="0.01"
                />
              </div>

              <div className="add-ob-form-group">
                <label className="add-ob-form-label">Acc. Depr. Right to Use Assets</label>
                <input
                  type="number"
                  className="add-ob-form-input"
                  value={formData.accDeprRightToUseAssets}
                  onChange={(e) => handleBalanceChange('accDeprRightToUseAssets', e.target.value)}
                  placeholder="0"
                  step="0.01"
                />
              </div>

              <div className="add-ob-form-group">
                <label className="add-ob-form-label">Lease Liability - Current</label>
                <input
                  type="number"
                  className="add-ob-form-input"
                  value={formData.leaseLiabilityCurrent}
                  onChange={(e) => handleBalanceChange('leaseLiabilityCurrent', e.target.value)}
                  placeholder="0"
                  step="0.01"
                />
              </div>

              <div className="add-ob-form-group">
                <label className="add-ob-form-label">Lease Liability - Non-Current</label>
                <input
                  type="number"
                  className="add-ob-form-input"
                  value={formData.leaseLiabilityNonCurrent}
                  onChange={(e) => handleBalanceChange('leaseLiabilityNonCurrent', e.target.value)}
                  placeholder="0"
                  step="0.01"
                />
              </div>

              <div className="add-ob-form-group">
                <label className="add-ob-form-label">Depreciation Expense</label>
                <input
                  type="number"
                  className="add-ob-form-input"
                  value={formData.depreciationExpense}
                  onChange={(e) => handleBalanceChange('depreciationExpense', e.target.value)}
                  placeholder="0"
                  step="0.01"
                />
              </div>

              <div className="add-ob-form-group">
                <label className="add-ob-form-label">Interest Expense Rent</label>
                <input
                  type="number"
                  className="add-ob-form-input"
                  value={formData.interestExpenseRent}
                  onChange={(e) => handleBalanceChange('interestExpenseRent', e.target.value)}
                  placeholder="0"
                  step="0.01"
                />
              </div>

              <div className="add-ob-form-group">
                <label className="add-ob-form-label">Rent Expense</label>
                <input
                  type="number"
                  className="add-ob-form-input"
                  value={formData.rentExpense}
                  onChange={(e) => handleBalanceChange('rentExpense', e.target.value)}
                  placeholder="0"
                  step="0.01"
                />
              </div>
            </div>
          )}
        </div>

        <div className="add-ob-actions">
          <button className="add-ob-cancel-button" onClick={onClose}>Cancel</button>
          <button className="add-ob-submit-button" onClick={handleSubmit}>Add Opening Balance</button>
        </div>
      </div>
    </div>
  );
};

export default AddOpeningBalanceForm;
