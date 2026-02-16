import React, { useState, useRef, useEffect, useCallback } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { View } from '../Layout/Sidebar';
import { Entity } from '../../types/Entity';
import { Asset, CIPAsset, AssetCategory, AssetBranch } from '../../types/Asset';
import { loadEntityAssets, addEntityAsset, updateEntityAsset, deleteEntityAsset, addEntityCIPAsset } from '../../utils/dataStorage';
import AddAssetModal from './AddAssetModal';
import '../Homepage/EntitiesPage.css';
import '../Leases/Dashboard.css';
import '../Leases/LeaseForm.css';
import './FixedAssetsRegister.css';

const CATEGORIES: AssetCategory[] = ['Office Equipment', 'Motor Vehicle', 'Warehouse Equipment', 'Manufacturing Equipment', 'Equipment for Leased', 'Software'];
const BRANCHES: AssetBranch[] = ['CORP', 'PERT', 'MACK', 'MTIS', 'MUSW', 'NEWM', 'ADEL', 'BLAC', 'PARK'];

interface FixedAssetsRegistrationProps {
  onNavigate: (view: View) => void;
  selectedEntity: Entity | null;
}

const COLUMNS = [
  'Asset ID',
  'Description',
  'Category',
  'Branch',
  'Cost',
  'Vendor',
  'Invoice',
  'Useful Life (Yrs)',
  'Dep. Rate (%)',
  'Tag No.',
  'Serial No.',
];

const EMPTY_ROW_COUNT = 15;
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 700;

