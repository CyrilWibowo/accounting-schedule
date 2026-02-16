import React, { useState } from 'react';
import { CIPAsset, AssetCategory, AssetBranch } from '../../types/Asset';
import '../Leases/AddLeaseModal.css';
import '../Leases/LeaseForm.css';
import './AddAssetModal.css';

interface AddCIPModalProps {
  onClose: () => void;
  onSaveCIPAsset: (asset: CIPAsset) => void;
}

const CATEGORIES: AssetCategory[] = [
  'Office Equipment',
  'Motor Vehicle',
  'Warehouse Equipment',
  'Manufacturing Equipment',
  'Equipment for Leased',
  'Software',
];

const BRANCHES: AssetBranch[] = [
  'CORP',
  'PERT',
  'MACK',
  'MTIS',
  'MUSW',
  'NEWM',
  'ADEL',
  'BLAC',
  'PARK',
];

const CATEGORY_CODE: Record<string, string> = {
  'Office Equipment': 'O',
  'Motor Vehicle': 'V',
  'Warehouse Equipment': 'W',
  'Manufacturing Equipment': 'M',
  'Equipment for Leased': 'L',
  'Software': 'S',
};

const generateCIPId = (branch: AssetBranch, category: AssetCategory): string => {
  const catCode = CATEGORY_CODE[category] || 'X';
  const rand = Math.floor(1000 + Math.random() * 9000).toString();
  return `C-${branch}${catCode}${rand}`;
};

const AddCIPModal: React.FC<AddCIPModalProps> = ({ onClose, onSaveCIPAsset }) => {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AssetCategory | ''>('');
  const [branch, setBranch] = useState<AssetBranch | ''>('');
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!description.trim()) { newErrors.description = true; isValid = false; }
    if (!category) { newErrors.category = true; isValid = false; }
    if (!branch) { newErrors.branch = true; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const cipAsset: CIPAsset = {
        id: generateCIPId(branch as AssetBranch, category as AssetCategory),
        assetType: 'CIP',
        description,
        category: category as AssetCategory,
        vendorName: '',
        invoice: '',
        date: '',
        branch: branch as AssetBranch,
        amount: '',
        completed: 'N',
        completionDate: '',
        usefulLife: '',
        invoices: [],
      };
      onSaveCIPAsset(cipAsset);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="asset-form-modal lease-form-modal">
          <h2>New CIP</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Asset Name *</label>
              {errors.description && <span className="error-text">Required</span>}
              <input
                type="text"
                className={errors.description ? 'error' : ''}
                value={description}
                onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors({ ...errors, description: false }); }}
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              {errors.category && <span className="error-text">Required</span>}
              <select
                className={errors.category ? 'error' : ''}
                value={category}
                onChange={(e) => { setCategory(e.target.value as AssetCategory); if (errors.category) setErrors({ ...errors, category: false }); }}
              >
                <option value="">Select Category</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Branch *</label>
              {errors.branch && <span className="error-text">Required</span>}
              <select
                className={errors.branch ? 'error' : ''}
                value={branch}
                onChange={(e) => { setBranch(e.target.value as AssetBranch); if (errors.branch) setErrors({ ...errors, branch: false }); }}
              >
                <option value="">Select Branch</option>
                {BRANCHES.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
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

export default AddCIPModal;
