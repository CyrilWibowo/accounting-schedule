// components/LeaseForm.tsx
import React, { useState, useEffect } from 'react';
import { Lease, PropertyLease, MotorVehicleLease, Branch } from '../types/Lease';
import './LeaseForm.css';

const BRANCH_OPTIONS: Branch[] = ['PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'CORP', 'PERT-RTS', 'MACK-RTS', 'ADEL-RTS', 'PARK'];

interface LeaseFormProps {
  lease: Lease;
  leaseType: 'Property' | 'Motor Vehicle';
  errors: { [key: string]: boolean };
  committedYears: number;
  onInputChange: (field: string, value: string) => void;
  onIncrementMethodChange: (year: number, value: string) => void;
  onOverrideAmountChange: (year: number, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const LeaseForm: React.FC<LeaseFormProps> = ({
  lease,
  leaseType,
  errors,
  committedYears,
  onInputChange,
  onIncrementMethodChange,
  onOverrideAmountChange,
  onSubmit,
  onClose
}) => {
  const isPropertyLease = lease.type === 'Property';

  // Local state for monthly rent to allow typing without immediate formatting
  const [monthlyRentInput, setMonthlyRentInput] = useState(() => {
    return lease.annualRent ? (parseFloat(lease.annualRent) / 12).toFixed(2) : '';
  });

  // Sync local state when lease.annualRent changes externally
  useEffect(() => {
    const calculatedMonthly = lease.annualRent ? (parseFloat(lease.annualRent) / 12).toFixed(2) : '';
    // Only update if the values are meaningfully different (to avoid cursor jump during typing)
    if (Math.abs(parseFloat(calculatedMonthly || '0') - parseFloat(monthlyRentInput || '0')) > 0.001 ||
        (!lease.annualRent && monthlyRentInput)) {
      setMonthlyRentInput(calculatedMonthly);
    }
  }, [lease.annualRent]);

  return (
    <div className="lease-form-modal">
      <h2>Add {leaseType} Lease</h2>

      <div className="form-grid">
        {/* Entity - Common field */}
        <div className="form-group">
          <label>Entity *</label>
          {errors.entity && <span className="error-text">This field is required</span>}
          <input
            type="text"
            className={errors.entity ? 'error' : ''}
            value={lease.entity}
            onChange={(e) => onInputChange('entity', e.target.value)}
            placeholder="Enter entity"
          />
        </div>

        {/* Lessor - Common field */}
        <div className="form-group">
          <label>Lessor *</label>
          {errors.lessor && <span className="error-text">This field is required</span>}
          <input
            type="text"
            className={errors.lessor ? 'error' : ''}
            value={lease.lessor}
            onChange={(e) => onInputChange('lessor', e.target.value)}
            placeholder="Enter lessor"
          />
        </div>

        {/* Property Lease Fields */}
        {isPropertyLease && (
          <>
            <div className="form-group">
              <label>Property Address *</label>
              {errors.propertyAddress && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.propertyAddress ? 'error' : ''}
                value={(lease as PropertyLease).propertyAddress}
                onChange={(e) => onInputChange('propertyAddress', e.target.value)}
                placeholder="Enter property address"
              />
            </div>

            <div className="form-group">
              <label>Branch *</label>
              {errors.branch && <span className="error-text">This field is required</span>}
              <select
                className={errors.branch ? 'error' : ''}
                value={lease.branch}
                onChange={(e) => onInputChange('branch', e.target.value)}
              >
                <option value="">Select branch...</option>
                {BRANCH_OPTIONS.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Commencement Date *</label>
              {errors.commencementDate && <span className="error-text">This field is required</span>}
              <input
                type="date"
                className={errors.commencementDate ? 'error' : ''}
                value={(lease as PropertyLease).commencementDate}
                onChange={(e) => onInputChange('commencementDate', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Expiry Date *</label>
              {errors.expiryDate && <span className="error-text">This field is required</span>}
              <input
                type="date"
                className={errors.expiryDate ? 'error' : ''}
                value={(lease as PropertyLease).expiryDate}
                onChange={(e) => onInputChange('expiryDate', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Options (Years) *</label>
              {errors.options && <span className="error-text">This field is required</span>}
              <input
                type="number"
                className={errors.options ? 'error' : ''}
                value={(lease as PropertyLease).options}
                onChange={(e) => onInputChange('options', e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
          </>
        )}

        {/* Motor Vehicle Lease Fields - Entity Name removed */}
        {!isPropertyLease && (
          <>
            <div className="form-group">
              <label>Description *</label>
              {errors.description && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.description ? 'error' : ''}
                value={(lease as MotorVehicleLease).description}
                onChange={(e) => onInputChange('description', e.target.value)}
                placeholder="Enter description"
              />
            </div>

            <div className="form-group">
              <label>Branch *</label>
              {errors.branch && <span className="error-text">This field is required</span>}
              <select
                className={errors.branch ? 'error' : ''}
                value={lease.branch}
                onChange={(e) => onInputChange('branch', e.target.value)}
              >
                <option value="">Select branch...</option>
                {BRANCH_OPTIONS.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>VIN/Serial No. *</label>
              {errors.vinSerialNo && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.vinSerialNo ? 'error' : ''}
                value={(lease as MotorVehicleLease).vinSerialNo}
                onChange={(e) => onInputChange('vinSerialNo', e.target.value)}
                placeholder="Enter VIN/Serial No."
              />
            </div>

            <div className="form-group">
              <label>Rego No. *</label>
              {errors.regoNo && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.regoNo ? 'error' : ''}
                value={(lease as MotorVehicleLease).regoNo}
                onChange={(e) => onInputChange('regoNo', e.target.value)}
                placeholder="Enter Rego No."
              />
            </div>

            <div className="form-group">
              <label>Engine Number *</label>
              {errors.engineNumber && <span className="error-text">This field is required</span>}
              <input
                type="text"
                className={errors.engineNumber ? 'error' : ''}
                value={(lease as MotorVehicleLease).engineNumber}
                onChange={(e) => onInputChange('engineNumber', e.target.value)}
                placeholder="Enter Engine Number"
              />
            </div>

            <div className="form-group">
              <label>Vehicle Type *</label>
              {errors.vehicleType && <span className="error-text">This field is required</span>}
              <select
                className={errors.vehicleType ? 'error' : ''}
                value={(lease as MotorVehicleLease).vehicleType}
                onChange={(e) => onInputChange('vehicleType', e.target.value)}
              >
                <option value="">Select vehicle type...</option>
                <option value="Ute">Ute</option>
                <option value="Wagon">Wagon</option>
                <option value="Forklift">Forklift</option>
              </select>
            </div>

            <div className="form-group">
              <label>Delivery Date *</label>
              {errors.deliveryDate && <span className="error-text">This field is required</span>}
              <input
                type="date"
                className={errors.deliveryDate ? 'error' : ''}
                value={(lease as MotorVehicleLease).deliveryDate}
                onChange={(e) => onInputChange('deliveryDate', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Expiry Date *</label>
              {errors.expiryDate && <span className="error-text">This field is required</span>}
              <input
                type="date"
                className={errors.expiryDate ? 'error' : ''}
                value={(lease as MotorVehicleLease).expiryDate}
                onChange={(e) => onInputChange('expiryDate', e.target.value)}
              />
            </div>
          </>
        )}

        {/* Monthly Rent - displayed as monthly, stored as annual */}
        <div className="form-group">
          <label>Monthly Rent (exc. GST) *</label>
          {errors.annualRent && <span className="error-text">This field is required</span>}
          <input
            type="number"
            className={errors.annualRent ? 'error' : ''}
            value={monthlyRentInput}
            onChange={(e) => {
              const monthlyValue = e.target.value;
              setMonthlyRentInput(monthlyValue);
              const annualValue = monthlyValue ? (parseFloat(monthlyValue) * 12).toString() : '';
              onInputChange('annualRent', annualValue);
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
            <label>RBA CPI Rate (%) *</label>
            {errors.rbaCpiRate && <span className="error-text">This field is required</span>}
            <input
              type="number"
              className={errors.rbaCpiRate ? 'error' : ''}
              value={(lease as PropertyLease).rbaCpiRate}
              onChange={(e) => onInputChange('rbaCpiRate', e.target.value)}
              placeholder="0.00"
              step="0.01"
            />
          </div>
        )}

        {/* Borrowing Rate - Common field */}
        <div className="form-group">
          <label>Borrowing Rate (%) *</label>
          {errors.borrowingRate && <span className="error-text">This field is required</span>}
          <input
            type="number"
            className={errors.borrowingRate ? 'error' : ''}
            value={lease.borrowingRate}
            onChange={(e) => onInputChange('borrowingRate', e.target.value)}
            placeholder="0.00"
            step="0.01"
          />
        </div>

        {/* Fixed Increment Rate - Property only */}
        {isPropertyLease && (
          <div className="form-group">
            <label>Fixed Increment Rate (%) *</label>
            {errors.fixedIncrementRate && <span className="error-text">This field is required</span>}
            <input
              type="number"
              className={errors.fixedIncrementRate ? 'error' : ''}
              value={(lease as PropertyLease).fixedIncrementRate}
              onChange={(e) => onInputChange('fixedIncrementRate', e.target.value)}
              placeholder="0.00"
              step="0.01"
            />
          </div>
        )}
      </div>

      {/* Only show increment methods for Property leases, starting from year 1 */}
      {isPropertyLease && committedYears >= 1 && (
        <div className="increment-methods-section">
          <h4>Increment Methods (Committed Years: {committedYears})</h4>
          <div className="increment-methods-grid">
            {Array.from({ length: committedYears }, (_, i) => i + 1).map((year) => (
              <div key={year} className="increment-method-group">
                <div className="form-group">
                  <label>Year {year}</label>
                  <select
                    value={lease.incrementMethods[year] || ''}
                    onChange={(e) => onIncrementMethodChange(year, e.target.value)}
                    className={errors[`incrementMethod_${year}`] ? 'error' : ''}
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

                {lease.incrementMethods[year] === 'Market' && (
                  <div className="form-group override-amount">
                    <label>Override Amount *</label>
                    {errors[`overrideAmount_${year}`] && (
                      <span className="error-text">Override amount is required</span>
                    )}
                    <input
                      type="number"
                      className={errors[`overrideAmount_${year}`] ? 'error' : ''}
                      value={lease.overrideAmounts[year] || ''}
                      onChange={(e) => onOverrideAmountChange(year, e.target.value)}
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
        <button className="cancel-button" onClick={onClose}>Cancel</button>
        <button className="save-button" onClick={onSubmit}>Save Lease</button>
      </div>
    </div>
  );
};

export default LeaseForm;