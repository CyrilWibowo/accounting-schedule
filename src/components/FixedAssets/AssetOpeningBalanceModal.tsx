import React, { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { OpeningBalance } from '../../types/Asset';
import '../Leases/OpeningBalanceModal.css';

interface AssetOpeningBalanceModalProps {
  openingBalances: OpeningBalance[];
  onAdd: (ob: OpeningBalance) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}

const formatDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

const AssetOpeningBalanceModal: React.FC<AssetOpeningBalanceModalProps> = ({
  openingBalances,
  onAdd,
  onDelete,
  onClose,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'New' | 'Existing'>('New');
  const [date, setDate] = useState('');
  const [value, setValue] = useState('');
  const [errors, setErrors] = useState<{ date?: boolean }>({});

  const handleAdd = () => {
    if (!date) { setErrors({ date: true }); return; }
    onAdd({ type, date, value: type === 'Existing' ? value : '' });
    setShowForm(false);
    setType('New');
    setDate('');
    setValue('');
    setErrors({});
  };

  return (
    <div className="opening-balance-overlay" onMouseDown={onClose}>
      <div className="opening-balance-content" style={{ maxWidth: 600 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="opening-balance-header">
          <h2 className="opening-balance-title">Opening Balances</h2>
          <button className="opening-balance-close-button" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="opening-balance-actions">
          <button className="add-opening-balance-button" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : 'Add Opening Balance'}
          </button>
        </div>

        {showForm && (
          <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 8, padding: '16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'New' | 'Existing')}
                style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
              >
                <option value="New">New</option>
                <option value="Existing">Existing</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setErrors({}); }}
                style={{ padding: '6px 10px', borderRadius: 4, border: `1px solid ${errors.date ? '#dc3545' : '#ccc'}`, fontSize: 13 }}
              />
            </div>
            {type === 'Existing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Balance</label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13, width: 140 }}
                />
              </div>
            )}
            <button
              onClick={handleAdd}
              style={{ padding: '7px 18px', background: '#007bff', color: 'white', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
            >
              Add
            </button>
          </div>
        )}

        <div className="opening-balance-table-container">
          <table className="opening-balance-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Date</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {openingBalances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="opening-balance-empty">No opening balances added yet.</td>
                </tr>
              ) : (
                openingBalances.map((ob, i) => (
                  <tr key={i}>
                    <td>{ob.type}</td>
                    <td>{formatDate(ob.date)}</td>
                    <td>{ob.type === 'Existing' && ob.value ? `$${Number(ob.value).toLocaleString()}` : '—'}</td>
                    <td>
                      <button className="opening-balance-delete-button" onClick={() => onDelete(i)} title="Delete">
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
          <button className="opening-balance-cancel-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default AssetOpeningBalanceModal;
