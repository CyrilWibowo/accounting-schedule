import React, { useState } from 'react';
import { Asset, CIPAsset } from '../../types/Asset';
import '../Leases/AddLeaseModal.css';

interface AssetUploadModalProps {
  sheet1Assets: Asset[];
  sheet2Assets: Asset[];
  cipAssets: CIPAsset[];
  openingBalanceDate: string;
  onOpeningBalanceDateChange: (date: string) => void;
  onConfirm: (obDate: string) => void;
  onCancel: () => void;
}

const SHORT_COLS = new Set<keyof Asset>(['invoice', 'serialNo', 'tagNo']);

const ASSET_COLS: { key: keyof Asset; label: string }[] = [
  { key: 'id', label: 'Asset ID' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'branch', label: 'Branch' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'invoice', label: 'Invoice No.' },
  { key: 'serialNo', label: 'Serial' },
  { key: 'tagNo', label: 'Tag/Reg' },
  { key: 'acquisitionDate', label: 'Acq. Date' },
  { key: 'activeDate', label: 'Active Date' },
  { key: 'cost', label: 'Cost' },
  { key: 'usefulLife', label: 'Useful Life' },
];

type TabId = 'opening' | 'additions' | 'cip';

const AssetUploadModal: React.FC<AssetUploadModalProps> = ({
  sheet1Assets,
  sheet2Assets,
  cipAssets,
  openingBalanceDate,
  onOpeningBalanceDateChange,
  onConfirm,
  onCancel,
}) => {
  const allTabs: { id: TabId; label: string; count: number }[] = [
    { id: 'opening', label: 'Opening Balance Assets', count: sheet1Assets.length },
    { id: 'additions', label: 'Addition Assets', count: sheet2Assets.length },
    { id: 'cip', label: 'CIP', count: cipAssets.length },
  ];
  const tabs = allTabs.filter(t => t.count > 0);

  const [activeTab, setActiveTab] = useState<TabId>(tabs[0]?.id ?? 'opening');

  const totalAssets = sheet1Assets.length + sheet2Assets.length;
  const totalCIP = cipAssets.length;

  const renderAssetTable = (assets: Asset[], showAccumDep: boolean) => (
    <div className="asset-upload-table-wrapper">
      <table className="asset-upload-preview-table">
        <thead>
          <tr>
            <th className="row-num-col">#</th>
            {ASSET_COLS.map(col => <th key={col.key} className={col.key === 'description' ? 'col-description' : SHORT_COLS.has(col.key) ? 'col-short' : ''}>{col.label}</th>)}
            {showAccumDep && <th>Accum. Dep.</th>}
          </tr>
        </thead>
        <tbody>
          {assets.map((asset, i) => (
            <tr key={i}>
              <td className="row-num-col">{i + 1}</td>
              {ASSET_COLS.map(col => (
                <td key={col.key} className={col.key === 'description' ? 'col-description' : SHORT_COLS.has(col.key) ? 'col-short' : ''}>{asset[col.key] as string ?? ''}</td>
              ))}
              {showAccumDep && <td>{asset.openingBalances?.[0]?.value ?? ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCIPTable = (cipList: CIPAsset[]) => (
    <div className="asset-upload-table-wrapper">
      <table className="asset-upload-preview-table">
        <thead>
          <tr>
            <th className="row-num-col">#</th>
            <th>CIP ID</th>
            <th>Description</th>
            <th>Category</th>
            <th>Branch</th>
            <th>Completed</th>
            <th>Completion Date</th>
            <th>Useful Life</th>
            <th>Invoices</th>
            <th>Linked Asset</th>
          </tr>
        </thead>
        <tbody>
          {cipList.map((cip, i) => (
            <tr key={i}>
              <td className="row-num-col">{i + 1}</td>
              <td>{cip.id}</td>
              <td>{cip.description}</td>
              <td>{cip.category}</td>
              <td>{cip.branch}</td>
              <td>{cip.completed}</td>
              <td>{cip.completionDate}</td>
              <td>{cip.usefulLife}</td>
              <td>{cip.invoices.length}</td>
              <td>{cip.transferredAssetId ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="asset-upload-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="asset-upload-header">
          <h2>Upload Preview</h2>
          <p className="asset-upload-subtitle">
            {totalAssets > 0 && `${totalAssets} asset${totalAssets !== 1 ? 's' : ''}`}
            {totalAssets > 0 && totalCIP > 0 && ' and '}
            {totalCIP > 0 && `${totalCIP} CIP item${totalCIP !== 1 ? 's' : ''}`}
            {' ready to import. Review below before confirming.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <label style={{ fontWeight: 500, fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }}>
              Opening Balance / Addition Date
            </label>
            <input
              type="date"
              value={openingBalanceDate}
              onChange={(e) => onOpeningBalanceDateChange(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
            />
          </div>
        </div>

        <div className="asset-upload-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`asset-upload-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className="asset-upload-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="asset-upload-tab-content">
          {activeTab === 'opening' && renderAssetTable(sheet1Assets, true)}
          {activeTab === 'additions' && renderAssetTable(sheet2Assets, false)}
          {activeTab === 'cip' && renderCIPTable(cipAssets)}
        </div>

        <div className="asset-upload-actions">
          <button className="save-button" onClick={() => onConfirm(openingBalanceDate)}>
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetUploadModal;
