import React, { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { PropertyLease, MotorVehicleLease, OpeningBalance } from '../types/Lease';
import './OpeningBalanceManager.css';

interface OpeningBalanceManagerProps {
  type: 'Property' | 'Motor Vehicle';
  propertyLeases: PropertyLease[];
  motorVehicleLeases: MotorVehicleLease[];
  onClose: () => void;
  onSave: (updatedLeases: (PropertyLease | MotorVehicleLease)[]) => void;
  openingDate?: string;
}

interface EditableOpeningBalance {
  leaseId: string;
  leaseIdentifier: string; // Property Address or Rego No
  lessor: string;
  isNewLeaseExtension: boolean;
  rightToUseAssets: number | '';
  accDeprRightToUseAssets: number | '';
  leaseLiabilityCurrent: number | '';
  leaseLiabilityNonCurrent: number | '';
  depreciationExpense: number | '';
  interestExpenseRent: number | '';
  rentExpense: number | '';
}

// Normalize date string to YYYY-MM-DD format for comparison
const normalizeDateString = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const OpeningBalanceManager: React.FC<OpeningBalanceManagerProps> = ({
  type,
  propertyLeases,
  motorVehicleLeases,
  onClose,
  onSave,
  openingDate
}) => {
  const [editableData, setEditableData] = useState<EditableOpeningBalance[]>([]);

  useEffect(() => {
    const leases = type === 'Property' ? propertyLeases : motorVehicleLeases;
    const normalizedOpeningDate = openingDate ? normalizeDateString(openingDate) : '';

    const data: EditableOpeningBalance[] = leases.map((lease) => {
      // Find matching opening balance by date if openingDate is provided
      let matchingBalance: OpeningBalance | undefined;

      if (normalizedOpeningDate && lease.openingBalances?.length > 0) {
        matchingBalance = lease.openingBalances.find(ob =>
          normalizeDateString(ob.openingDate) === normalizedOpeningDate
        );
      }

      // Only fill values if we found a matching balance for the date
      // Otherwise start with blank values
      if (matchingBalance) {
        return {
          leaseId: lease.leaseId,
          leaseIdentifier: type === 'Property'
            ? (lease as PropertyLease).propertyAddress
            : (lease as MotorVehicleLease).regoNo,
          lessor: lease.lessor,
          isNewLeaseExtension: matchingBalance.isNewLeaseExtension,
          rightToUseAssets: matchingBalance.rightToUseAssets,
          accDeprRightToUseAssets: matchingBalance.accDeprRightToUseAssets,
          leaseLiabilityCurrent: matchingBalance.leaseLiabilityCurrent,
          leaseLiabilityNonCurrent: matchingBalance.leaseLiabilityNonCurrent,
          depreciationExpense: matchingBalance.depreciationExpense,
          interestExpenseRent: matchingBalance.interestExpenseRent,
          rentExpense: matchingBalance.rentExpense
        };
      }

      // No matching date - start with blank values
      return {
        leaseId: lease.leaseId,
        leaseIdentifier: type === 'Property'
          ? (lease as PropertyLease).propertyAddress
          : (lease as MotorVehicleLease).regoNo,
        lessor: lease.lessor,
        isNewLeaseExtension: false,
        rightToUseAssets: '',
        accDeprRightToUseAssets: '',
        leaseLiabilityCurrent: '',
        leaseLiabilityNonCurrent: '',
        depreciationExpense: '',
        interestExpenseRent: '',
        rentExpense: ''
      };
    });
    setEditableData(data);
  }, [type, propertyLeases, motorVehicleLeases, openingDate]);

  const handleCheckboxChange = (index: number) => {
    const newData = [...editableData];
    const isNowChecked = !newData[index].isNewLeaseExtension;
    newData[index].isNewLeaseExtension = isNowChecked;

    // Auto-fill all values to zero when "New Lease / Extension" is checked
    if (isNowChecked) {
      newData[index].rightToUseAssets = 0;
      newData[index].accDeprRightToUseAssets = 0;
      newData[index].leaseLiabilityCurrent = 0;
      newData[index].leaseLiabilityNonCurrent = 0;
      newData[index].depreciationExpense = 0;
      newData[index].interestExpenseRent = 0;
      newData[index].rentExpense = 0;
    }

    setEditableData(newData);
  };

  const handleNumberChange = (index: number, field: keyof EditableOpeningBalance, value: string) => {
    const newData = [...editableData];
    if (value === '') {
      (newData[index] as any)[field] = '';
    } else {
      const numValue = parseFloat(value);
      (newData[index] as any)[field] = isNaN(numValue) ? '' : numValue;
    }
    setEditableData(newData);
  };

  const handleSave = () => {
    const leases = type === 'Property' ? propertyLeases : motorVehicleLeases;
    const normalizedOpeningDate = openingDate ? normalizeDateString(openingDate) : '';

    const updatedLeases = leases.map((lease) => {
      const editedData = editableData.find(d => d.leaseId === lease.id);
      if (!editedData) return lease;

      const existingBalances = lease.openingBalances || [];

      const newBalance: OpeningBalance = {
        id: crypto.randomUUID(),
        openingDate: normalizedOpeningDate || new Date().toISOString().split('T')[0],
        isNewLeaseExtension: editedData.isNewLeaseExtension,
        rightToUseAssets: editedData.rightToUseAssets === '' ? 0 : editedData.rightToUseAssets,
        accDeprRightToUseAssets: editedData.accDeprRightToUseAssets === '' ? 0 : editedData.accDeprRightToUseAssets,
        leaseLiabilityCurrent: editedData.leaseLiabilityCurrent === '' ? 0 : editedData.leaseLiabilityCurrent,
        leaseLiabilityNonCurrent: editedData.leaseLiabilityNonCurrent === '' ? 0 : editedData.leaseLiabilityNonCurrent,
        depreciationExpense: editedData.depreciationExpense === '' ? 0 : editedData.depreciationExpense,
        interestExpenseRent: editedData.interestExpenseRent === '' ? 0 : editedData.interestExpenseRent,
        rentExpense: editedData.rentExpense === '' ? 0 : editedData.rentExpense
      };

      // If openingDate is provided, find and update or add the balance for that date
      if (normalizedOpeningDate) {
        const existingIndex = existingBalances.findIndex(ob =>
          normalizeDateString(ob.openingDate) === normalizedOpeningDate
        );

        if (existingIndex >= 0) {
          // Update existing balance for this date
          newBalance.id = existingBalances[existingIndex].id;
          const updatedBalances = [...existingBalances];
          updatedBalances[existingIndex] = newBalance;
          return { ...lease, openingBalances: updatedBalances };
        } else {
          // Add new balance for this date
          return { ...lease, openingBalances: [...existingBalances, newBalance] };
        }
      }

      // No openingDate provided - update/replace the first balance
      if (existingBalances.length > 0) {
        newBalance.id = existingBalances[0].id;
        newBalance.openingDate = existingBalances[0].openingDate;
      }
      return {
        ...lease,
        openingBalances: [newBalance, ...existingBalances.slice(1)]
      };
    });

    onSave(updatedLeases);
    onClose();
  };

  const title = type === 'Property'
    ? 'Manage Property Opening Balances'
    : 'Manage Motor Vehicle Opening Balances';

  const identifierLabel = type === 'Property' ? 'Property Address' : 'Rego No';

  return (
    <div className="ob-manager-overlay" onMouseDown={onClose}>
      <div className="ob-manager-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ob-manager-header">
          <h2 className="ob-manager-title">{title}</h2>
          <button className="ob-manager-close-button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="ob-manager-table-container">
          <table className="ob-manager-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Lessor</th>
                <th>{identifierLabel}</th>
                <th>New Lease / Extension</th>
                <th>Right to Use Assets</th>
                <th>Acc. Depr Right to Use Assets</th>
                <th>Lease Liability - Current</th>
                <th>Lease Liability - Non-Current</th>
                <th>Depreciation Expense</th>
                <th>Interest Expense Rent</th>
                <th>{type === 'Property' ? 'Rent Expense' : 'Vehicle Expense'}</th>
              </tr>
            </thead>
            <tbody>
              {editableData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="ob-manager-empty">
                    No {type.toLowerCase()} leases found
                  </td>
                </tr>
              ) : (
                editableData.map((row, index) => (
                  <tr key={row.leaseId}>
                    <td className="ob-manager-cell-readonly">{row.leaseId.substring(0, 8)}</td>
                    <td className="ob-manager-cell-readonly">{row.lessor}</td>
                    <td className="ob-manager-cell-readonly">{row.leaseIdentifier}</td>
                    <td className="ob-manager-cell-checkbox">
                      <input
                        type="checkbox"
                        checked={row.isNewLeaseExtension}
                        onChange={() => handleCheckboxChange(index)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="ob-manager-input"
                        value={row.rightToUseAssets}
                        onChange={(e) => handleNumberChange(index, 'rightToUseAssets', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="ob-manager-input"
                        value={row.accDeprRightToUseAssets}
                        onChange={(e) => handleNumberChange(index, 'accDeprRightToUseAssets', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="ob-manager-input"
                        value={row.leaseLiabilityCurrent}
                        onChange={(e) => handleNumberChange(index, 'leaseLiabilityCurrent', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="ob-manager-input"
                        value={row.leaseLiabilityNonCurrent}
                        onChange={(e) => handleNumberChange(index, 'leaseLiabilityNonCurrent', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="ob-manager-input"
                        value={row.depreciationExpense}
                        onChange={(e) => handleNumberChange(index, 'depreciationExpense', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="ob-manager-input"
                        value={row.interestExpenseRent}
                        onChange={(e) => handleNumberChange(index, 'interestExpenseRent', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="ob-manager-input"
                        value={row.rentExpense}
                        onChange={(e) => handleNumberChange(index, 'rentExpense', e.target.value)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ob-manager-actions">
          <button className="ob-manager-cancel-button" onClick={onClose}>Cancel</button>
          <button className="ob-manager-save-button" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default OpeningBalanceManager;
