import React, { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import './ToXLSXModal.css';
import { OpeningBalance } from '../types/Lease';

interface ToXLSXModalProps {
  onClose: () => void;
  onGenerate: (params: XLSXGenerationParams) => void;
  openingBalances?: OpeningBalance[];
}

export interface OpeningBalanceParams {
  rightToUseAssets: number | '';
  accDeprRightToUseAssets: number | '';
  leaseLiabilityCurrent: number | '';
  leaseLiabilityNonCurrent: number | '';
  depreciationExpense: number | '';
  interestExpenseRent: number | '';
  rentExpense: number | '';
}

export interface XLSXGenerationParams {
  leaseLiabilityOpening: string;
  leaseLiabilityClosing: string;
  paymentTiming: 'Beginning' | 'End';
  allocationToLeaseComponent: number;
  isExtension: boolean;
  openingBalance: OpeningBalanceParams;
}

// Normalize date string to YYYY-MM-DD format for comparison
const normalizeDateString = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  // Return ISO date string (YYYY-MM-DD)
  return date.toISOString().split('T')[0];
};

const ToXLSXModal: React.FC<ToXLSXModalProps> = ({ onClose, onGenerate, openingBalances = [] }) => {
  const [params, setParams] = useState<XLSXGenerationParams>({
    leaseLiabilityOpening: '',
    leaseLiabilityClosing: '',
    paymentTiming: 'Beginning',
    allocationToLeaseComponent: 1,
    isExtension: false,
    openingBalance: {
      rightToUseAssets: '',
      accDeprRightToUseAssets: '',
      leaseLiabilityCurrent: '',
      leaseLiabilityNonCurrent: '',
      depreciationExpense: '',
      interestExpenseRent: '',
      rentExpense: ''
    }
  });

  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  // Auto-fill opening balance when opening date matches an existing opening balance
  useEffect(() => {
    if (!params.leaseLiabilityOpening || openingBalances.length === 0) return;

    const normalizedInputDate = normalizeDateString(params.leaseLiabilityOpening);

    // Find matching opening balance by normalized date
    const matchingBalance = openingBalances.find(ob =>
      normalizeDateString(ob.openingDate) === normalizedInputDate
    );

    if (matchingBalance) {
      // Auto-fill the opening balance fields and set isExtension based on the matched balance
      setParams(prev => ({
        ...prev,
        isExtension: matchingBalance.isNewLeaseExtension,
        openingBalance: {
          rightToUseAssets: matchingBalance.rightToUseAssets,
          accDeprRightToUseAssets: matchingBalance.accDeprRightToUseAssets,
          leaseLiabilityCurrent: matchingBalance.leaseLiabilityCurrent,
          leaseLiabilityNonCurrent: matchingBalance.leaseLiabilityNonCurrent,
          depreciationExpense: matchingBalance.depreciationExpense,
          interestExpenseRent: matchingBalance.interestExpenseRent,
          rentExpense: matchingBalance.rentExpense
        }
      }));
    }
  }, [params.leaseLiabilityOpening, openingBalances]);

  const handleInputChange = (field: keyof XLSXGenerationParams, value: string | number) => {
    setParams({ ...params, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: false });
    }
  };

  const handleOpeningBalanceChange = (field: keyof OpeningBalanceParams, value: string) => {
    const numValue = value === '' ? '' : parseFloat(value);
    setParams({
      ...params,
      openingBalance: {
        ...params.openingBalance,
        [field]: numValue
      }
    });
  };

  const handleExtensionToggle = (checked: boolean) => {
    setParams({
      ...params,
      isExtension: checked
    });
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!params.leaseLiabilityOpening) {
      newErrors.leaseLiabilityOpening = true;
      isValid = false;
    }
    if (!params.leaseLiabilityClosing) {
      newErrors.leaseLiabilityClosing = true;
      isValid = false;
    }
    if (!params.allocationToLeaseComponent && params.allocationToLeaseComponent !== 0) {
      newErrors.allocationToLeaseComponent = true;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleGenerate = () => {
    if (validateForm()) {
      const finalParams = params.isExtension
        ? {
            ...params,
            openingBalance: {
              rightToUseAssets: 0,
              accDeprRightToUseAssets: 0,
              leaseLiabilityCurrent: 0,
              leaseLiabilityNonCurrent: 0,
              depreciationExpense: 0,
              interestExpenseRent: 0,
              rentExpense: 0
            }
          }
        : params;
      onGenerate(finalParams);
      onClose();
    }
  };

  return (
    <div className="xlsx-modal-overlay" onMouseDown={onClose}>
      <div className="xlsx-modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="xlsx-modal-header">
          <h2 className="xlsx-modal-title">Excel Generation Settings</h2>
          <button className="xlsx-close-button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="xlsx-form-grid">
          <div className="xlsx-form-group">
            <label className="xlsx-form-label">Lease Liability Opening *</label>
            {errors.leaseLiabilityOpening && <span className="xlsx-error-text">This field is required</span>}
            <input
              type="date"
              className={errors.leaseLiabilityOpening ? 'xlsx-form-input-error' : 'xlsx-form-input'}
              value={params.leaseLiabilityOpening}
              onChange={(e) => handleInputChange('leaseLiabilityOpening', e.target.value)}
            />
          </div>

          <div className="xlsx-form-group">
            <label className="xlsx-form-label">Lease Liability Closing *</label>
            {errors.leaseLiabilityClosing && <span className="xlsx-error-text">This field is required</span>}
            <input
              type="date"
              className={errors.leaseLiabilityClosing ? 'xlsx-form-input-error' : 'xlsx-form-input'}
              value={params.leaseLiabilityClosing}
              onChange={(e) => handleInputChange('leaseLiabilityClosing', e.target.value)}
            />
          </div>

          <div className="xlsx-form-group">
            <label className="xlsx-form-label">Payments made at Beginning or End of Period *</label>
            <select
              className="xlsx-form-input"
              value={params.paymentTiming}
              onChange={(e) => handleInputChange('paymentTiming', e.target.value as 'Beginning' | 'End')}
            >
              <option value="Beginning">Beginning</option>
              <option value="End">End</option>
            </select>
          </div>

          <div className="xlsx-form-group">
            <label className="xlsx-form-label">Allocation to Lease Component *</label>
            {errors.allocationToLeaseComponent && <span className="xlsx-error-text">This field is required</span>}
            <input
              type="number"
              className={errors.allocationToLeaseComponent ? 'xlsx-form-input-error' : 'xlsx-form-input'}
              value={params.allocationToLeaseComponent}
              onChange={(e) => handleInputChange('allocationToLeaseComponent', parseFloat(e.target.value))}
              placeholder="1"
              step="0.01"
              min="0"
              max="1"
            />
          </div>
        </div>

        <div className="xlsx-section-header">
          <h3 className="xlsx-section-title">Opening Balance</h3>
          <label className="xlsx-checkbox-label">
            <input
              type="checkbox"
              checked={params.isExtension}
              onChange={(e) => handleExtensionToggle(e.target.checked)}
              className="xlsx-checkbox"
            />
            New Lease / Extension
          </label>
        </div>

        {!params.isExtension && (
          <div className="xlsx-form-grid">
            <div className="xlsx-form-group">
              <label className="xlsx-form-label">Right to Use Assets</label>
              <input
                type="number"
                className="xlsx-form-input"
                value={params.openingBalance.rightToUseAssets}
                onChange={(e) => handleOpeningBalanceChange('rightToUseAssets', e.target.value)}
                placeholder="0"
                step="0.01"
              />
            </div>

            <div className="xlsx-form-group">
              <label className="xlsx-form-label">Acc. Depr. Right to Use Assets</label>
              <input
                type="number"
                className="xlsx-form-input"
                value={params.openingBalance.accDeprRightToUseAssets}
                onChange={(e) => handleOpeningBalanceChange('accDeprRightToUseAssets', e.target.value)}
                placeholder="0"
                step="0.01"
              />
            </div>

            <div className="xlsx-form-group">
              <label className="xlsx-form-label">Lease Liability - Current</label>
              <input
                type="number"
                className="xlsx-form-input"
                value={params.openingBalance.leaseLiabilityCurrent}
                onChange={(e) => handleOpeningBalanceChange('leaseLiabilityCurrent', e.target.value)}
                placeholder="0"
                step="0.01"
              />
            </div>

            <div className="xlsx-form-group">
              <label className="xlsx-form-label">Lease Liability - Non-Current</label>
              <input
                type="number"
                className="xlsx-form-input"
                value={params.openingBalance.leaseLiabilityNonCurrent}
                onChange={(e) => handleOpeningBalanceChange('leaseLiabilityNonCurrent', e.target.value)}
                placeholder="0"
                step="0.01"
              />
            </div>

            <div className="xlsx-form-group">
              <label className="xlsx-form-label">Depreciation Expense</label>
              <input
                type="number"
                className="xlsx-form-input"
                value={params.openingBalance.depreciationExpense}
                onChange={(e) => handleOpeningBalanceChange('depreciationExpense', e.target.value)}
                placeholder="0"
                step="0.01"
              />
            </div>

            <div className="xlsx-form-group">
              <label className="xlsx-form-label">Interest Expense Rent</label>
              <input
                type="number"
                className="xlsx-form-input"
                value={params.openingBalance.interestExpenseRent}
                onChange={(e) => handleOpeningBalanceChange('interestExpenseRent', e.target.value)}
                placeholder="0"
                step="0.01"
              />
            </div>

            <div className="xlsx-form-group">
              <label className="xlsx-form-label">Rent Expense</label>
              <input
                type="number"
                className="xlsx-form-input"
                value={params.openingBalance.rentExpense}
                onChange={(e) => handleOpeningBalanceChange('rentExpense', e.target.value)}
                placeholder="0"
                step="0.01"
              />
            </div>
          </div>
        )}

        <div className="xlsx-modal-actions">
          <button className="xlsx-cancel-button" onClick={onClose}>Cancel</button>
          <button className="xlsx-generate-button" onClick={handleGenerate}>Generate Excel</button>
        </div>
      </div>
    </div>
  );
};

export default ToXLSXModal;