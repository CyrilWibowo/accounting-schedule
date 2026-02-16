import React, { useState } from 'react';
import { Asset, AssetCategory, AssetBranch } from '../../types/Asset';
import '../Leases/AddLeaseModal.css';
import '../Leases/LeaseForm.css';
import './AddAssetModal.css';

interface AddAssetModalProps {
  onClose: () => void;
  onSaveAsset: (asset: Asset) => void;
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

const generateAssetId = (branch: AssetBranch, category: AssetCategory): string => {
  const catCode = CATEGORY_CODE[category] || 'X';
  const rand = Math.floor(1000 + Math.random() * 9000).toString();
  return `${branch}${catCode}${rand}`;
};

const createEmptyAsset = (): Asset => ({
  id: '',
  assetType: 'Regular',
  description: '',
  tagNo: '',
  serialNo: '',
  category: '',
  branch: '',
  cost: '',
  vendorName: '',
  invoice: '',
  usefulLife: '',
  depreciationRate: '',
});

const AddAssetModal: React.FC<AddAssetModalProps> = ({ onClose, onSaveAsset }) => {
  const [asset, setAsset] = useState<Asset>(createEmptyAsset);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const handleAssetInput = (field: keyof Asset, value: string) => {
    setAsset({ ...asset, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: false });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!asset.description.trim()) { newErrors.description = true; isValid = false; }
    if (!asset.category) { newErrors.category = true; isValid = false; }
    if (!asset.branch) { newErrors.branch = true; isValid = false; }
    if (!asset.cost.trim()) { newErrors.cost = true; isValid = false; }
    if (!asset.usefulLife.trim()) { newErrors.usefulLife = true; isValid = false; }
    if (!asset.depreciationRate.trim()) { newErrors.depreciationRate = true; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const assetWithId = { ...asset, id: generateAssetId(asset.branch, asset.category) };
      onSaveAsset(assetWithId);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="asset-form-modal lease-form-modal">
          <h2>New Asset</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Description *</label>
              {errors.description && <span className="error-text">Required</span>}
              <input
                type="text"
                className={errors.description ? 'error' : ''}
                value={asset.description}
                onChange={(e) => handleAssetInput('description', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Tag No.</label>
              <input
                type="text"
                value={asset.tagNo}
                onChange={(e) => handleAssetInput('tagNo', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Serial No.</label>
              <input
                type="text"
                value={asset.serialNo}
                onChange={(e) => handleAssetInput('serialNo', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              {errors.category && <span className="error-text">Required</span>}
              <select
                className={errors.category ? 'error' : ''}
                value={asset.category}
                onChange={(e) => handleAssetInput('category', e.target.value)}
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
                value={asset.branch}
                onChange={(e) => handleAssetInput('branch', e.target.value)}
              >
                <option value="">Select Branch</option>
                {BRANCHES.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Cost *</label>
              {errors.cost && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.cost ? 'error' : ''}
                value={asset.cost}
                onChange={(e) => handleAssetInput('cost', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Vendor Name</label>
              <input
                type="text"
                value={asset.vendorName}
                onChange={(e) => handleAssetInput('vendorName', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Invoice</label>
              <input
                type="text"
                value={asset.invoice}
                onChange={(e) => handleAssetInput('invoice', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Useful Life (Years) *</label>
              {errors.usefulLife && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.usefulLife ? 'error' : ''}
                value={asset.usefulLife}
                onChange={(e) => handleAssetInput('usefulLife', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Depreciation Rate (%) *</label>
              {errors.depreciationRate && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.depreciationRate ? 'error' : ''}
                value={asset.depreciationRate}
                onChange={(e) => handleAssetInput('depreciationRate', e.target.value)}
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

export default AddAssetModal;
