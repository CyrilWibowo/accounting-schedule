import React, { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { OpeningBalance } from '../types/Lease';
import AddOpeningBalanceForm from './AddOpeningBalanceForm';
import './OpeningBalanceModal.css';

interface OpeningBalanceModalProps {
  openingBalances: OpeningBalance[];
  onAdd: (openingBalance: OpeningBalance) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const OpeningBalanceModal: React.FC<OpeningBalanceModalProps> = ({
  openingBalances,
  onAdd,
  onDelete,
  onClose,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);

  const existingDates = openingBalances.map((ob) => ob.openingDate);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const sortedBalances = [...openingBalances].sort(
    (a, b) => new Date(a.openingDate).getTime() - new Date(b.openingDate).getTime()
  );

  return (
    <div className="opening-balance-overlay" onMouseDown={onClose}>
      <div className="opening-balance-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="opening-balance-header">
          <h2 className="opening-balance-title">Manage Opening Balance</h2>
          <button className="opening-balance-close-button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="opening-balance-actions">
          <button
            className="add-opening-balance-button"
            onClick={() => setShowAddForm(true)}
          >
            Add Opening Balance
          </button>
        </div>

        <div className="opening-balance-table-container">
          <table className="opening-balance-table">
            <thead>
              <tr>
                <th>Opening Date</th>
                <th>New Lease / Extension</th>
                <th>Right to Use Assets</th>
                <th>Acc. Depr Right to Use Assets</th>
                <th>Lease Liability - Current</th>
                <th>Lease Liability - Non-Current</th>
                <th>Depreciation Expense</th>
                <th>Interest Expense Rent</th>
                <th>Rent Expense</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedBalances.length === 0 ? (
                <tr>
                  <td colSpan={10} className="opening-balance-empty">
                    No opening balances added yet.
                  </td>
                </tr>
              ) : (
                sortedBalances.map((ob) => (
                  <tr key={ob.id}>
                    <td>{formatDate(ob.openingDate)}</td>
                    <td>{ob.isNewLeaseExtension ? 'Yes' : 'No'}</td>
                    <td>{formatCurrency(ob.rightToUseAssets)}</td>
                    <td>{formatCurrency(ob.accDeprRightToUseAssets)}</td>
                    <td>{formatCurrency(ob.leaseLiabilityCurrent)}</td>
                    <td>{formatCurrency(ob.leaseLiabilityNonCurrent)}</td>
                    <td>{formatCurrency(ob.depreciationExpense)}</td>
                    <td>{formatCurrency(ob.interestExpenseRent)}</td>
                    <td>{formatCurrency(ob.rentExpense)}</td>
                    <td>
                      <button
                        className="opening-balance-delete-button"
                        onClick={() => onDelete(ob.id)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="opening-balance-footer">
          <button className="opening-balance-cancel-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {showAddForm && (
        <AddOpeningBalanceForm
          existingDates={existingDates}
          onAdd={onAdd}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
};

export default OpeningBalanceModal;
