import React from 'react';
import { Asset } from '../../types/Asset';
import '../Leases/AddLeaseModal.css';

interface AssetUploadModalProps {
  assets: Asset[];
  onConfirm: () => void;
  onCancel: () => void;
}

const PREVIEW_COLUMNS: { key: keyof Asset; label: string }[] = [
  { key: 'id', label: 'Asset ID' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'branch', label: 'Branch' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'invoice', label: 'Invoice No.' },
  { key: 'serialNo', label: 'Serial' },
  { key: 'tagNo', label: 'Tag/Registration' },
  { key: 'acquisitionDate', label: 'Acquisition Date' },
  { key: 'cost', label: 'Cost' },
  { key: 'usefulLife', label: 'Useful Life' },
  { key: 'depreciationRate', label: 'Dep. Rate (%)' },
];

const AssetUploadModal: React.FC<AssetUploadModalProps> = ({ assets, onConfirm, onCancel }) => {
  const count = assets.length;

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="asset-upload-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="asset-upload-header">
          <h2>Upload {count} Asset{count !== 1 ? 's' : ''}</h2>
          <p className="asset-upload-subtitle">
            {count} asset{count !== 1 ? 's' : ''} ready to import. Review below before confirming.
          </p>
        </div>

        <div className="asset-upload-table-wrapper">
          <table className="asset-upload-preview-table">
            <thead>
              <tr>
                <th className="row-num-col">#</th>
                {PREVIEW_COLUMNS.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, i) => (
                <tr key={i}>
                  <td className="row-num-col">{i + 1}</td>
                  {PREVIEW_COLUMNS.map(col => (
                    <td key={col.key}>{asset[col.key] as string}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="asset-upload-actions">
          <button className="save-button" onClick={onConfirm}>
            Upload {count} Asset{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetUploadModal;