const FixedAssetsRegistration: React.FC<FixedAssetsRegistrationProps> = ({ onNavigate, selectedEntity }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Disposed'>('All');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Side panel edit state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editedAsset, setEditedAsset] = useState<Asset | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = document.querySelector('.app-header') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newWidth)));
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      loadEntityAssets(selectedEntity.id).then(setAssets);
    } else {
      setAssets([]);
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (selectedAssetId) {
      const asset = assets.find(a => a.id === selectedAssetId);
      if (asset) {
        setEditedAsset({ ...asset });
        setErrors({});
      } else {
        setSelectedAssetId(null);
        setEditedAsset(null);
      }
    } else {
      setEditedAsset(null);
      setErrors({});
    }
  }, [selectedAssetId, assets]);

  // Keep select-all indeterminate state in sync
  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = assets.length > 0 && selectedAssets.size === assets.length;
      const someSelected = selectedAssets.size > 0 && selectedAssets.size < assets.length;
      selectAllRef.current.indeterminate = someSelected;
      selectAllRef.current.checked = allSelected;
    }
  }, [selectedAssets, assets.length]);

  const handleSelectAll = useCallback(() => {
    if (selectedAssets.size === assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map(a => a.id)));
    }
  }, [assets, selectedAssets.size]);

  const handleToggleAsset = (assetId: string) => {
    const newSet = new Set(selectedAssets);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setSelectedAssets(newSet);
  };

  const handleRowClick = (assetId: string) => {
    setSelectedAssetId(selectedAssetId === assetId ? null : assetId);
  };

  const handleAddAsset = async (asset: Asset) => {
    if (!selectedEntity) return;
    const updatedAssets = await addEntityAsset(selectedEntity.id, asset);
    setAssets(updatedAssets);
    setIsAddModalOpen(false);
  };

  const handleAddCIPAsset = async (cipAsset: CIPAsset) => {
    if (!selectedEntity) return;
    await addEntityCIPAsset(selectedEntity.id, cipAsset);
    setIsAddModalOpen(false);
  };

  const handleDeleteSelected = async () => {
    if (!selectedEntity) return;
    let currentAssets = assets;
    const idsToDelete = Array.from(selectedAssets);
    for (let i = 0; i < idsToDelete.length; i++) {
      currentAssets = await deleteEntityAsset(selectedEntity.id, idsToDelete[i]);
    }
    setAssets(currentAssets);
    setSelectedAssets(new Set());
  };

  const handleInputChange = (field: string, value: string) => {
    if (!editedAsset) return;
    setEditedAsset({ ...editedAsset, [field]: value } as Asset);
    if (errors[field]) setErrors({ ...errors, [field]: false });
  };

  const validateForm = (): boolean => {
    if (!editedAsset) return false;
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!editedAsset.description.trim()) { newErrors.description = true; isValid = false; }
    if (!editedAsset.category) { newErrors.category = true; isValid = false; }
    if (!editedAsset.branch) { newErrors.branch = true; isValid = false; }
    if (!editedAsset.cost.trim()) { newErrors.cost = true; isValid = false; }
    if (!editedAsset.usefulLife.trim()) { newErrors.usefulLife = true; isValid = false; }
    if (!editedAsset.depreciationRate.trim()) { newErrors.depreciationRate = true; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!editedAsset || !selectedEntity || !validateForm()) return;
    const updatedAssets = await updateEntityAsset(selectedEntity.id, editedAsset);
    setAssets(updatedAssets);
    setSelectedAssetId(null);
  };

  const handleCancel = () => {
    setSelectedAssetId(null);
  };

  const handleDeleteFromPanel = async () => {
    if (!selectedAssetId || !selectedEntity) return;
    const updatedAssets = await deleteEntityAsset(selectedEntity.id, selectedAssetId);
    setAssets(updatedAssets);
    setSelectedAssetId(null);
  };

  const filteredAssets = assets.filter(asset => {
    if (search) {
      const term = search.toLowerCase();
      const matches = asset.description.toLowerCase().includes(term) ||
        asset.tagNo.toLowerCase().includes(term) ||
        asset.serialNo.toLowerCase().includes(term) ||
        asset.category.toLowerCase().includes(term) ||
        asset.branch.toLowerCase().includes(term) ||
        asset.vendorName.toLowerCase().includes(term);
      if (!matches) return false;
    }
    return true;
  });

  const emptyRowsNeeded = Math.max(0, EMPTY_ROW_COUNT - filteredAssets.length);

  const renderDetailPanel = () => {
    if (!editedAsset || !selectedAssetId) return null;

    return (
      <div className="lease-side-panel" ref={panelRef} style={{ width: `${panelWidth}px`, top: `${headerHeight}px` }}>
        <div className="side-panel-resize-handle" onMouseDown={handleResizeMouseDown} />
        <div className="side-panel-content">
          <div className="lease-detail-header">
            <h3>Edit Asset</h3>
            <button className="lease-detail-close" onClick={handleCancel}><CloseIcon /></button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Asset ID</label>
              <input type="text" className="readonly-input" value={editedAsset.id} readOnly />
            </div>

            <div className="form-group">
              <label>Description *</label>
              {errors.description && <span className="error-text">Required</span>}
              <input
                type="text"
                className={errors.description ? 'error' : ''}
                value={editedAsset.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Tag No.</label>
              <input
                type="text"
                value={editedAsset.tagNo}
                onChange={(e) => handleInputChange('tagNo', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Serial No.</label>
              <input
                type="text"
                value={editedAsset.serialNo}
                onChange={(e) => handleInputChange('serialNo', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              {errors.category && <span className="error-text">Required</span>}
              <select
                className={errors.category ? 'error' : ''}
                value={editedAsset.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
              >
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Branch *</label>
              {errors.branch && <span className="error-text">Required</span>}
              <select
                className={errors.branch ? 'error' : ''}
                value={editedAsset.branch}
                onChange={(e) => handleInputChange('branch', e.target.value)}
              >
                <option value="">Select Branch</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Cost *</label>
              {errors.cost && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.cost ? 'error' : ''}
                value={editedAsset.cost}
                onChange={(e) => handleInputChange('cost', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Vendor Name</label>
              <input
                type="text"
                value={editedAsset.vendorName}
                onChange={(e) => handleInputChange('vendorName', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Invoice</label>
              <input
                type="text"
                value={editedAsset.invoice}
                onChange={(e) => handleInputChange('invoice', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Useful Life (Years) *</label>
              {errors.usefulLife && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.usefulLife ? 'error' : ''}
                value={editedAsset.usefulLife}
                onChange={(e) => handleInputChange('usefulLife', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Depreciation Rate (%) *</label>
              {errors.depreciationRate && <span className="error-text">Required</span>}
              <input
                type="number"
                className={errors.depreciationRate ? 'error' : ''}
                value={editedAsset.depreciationRate}
                onChange={(e) => handleInputChange('depreciationRate', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="lease-detail-actions">
          <button className="panel-btn" onClick={handleDeleteFromPanel}>Delete</button>
          <div className="lease-detail-actions-right">
            <button className="panel-btn" onClick={handleCancel}>Cancel</button>
            <button className="panel-btn" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-split">
      <div className="dashboard-main" style={selectedAssetId ? { marginRight: `${panelWidth}px` } : undefined}>
        <div className="dashboard-container">
          <div className="table-section">
            <div className="page-header">
              <button className="back-button" onClick={() => onNavigate('home')} title="Back to Home">
                <ArrowBackIcon fontSize="small" />
              </button>
              <h2>Fixed Assets Register ({assets.length})</h2>
              <div className="page-header-actions">
                <button
                  className="entities-add-button"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={!selectedEntity}
                >
                  New Asset
                </button>
              </div>
            </div>

            <div className="assets-register-body">
              {/* Selection / toolbar bar */}
              <div className="selection-bar">
                <input
                  type="checkbox"
                  ref={selectAllRef}
                  className="select-all-checkbox"
                  onChange={handleSelectAll}
                />
                {selectedAssets.size > 0 ? (
                  <>
                    <span className="selection-count">{selectedAssets.size} selected</span>
                    <div className="selection-actions">
                      <button className="action-btn action-copy" title="Copy">
                        <ContentCopyIcon fontSize="small" />
                      </button>
                      <button className="action-btn action-delete" title="Delete" onClick={handleDeleteSelected}>
                        <DeleteIcon fontSize="small" />
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="selection-hint">Select items</span>
                )}
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="filter-dropdown"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'All' | 'Active' | 'Disposed')}
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Disposed">Disposed</option>
                </select>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="asset-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      {COLUMNS.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((asset) => (
                      <tr
                        key={asset.id}
                        className={selectedAssetId === asset.id ? 'selected-row' : ''}
                        onClick={() => handleRowClick(asset.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ textAlign: 'center', padding: 8 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="lease-checkbox"
                            checked={selectedAssets.has(asset.id)}
                            onChange={() => handleToggleAsset(asset.id)}
                          />
                        </td>
                        <td>{asset.id}</td>
                        <td>{asset.description}</td>
                        <td>{asset.category}</td>
                        <td>{asset.branch}</td>
                        <td>{asset.cost ? `$${Number(asset.cost).toLocaleString()}` : ''}</td>
                        <td>{asset.vendorName}</td>
                        <td>{asset.invoice}</td>
                        <td>{asset.usefulLife}</td>
                        <td>{asset.depreciationRate ? `${asset.depreciationRate}%` : ''}</td>
                        <td>{asset.tagNo}</td>
                        <td>{asset.serialNo}</td>
                      </tr>
                    ))}
                    {Array.from({ length: emptyRowsNeeded }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td style={{ textAlign: 'center', padding: 8 }}>
                          <input type="checkbox" className="lease-checkbox" disabled />
                        </td>
                        {COLUMNS.map((col) => (
                          <td key={col}>&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedAssetId && renderDetailPanel()}

      {isAddModalOpen && selectedEntity && (
        <AddAssetModal
          onClose={() => setIsAddModalOpen(false)}
          onSaveAsset={handleAddAsset}
          onSaveCIPAsset={handleAddCIPAsset}
        />
      )}
    </div>
  );
};

export default FixedAssetsRegistration;
